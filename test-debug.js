// Debug what's actually on the Google Maps page
const { chromium } = require('./backend/node_modules/playwright');

async function debugGoogleMaps() {
  console.log('Debugging Google Maps page content...');
  
  const browser = await chromium.launch({
    headless: false, // Show browser
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });
  
  const page = await browser.newPage();
  
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  await page.setViewportSize({ width: 1366, height: 768 });
  
  try {
    const url = 'https://www.google.com/maps/search/restaurants+in+Amsterdam';
    console.log('Going to:', url);
    
    await page.goto(url, { waitUntil: 'networkidle' });
    
    // Handle consent
    await page.waitForTimeout(3000);
    
    const isConsentPage = await page.evaluate(() => {
      return document.body?.textContent?.toLowerCase().includes('voordat je verdergaat') || false;
    });
    
    if (isConsentPage) {
      console.log('Handling consent...');
      const buttons = await page.$$('button');
      for (const button of buttons) {
        const text = await button.textContent();
        if (text && text.toLowerCase().includes('accepteren')) {
          await button.click();
          break;
        }
      }
      await page.waitForTimeout(5000);
    }
    
    // Take screenshot
    await page.screenshot({ path: '/tmp/debug-final-page.png', fullPage: true });
    console.log('Screenshot saved: /tmp/debug-final-page.png');
    
    // Check what selectors we can find
    console.log('\nChecking possible selectors...');
    
    const selectors = [
      'div.Nv2PK',
      'a.hfpxzc', 
      'div[role="article"]',
      '[data-result-index]',
      '[data-cid]',
      'div.rllt__details',
      'div.UaQhfb',
      'div[data-feature-id*="0x"]',
      'a[href*="/place/"]',
      '.section-result'
    ];
    
    for (const selector of selectors) {
      const count = await page.$$eval(selector, elements => elements.length).catch(() => 0);
      console.log(`${selector}: ${count} elements`);
    }
    
    // Get page title and check if we're on the right page
    const title = await page.title();
    console.log(`\nPage title: ${title}`);
    
    // Check for any potential business-related elements
    const businessElements = await page.evaluate(() => {
      const allElements = document.querySelectorAll('*');
      const businessLikeElements = [];
      
      for (const el of allElements) {
        const text = el.textContent?.trim() || '';
        const className = el.className || '';
        const id = el.id || '';
        
        if (
          (text.includes('restaurant') || text.includes('Restaurant')) ||
          className.includes('place') || className.includes('business') ||
          id.includes('place') || id.includes('business')
        ) {
          businessLikeElements.push({
            tagName: el.tagName,
            className: className,
            id: id,
            textContent: text.substring(0, 100)
          });
        }
      }
      
      return businessLikeElements.slice(0, 10); // Limit to first 10
    });
    
    console.log('\nBusiness-like elements found:');
    businessElements.forEach((el, i) => {
      console.log(`${i + 1}. ${el.tagName}.${el.className}#${el.id}: ${el.textContent}`);
    });
    
    // Wait a bit before closing so you can see the browser
    console.log('\nWaiting 10 seconds before closing browser...');
    await page.waitForTimeout(10000);
    
  } catch (error) {
    console.error('Debug failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugGoogleMaps();