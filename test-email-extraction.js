// Test email extraction functionality
const { chromium } = require('./backend/node_modules/playwright');

async function testEmailExtraction() {
  console.log('Testing email extraction pipeline...');
  
  const browser = await chromium.launch({
    headless: true,
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
  
  try {
    // Test with a restaurant website that likely has contact info
    const testWebsites = [
      'https://www.cafedereiger.nl',        // Amsterdam restaurant
      'https://www.restaurantgreetje.nl',   // Amsterdam restaurant  
      'https://www.hetpapeneiland.nl'       // Amsterdam restaurant
    ];
    
    for (const website of testWebsites) {
      console.log(`\nTesting email extraction from: ${website}`);
      
      try {
        // Visit the website
        await page.goto(website, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        
        console.log('Page loaded successfully');
        
        // Extract emails using mailto links first
        const mailtoEmails = await page.evaluate(() => {
          const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
          return mailtoLinks.map(link => {
            const href = link.getAttribute('href') || '';
            return href.replace('mailto:', '').split('?')[0];
          }).filter(email => email.includes('@'));
        });
        
        console.log(`Found ${mailtoEmails.length} mailto emails:`, mailtoEmails);
        
        // Extract emails from text content
        const textEmails = await page.evaluate(() => {
          const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
          const pageText = document.body.textContent || '';
          const foundEmails = pageText.match(emailRegex) || [];
          
          return [...new Set(foundEmails)]
            .filter(email => !email.includes('example.com'))
            .filter(email => !email.includes('test@'))
            .filter(email => !email.includes('admin@localhost'))
            .slice(0, 5);
        });
        
        console.log(`Found ${textEmails.length} text emails:`, textEmails);
        
        // Try contact pages
        const contactPages = ['/contact', '/contact-us', '/about'];
        const contactEmails = [];
        
        for (const contactPath of contactPages) {
          try {
            const contactUrl = new URL(contactPath, website).href;
            console.log(`Checking contact page: ${contactUrl}`);
            
            await page.goto(contactUrl, { 
              waitUntil: 'domcontentloaded',
              timeout: 8000 
            });
            
            const pageEmails = await page.evaluate(() => {
              // Check for mailto links first
              const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
              const mailtos = mailtoLinks.map(link => {
                const href = link.getAttribute('href') || '';
                return href.replace('mailto:', '').split('?')[0];
              }).filter(email => email.includes('@'));
              
              if (mailtos.length > 0) return mailtos;
              
              // Then check text content
              const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
              const pageText = document.body.textContent || '';
              return pageText.match(emailRegex) || [];
            });
            
            if (pageEmails.length > 0) {
              console.log(`Found ${pageEmails.length} emails on ${contactPath}:`, pageEmails);
              contactEmails.push(...pageEmails);
              break; // Stop at first successful contact page
            }
          } catch (error) {
            console.log(`Contact page ${contactPath} not found or failed to load`);
            continue;
          }
        }
        
        // Combine all emails
        const allEmails = [...mailtoEmails, ...textEmails, ...contactEmails];
        const uniqueEmails = [...new Set(allEmails)]
          .filter(email => email.includes('@'))
          .slice(0, 5);
        
        console.log(`✅ Total unique emails found: ${uniqueEmails.length}`);
        if (uniqueEmails.length > 0) {
          console.log('Final emails:', uniqueEmails);
        }
        
      } catch (error) {
        console.log(`❌ Failed to extract emails from ${website}:`, error.message);
      }
    }
    
    console.log('\n✅ Email extraction pipeline test completed');
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testEmailExtraction();