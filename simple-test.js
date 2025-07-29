#!/usr/bin/env node

// Simple scraper test - no dependencies on backend services
const { chromium } = require('./backend/node_modules/playwright');

async function testScraper() {
  console.log('🧪 Testing Google Maps Scraper with Cookie Consent Fix');
  console.log('=' + '='.repeat(60));

  const browser = await chromium.launch({ 
    headless: false, // Show browser so you can see it working
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  // Set realistic headers
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  await page.setViewportSize({ width: 1366, height: 768 });

  try {
    console.log('\n📍 Step 1: Search for businesses on Google Maps');
    const searchQuery = 'restaurants in Rotterdam'; // Try Rotterdam for variety
    const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    
    console.log(`   Searching: ${searchQuery}`);
    await page.goto(url, { waitUntil: 'networkidle' });

    console.log('\n🍪 Step 2: Handle cookie consent');
    await page.waitForTimeout(2000);
    
    // Check for consent page
    const needsConsent = await page.evaluate(() => {
      return document.body?.textContent?.toLowerCase().includes('voordat je verdergaat') || false;
    });

    if (needsConsent) {
      console.log('   ⚠️  Cookie consent required - handling...');
      
      const buttons = await page.$$('button');
      console.log(`   📊 Found ${buttons.length} buttons total`);
      let consentHandled = false;
      
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const text = await button.textContent();
        console.log(`   🔍 Button ${i + 1}: "${text}"`);
        
        if (text && (
          text.toLowerCase().includes('alles accepteren') ||
          text.toLowerCase().includes('accept all') ||
          text === 'Alles accepteren' ||
          text.trim() === 'Alles accepteren'
        )) {
          console.log(`   ✅ Clicking: "${text}"`);
          try {
            await button.click();
            consentHandled = true;
            console.log(`   ⏳ Waiting for page to load after consent...`);
            await page.waitForTimeout(5000);
            break;
          } catch (clickError) {
            console.log(`   ❌ Click failed: ${clickError.message}`);
          }
        }
      }
      
      if (!consentHandled) {
        console.log(`   ❌ No suitable consent button found among ${buttons.length} buttons`);
        throw new Error('Could not handle cookie consent');
      }
    } else {
      console.log('   ✅ No consent required');
    }

    console.log('\n🔍 Step 3: Look for business results');
    
    // Wait for results and try different selectors
    const selectors = [
      'a[href*="/place/"]',
      'div[data-cid]', 
      'div.Nv2PK',
      'a.hfpxzc',
      'div[role="article"]'
    ];

    let businesses = [];
    for (const selector of selectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        
        businesses = await page.evaluate((sel) => {
          const elements = document.querySelectorAll(sel);
          const results = [];
          
          for (let i = 0; i < Math.min(elements.length, 3); i++) {
            const element = elements[i];
            let name = 'Unknown Business';
            let link = '';
            
            // Try to get business name and link
            if (element.tagName === 'A') {
              name = element.textContent?.trim() || `Business ${i + 1}`;
              link = element.href;
            } else {
              const linkEl = element.querySelector('a[href*="/place/"]');
              if (linkEl) {
                name = linkEl.textContent?.trim() || `Business ${i + 1}`;
                link = linkEl.href;
              }
            }
            
            if (link && name) {
              results.push({ name, link, index: i });
            }
          }
          
          return results;
        }, selector);
        
        if (businesses.length > 0) {
          console.log(`   ✅ Found ${businesses.length} businesses using selector: ${selector}`);
          break;
        }
      } catch (error) {
        continue;
      }
    }

    if (businesses.length === 0) {
      console.log('   ❌ No businesses found - taking screenshot for debugging');
      await page.screenshot({ path: '/tmp/no-results-debug.png', fullPage: true });
      console.log('   📷 Debug screenshot: /tmp/no-results-debug.png');
    }

    console.log('\n🏪 Step 4: Extract business details');
    
    for (let i = 0; i < Math.min(businesses.length, 2); i++) {
      const business = businesses[i];
      console.log(`\n   Processing: ${business.name}`);
      
      try {
        await page.goto(business.link, { 
          waitUntil: 'domcontentloaded', 
          timeout: 15000 
        });
        await page.waitForTimeout(2000);

        const details = await page.evaluate(() => {
          const getName = () => {
            const h1 = document.querySelector('h1');
            return h1?.textContent?.trim() || 'Unknown';
          };

          const getAddress = () => {
            const addressSelectors = [
              '[data-item-id*="address"]',
              '[aria-label*="Address"]',
              'span[title*="Address"]'
            ];
            
            for (const sel of addressSelectors) {
              const el = document.querySelector(sel);
              if (el) return el.textContent?.trim();
            }
            return null;
          };

          const getPhone = () => {
            const phoneEl = document.querySelector('a[href^="tel:"]') || 
                           document.querySelector('[data-item-id*="phone"]');
            return phoneEl?.textContent?.trim() || phoneEl?.getAttribute('href')?.replace('tel:', '') || null;
          };

          const getWebsite = () => {
            const websiteEl = document.querySelector('a[href*="http"]:not([href*="google.com"]):not([href*="maps"])');
            return websiteEl?.getAttribute('href') || null;
          };

          return {
            name: getName(),
            address: getAddress(),
            phone: getPhone(),
            website: getWebsite()
          };
        });

        console.log(`      📍 Address: ${details.address || 'Not found'}`);
        console.log(`      📞 Phone: ${details.phone || 'Not found'}`);
        console.log(`      🌐 Website: ${details.website || 'Not found'}`);

        // Test email extraction if website exists
        if (details.website) {
          console.log(`\n   📧 Testing email extraction from website...`);
          
          try {
            const websiteUrl = details.website.startsWith('http') ? 
              details.website : `https://${details.website}`;
            
            await page.goto(websiteUrl, { 
              waitUntil: 'domcontentloaded', 
              timeout: 10000 
            });

            const emails = await page.evaluate(() => {
              // Look for mailto links first
              const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
              const mailtoEmails = mailtoLinks.map(link => 
                link.getAttribute('href')?.replace('mailto:', '').split('?')[0]
              ).filter(email => email && email.includes('@'));
              
              if (mailtoEmails.length > 0) return mailtoEmails;
              
              // Look in text content
              const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
              const text = document.body.textContent || '';
              return [...new Set(text.match(emailRegex) || [])]
                .filter(email => !email.includes('example.com'))
                .slice(0, 3);
            });

            if (emails.length > 0) {
              console.log(`      ✅ Found emails: ${emails.join(', ')}`);
            } else {
              console.log(`      ⚠️  No emails found`);
            }

          } catch (error) {
            console.log(`      ❌ Website unreachable: ${error.message}`);
          }
        }

      } catch (error) {
        console.log(`      ❌ Failed: ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Test completed! Check the browser window to see the scraping in action.');
    console.log('💡 Press Enter to close browser and exit...');
    
    // Keep browser open until user presses Enter
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', () => {
      process.exit(0);
    });

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: '/tmp/error-debug.png', fullPage: true });
    console.log('📷 Error screenshot saved: /tmp/error-debug.png');
  } finally {
    // Don't close browser automatically so user can inspect
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log('\n👋 Closing browser...');
  process.exit(0);
});

testScraper();