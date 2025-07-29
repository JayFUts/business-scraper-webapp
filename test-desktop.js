// Simple test to debug the desktop scraper
const { chromium } = require('playwright');

async function testScraper() {
  console.log('Starting test scraper...');
  
  const browser = await chromium.launch({ 
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  try {
    // Try direct search URL
    const searchQuery = 'restaurants in Amsterdam';
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    
    console.log('Navigating to:', searchUrl);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    console.log('Waiting for page to load...');
    await page.waitForTimeout(3000);
    
    // Check for consent
    const isConsentPage = await page.evaluate(() => {
      return document.body?.textContent?.includes('Voordat je verdergaat naar Google');
    });
    
    if (isConsentPage) {
      console.log('Cookie consent page detected...');
      const acceptButton = await page.$('input[type="submit"][value="Alles accepteren"]');
      if (acceptButton) {
        console.log('Found consent button, clicking...');
        await acceptButton.click();
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
      }
    }
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'test-screenshot.png' });
    
    // Check page info
    const title = await page.title();
    const url = page.url();
    console.log('Page title:', title);
    console.log('Current URL:', url);
    
    // Wait for results
    console.log('Waiting for results...');
    await page.waitForTimeout(5000);
    
    // Try to find businesses
    const businessCount = await page.evaluate(() => {
      const selectors = [
        'a.hfpxzc',
        'a[href*="/place/"]',
        'div[role="article"]',
        '.Nv2PK',
        '[jsaction*="mouseover:pane"]'
      ];
      
      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          console.log(`Found ${elements.length} elements with selector: ${selector}`);
          return elements.length;
        }
      }
      
      return 0;
    });
    
    console.log(`Found ${businessCount} business elements`);
    
    // Try alternative approach - look for any links with place in them
    const placeLinks = await page.$$eval('a', links => {
      return links
        .filter(link => link.href && link.href.includes('/maps/place/'))
        .map(link => ({
          text: link.textContent,
          href: link.href
        }))
        .slice(0, 5);
    });
    
    console.log('Place links found:', placeLinks);
    
    console.log('\nTest complete! Check test-screenshot.png to see what the page looks like.');
    console.log('Press Ctrl+C to close the browser.');
    
    // Keep browser open for manual inspection
    await page.waitForTimeout(60000);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await browser.close();
  }
}

testScraper();