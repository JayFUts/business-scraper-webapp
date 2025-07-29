// Full workflow test: Google Maps scraping + email extraction
const { chromium } = require('./backend/node_modules/playwright');

async function testFullWorkflow() {
  console.log('Testing full scraper workflow...');
  
  const browser = await chromium.launch({
    headless: false, // Changed to see what's happening
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set user agent
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  await page.setViewportSize({ width: 1366, height: 768 });
  
  try {
    console.log('\n=== STEP 1: Google Maps Search ===');
    
    // First go to Google Maps homepage
    console.log('Going to Google Maps...');
    await page.goto('https://www.google.com/maps', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    
    // Handle cookie consent
    console.log('Handling cookie consent...');
    
    const isConsentPage = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';
      return bodyText.toLowerCase().includes('voordat je verdergaat');
    });
    
    if (isConsentPage) {
      console.log('Cookie consent page detected, looking for buttons...');
      
      // Click the "Alles accepteren" submit button
      const acceptButton = await page.$('input[type="submit"][value="Alles accepteren"]');
      if (acceptButton) {
        await acceptButton.click();
        console.log('✅ Clicked "Alles accepteren" button');
        
        // Wait for navigation
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      } else {
        console.log('Accept button not found, trying reject button...');
        const rejectButton = await page.$('input[type="submit"][value="Alles afwijzen"]');
        if (rejectButton) {
          await rejectButton.click();
          console.log('✅ Clicked "Alles afwijzen" button');
          await page.waitForLoadState('networkidle');
          await page.waitForTimeout(3000);
        } else {
          console.log('Could not find consent buttons');
        }
      }
    }
    
    // Now perform the search
    console.log('Performing search...');
    const searchQuery = 'restaurants in Amsterdam';
    
    // Look for search box
    const searchBox = await page.$('input[name="q"]') || await page.$('input[aria-label*="Search"]');
    
    if (searchBox) {
      await searchBox.fill(searchQuery);
      await page.keyboard.press('Enter');
      console.log('✅ Search submitted');
      
      // Wait for results to load
      await page.waitForTimeout(5000);
    }
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'debug-search-results.png' });
    
    // Check current URL
    console.log('Current URL:', page.url());
    
    console.log('Looking for business results...');
    
    const businesses = await page.evaluate(() => {
      const results = [];
      const seenNames = new Set();
      
      // Try to find business containers - look for the main business links
      const businessLinks = document.querySelectorAll('a.hfpxzc');
      console.log(`Found ${businessLinks.length} business links`);
      
      for (let i = 0; i < Math.min(businessLinks.length, 5); i++) {
        const linkElement = businessLinks[i];
        
        try {
          if (linkElement && linkElement.href && linkElement.href.includes('/place/')) {
            const name = linkElement.getAttribute('aria-label') || 
                        linkElement.textContent?.trim() || 
                        `Business ${i + 1}`;
            
            // Avoid duplicates
            if (!seenNames.has(name)) {
              seenNames.add(name);
              const detailLink = linkElement.href;
              
              results.push({
                name,
                detailLink,
                index: i
              });
            }
          }
        } catch (error) {
          console.error('Error extracting business:', error);
        }
      }
      
      return results;
    });
    
    console.log(`✅ Found ${businesses.length} businesses`);
    
    console.log('\n=== STEP 2: Extract Business Details ===');
    
    const businessesWithDetails = [];
    
    for (const business of businesses.slice(0, 2)) { // Test first 2 businesses
      console.log(`\nProcessing: ${business.name}`);
      
      try {
        // Visit business detail page
        await page.goto(business.detailLink, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        
        await page.waitForTimeout(2000);
        
        // Extract business details
        const businessInfo = await page.evaluate(() => {
          const data = {
            name: '',
            address: '',
            phone: null,
            website: null
          };
          
          // Business name
          const nameElement = document.querySelector('h1') || 
                             document.querySelector('[data-attrid="title"]');
          data.name = nameElement?.textContent?.trim() || '';
          
          // Address
          const addressElement = document.querySelector('[data-item-id*="address"]') ||
                                document.querySelector('[aria-label*="Address"]');
          data.address = addressElement?.textContent?.trim() || '';
          
          // Phone
          const phoneElement = document.querySelector('[data-item-id*="phone"]') ||
                              document.querySelector('a[href^="tel:"]');
          if (phoneElement) {
            data.phone = phoneElement.textContent?.trim() || 
                        phoneElement.getAttribute('href')?.replace('tel:', '') || null;
          }
          
          // Website
          const websiteElement = document.querySelector('[data-item-id*="authority"]') ||
                                document.querySelector('a[href*="http"]:not([href*="google.com"]):not([href*="maps"])');
          if (websiteElement) {
            const href = websiteElement.getAttribute('href');
            if (href && !href.includes('google.com') && !href.includes('maps')) {
              // Extract actual URL from Google redirect URL
              const urlMatch = href.match(/[?&]q=([^&]+)/);
              if (urlMatch) {
                data.website = decodeURIComponent(urlMatch[1]);
              } else {
                data.website = href;
              }
            }
          }
          
          return data;
        });
        
        console.log(`  Name: ${businessInfo.name}`);
        console.log(`  Address: ${businessInfo.address}`);
        console.log(`  Phone: ${businessInfo.phone || 'Not found'}`);
        console.log(`  Website: ${businessInfo.website || 'Not found'}`);
        
        // If we have a website, extract emails
        let emails = [];
        if (businessInfo.website) {
          console.log(`\n=== STEP 3: Email Extraction from ${businessInfo.website} ===`);
          
          try {
            const websiteUrl = businessInfo.website.startsWith('http') ? 
              businessInfo.website : `https://${businessInfo.website}`;
            
            await page.goto(websiteUrl, { 
              waitUntil: 'domcontentloaded',
              timeout: 15000 
            });
            
            // Extract emails from website
            emails = await page.evaluate(() => {
              // First try mailto links
              const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
              const mailtoEmails = mailtoLinks.map(link => {
                const href = link.getAttribute('href') || '';
                return href.replace('mailto:', '').split('?')[0];
              }).filter(email => email.includes('@'));
              
              if (mailtoEmails.length > 0) return mailtoEmails;
              
              // Then try text content
              const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
              const pageText = document.body.textContent || '';
              const foundEmails = pageText.match(emailRegex) || [];
              
              return [...new Set(foundEmails)]
                .filter(email => !email.includes('example.com'))
                .filter(email => !email.includes('test@'))
                .slice(0, 3);
            });
            
            console.log(`  ✅ Found ${emails.length} emails: ${emails.join(', ')}`);
            
          } catch (error) {
            console.log(`  ❌ Email extraction failed: ${error.message}`);
          }
        }
        
        businessesWithDetails.push({
          ...businessInfo,
          emails: emails
        });
        
      } catch (error) {
        console.log(`  ❌ Failed to process ${business.name}: ${error.message}`);
      }
    }
    
    console.log('\n=== FINAL RESULTS ===');
    console.log(`Successfully processed ${businessesWithDetails.length} businesses:`);
    
    businessesWithDetails.forEach((business, index) => {
      console.log(`\n${index + 1}. ${business.name}`);
      console.log(`   Address: ${business.address}`);
      console.log(`   Phone: ${business.phone || 'N/A'}`);
      console.log(`   Website: ${business.website || 'N/A'}`);
      console.log(`   Emails: ${business.emails.length > 0 ? business.emails.join(', ') : 'N/A'}`);
    });
    
    console.log('\n✅ Full workflow test completed successfully!');
    
  } catch (error) {
    console.error('❌ Workflow test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testFullWorkflow();