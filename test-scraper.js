// Simple test for cookie consent handling
const { chromium } = require('./backend/node_modules/playwright');

async function testCookieConsent() {
  console.log('Testing Google cookie consent handling...');
  
  const browser = await chromium.launch({
    headless: false, // Show browser for debugging
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set user agent
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
  });
  
  await page.setViewportSize({ width: 1366, height: 768 });
  
  try {
    // Go to Google Maps
    const url = 'https://www.google.com/maps/search/restaurants+in+Amsterdam';
    console.log('Navigating to:', url);
    
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Handle cookie consent
    console.log('Checking for cookie consent dialog...');
    
    // Wait briefly and take screenshot
    await page.waitForTimeout(3000);
    await page.screenshot({ path: '/tmp/test-before-consent.png', fullPage: true });
    console.log('Screenshot saved: /tmp/test-before-consent.png');
    
    // Check if consent page is present
    const isConsentPage = await page.evaluate(() => {
      const bodyText = document.body?.textContent || '';
      return bodyText.toLowerCase().includes('voordat je verdergaat') ||
             bodyText.toLowerCase().includes('before you continue');
    });
    
    console.log('Consent page detected:', isConsentPage);
    
    if (isConsentPage) {
      // Try to find and click consent button
      const consentButtons = await page.$$('button');
      console.log(`Found ${consentButtons.length} buttons`);
      
      for (let i = 0; i < consentButtons.length; i++) {
        const button = consentButtons[i];
        const buttonText = await button.textContent();
        console.log(`Button ${i}: "${buttonText}"`);
        
        if (buttonText && (
          buttonText.toLowerCase().includes('accepteren') ||
          buttonText.toLowerCase().includes('accept')
        )) {
          console.log(`Clicking consent button: "${buttonText}"`);
          await button.click();
          break;
        }
      }
      
      // Wait for page to load after consent
      await page.waitForTimeout(5000);
      await page.screenshot({ path: '/tmp/test-after-consent.png', fullPage: true });
      console.log('Screenshot saved: /tmp/test-after-consent.png');
    }
    
    // Check if we can find search results
    console.log('Looking for search results...');
    
    const possibleSelectors = [
      'div.Nv2PK',
      'a.hfpxzc', 
      'div[role="article"]',
      '[data-result-index]',
      '[data-cid]'
    ];
    
    let foundResults = false;
    for (const selector of possibleSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        const count = await page.$$eval(selector, elements => elements.length);
        console.log(`Found ${count} results with selector: ${selector}`);
        foundResults = true;
        break;
      } catch (error) {
        console.log(`Selector ${selector} not found`);
      }
    }
    
    if (foundResults) {
      console.log('✅ Cookie consent handling successful - search results found!');
    } else {
      console.log('❌ No search results found after consent handling');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testCookieConsent();