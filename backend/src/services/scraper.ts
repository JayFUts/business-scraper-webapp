import { chromium, Browser, Page } from 'playwright';
import { logger } from '../config/logger';
import type { Business } from '../types';

export class GoogleMapsScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });
      
      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      });
      
      // Set viewport
      await this.page.setViewportSize({ width: 1366, height: 768 });
      
      logger.info('Browser initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  async searchBusinesses(businessType: string, location: string, maxResults: number = 20): Promise<Partial<Business>[]> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      const searchQuery = `${businessType} in ${location}`;
      const url = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
      
      logger.info('Starting Google Maps search', { searchQuery, url });
      
      await this.page.goto(url, { waitUntil: 'networkidle' });
      
      // Handle Google cookie consent dialog if present
      await this.handleCookieConsent();
      
      // Wait a bit for dynamic content to load
      await this.page.waitForTimeout(3000);
      
      // Wait for results to load with robust fallback selectors
      await this.waitForSearchResults();
      
      // Scroll to load more results
      await this.scrollToLoadResults(maxResults);
      
      // Extract business data
      const businesses = await this.extractBusinessData(maxResults);
      
      logger.info('Google Maps search completed', { 
        found: businesses.length, 
        searchQuery 
      });
      
      return businesses;
    } catch (error) {
      logger.error('Google Maps search failed:', error);
      throw error;
    }
  }

  private async handleCookieConsent(): Promise<void> {
    if (!this.page) return;

    try {
      logger.info('Checking for Google cookie consent dialog...');
      
      // Wait for potential cookie consent dialog (with shorter timeout)
      const consentSelectors = [
        'button[aria-label*="Accept"]',
        'button[aria-label*="Accepteren"]', 
        'button:has-text("Alles accepteren")',
        'button:has-text("Accept all")',
        'button:has-text("I agree")',
        'button:has-text("Akkoord")',
        '[role="button"]:has-text("Alles accepteren")',
        '[role="button"]:has-text("Accept all")'
      ];

      // Try to find and click consent button with more robust approach
      let consentClicked = false;
      
      // First try the specific text-based approach
      try {
        const buttons = await this.page.$$('button');
        logger.info(`Found ${buttons.length} buttons on consent page`);
        
        for (const button of buttons) {
          const buttonText = await button.textContent();
          logger.info(`Button text: "${buttonText}"`);
          
          if (buttonText && (
            buttonText.toLowerCase().includes('alles accepteren') ||
            buttonText.toLowerCase().includes('accept all') ||
            buttonText.toLowerCase().includes('accepteren')
          )) {
            logger.info(`Clicking consent button: "${buttonText}"`);
            await button.click();
            consentClicked = true;
            await this.page.waitForTimeout(5000); // Wait longer for page redirect
            break;
          }
        }
      } catch (error) {
        logger.error('Error finding consent buttons:', error);
      }
      
      // Fallback: try CSS selectors
      if (!consentClicked) {
        for (const selector of consentSelectors) {
          try {
            logger.info(`Trying fallback selector: ${selector}`);
            
            await this.page.waitForSelector(selector, { timeout: 2000, state: 'visible' });
            await this.page.click(selector);
            logger.info(`✅ Successfully clicked consent button: ${selector}`);
            consentClicked = true;
            await this.page.waitForTimeout(5000);
            break;
          } catch (error) {
            continue;
          }
        }
      }

      // If no consent button found, check if we're on the consent page
      const isConsentPage = await this.page.evaluate(() => {
        const titleText = document.title || '';
        const bodyText = document.body?.textContent || '';
        
        return titleText.toLowerCase().includes('voordat je verdergaat') ||
               bodyText.toLowerCase().includes('voordat je verdergaat') ||
               bodyText.toLowerCase().includes('before you continue') ||
               bodyText.toLowerCase().includes('cookies');
      });

      if (isConsentPage && !consentClicked) {
        logger.warning('Still on consent page but could not find consent button');
        
        // Take debug screenshot
        try {
          await this.page.screenshot({ 
            path: `/tmp/debug-consent-${Date.now()}.png`, 
            fullPage: true 
          });
          logger.info('Debug consent screenshot saved to /tmp/');
        } catch (screenshotError) {
          logger.error('Failed to save consent debug screenshot:', screenshotError);
        }
        
        throw new Error('Cookie consent dialog detected but could not accept it');
      } else if (consentClicked) {
        logger.info('✅ Successfully handled cookie consent');
      } else {
        logger.info('No cookie consent dialog detected');
      }

    } catch (error) {
      logger.error('Error handling cookie consent:', error);
      // Don't throw - continue with scraping attempt
    }
  }

  private async waitForSearchResults(): Promise<void> {
    if (!this.page) return;

    try {
      // Try multiple selectors that Google Maps might use (updated for 2025)
      const possibleSelectors = [
        'div.Nv2PK',                     // ✅ Primary result container class
        'a.hfpxzc',                      // Clickable business link class
        'div[role="article"]',           // Semantic role selector
        '[data-result-index]',           // Original selector  
        '[data-cid]',                    // Customer ID attributes
        'div.rllt__details',             // Result details container
        'div.UaQhfb',                    // Alternative result container
        'div[data-feature-id*="0x"]',    // Google Maps feature IDs
        'a[href*="/place/"]',           // Direct place links
        '.section-result'                // Section-based results
      ];

      let foundSelector = null;
      
      for (const selector of possibleSelectors) {
        try {
          logger.info(`Trying selector: ${selector}`);
          await this.page.waitForSelector(selector, { timeout: 5000, state: 'attached' });
          
          // Verify it's actually visible and contains business data
          const isValid = await this.page.evaluate((sel) => {
            const elements = document.querySelectorAll(sel);
            console.log(`Selector ${sel} found ${elements.length} elements`);
            // Less strict check - just ensure we have elements
            return elements.length > 0;
          }, selector);
          
          if (isValid) {
            foundSelector = selector;
            logger.info(`✅ Found search results using selector: ${selector}`);
            break;
          } else {
            logger.info(`❌ Selector ${selector} found elements but no valid business data`);
          }
        } catch (error) {
          logger.info(`❌ Selector ${selector} timed out or failed`);
          continue; // Try next selector
        }
      }

      if (!foundSelector) {
        // Take screenshot for debugging
        try {
          await this.page.screenshot({ 
            path: `/tmp/debug-no-results-${Date.now()}.png`, 
            fullPage: true 
          });
          logger.info('Debug "no results" screenshot saved to /tmp/');
        } catch (screenshotError) {
          logger.error('Failed to save debug screenshot:', screenshotError);
        }
        
        // Save page content for inspection
        const pageContent = await this.page.content();
        logger.error('No valid search results found. Page content saved for debugging.');
        
        throw new Error('No search results found with any known selector');
      }

    } catch (error) {
      logger.error('Failed to find search results:', error);
      throw error;
    }
  }

  private async scrollToLoadResults(maxResults: number): Promise<void> {
    if (!this.page) return;

    const scrollContainer = '[role="main"]';
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrollAttempts = 10;

    while (scrollAttempts < maxScrollAttempts) {
      // Get current results count using flexible selector
      const currentResults = await this.page.evaluate(() => {
        // Try multiple selectors to count results
        const selectors = ['[data-result-index]', 'div[role="article"]', 'a[href*="/place/"]'];
        for (const sel of selectors) {
          const elements = document.querySelectorAll(sel);
          if (elements.length > 0) return elements.length;
        }
        return 0;
      });
      
      if (currentResults >= maxResults) {
        break;
      }

      // Scroll down
      await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        if (element) {
          element.scrollTo(0, element.scrollHeight);
        }
      }, scrollContainer);

      // Wait for new results to load
      await this.page.waitForTimeout(2000);

      // Check if new results loaded
      const newHeight = await this.page.evaluate((selector) => {
        const element = document.querySelector(selector);
        return element ? element.scrollHeight : 0;
      }, scrollContainer);

      if (newHeight === previousHeight) {
        // No new results loaded, try a few more times
        scrollAttempts++;
      } else {
        scrollAttempts = 0; // Reset counter if new results loaded
        previousHeight = newHeight;
      }
    }
  }

  private async extractBusinessData(maxResults: number): Promise<Partial<Business>[]> {
    if (!this.page) return [];

    try {
      // Take a debug screenshot to see current page state
      try {
        await this.page.screenshot({ 
          path: `/tmp/debug-page-${Date.now()}.png`, 
          fullPage: true 
        });
        logger.info('Debug screenshot saved to /tmp/');
      } catch (screenshotError) {
        logger.error('Failed to save debug screenshot:', screenshotError);
      }
      
      // STAP 1: Verzamel bedrijfslinks (flexible selectors)
      const businessLinks = await this.page.evaluate((max) => {
        // Try multiple approaches to find business result containers
        let results = [];
        const selectors = ['div.Nv2PK', 'a.hfpxzc', 'div[role="article"]', '[data-result-index]', '[data-cid]'];
        
        console.log('Testing selectors for business results...');
        for (const selector of selectors) {
          const elements = Array.from(document.querySelectorAll(selector));
          console.log(`Selector "${selector}" found ${elements.length} elements`);
          if (elements.length > 0) {
            results = elements.slice(0, max);
            console.log(`Using selector "${selector}" with ${results.length} results`);
            break;
          }
        }
        const linkData: any[] = [];

        results.forEach((result, index) => {
          try {
            // Zoek naar de hoofdlink van het bedrijf (a.hfpxzc)
            const linkElement = result.querySelector('a.hfpxzc') || 
                               result.querySelector('a[href*="/place/"]');
            
            if (linkElement) {
              const href = linkElement.getAttribute('href');
              const name = linkElement.textContent?.trim() || `Business ${index + 1}`;
              
              if (href) {
                linkData.push({
                  name,
                  detailLink: href.startsWith('http') ? href : `https://maps.google.com${href}`,
                  index
                });
              }
            }
          } catch (error) {
            console.error('Error extracting business link:', error);
          }
        });

        console.log(`Final linkData extracted: ${linkData.length} businesses`);
        return linkData;
      }, maxResults);

      logger.info(`Found ${businessLinks.length} business links to process`);

      // STAP 2 & 3: Bezoek elke detailpagina en haal volledige data op
      const businesses: Partial<Business>[] = [];
      
      for (const linkData of businessLinks) {
        try {
          const businessData = await this.extractDetailedBusinessData(linkData);
          if (businessData) {
            businesses.push(businessData);
          }
          
          // Kleine pauze tussen requests om niet te agressief te zijn
          await this.page.waitForTimeout(1000);
        } catch (error) {
          logger.error(`Failed to extract data for ${linkData.name}:`, error);
          // Continue met volgende bedrijf
        }
      }

      return businesses;
    } catch (error) {
      logger.error('Failed to extract business data:', error);
      return [];
    }
  }

  private async extractDetailedBusinessData(linkData: any): Promise<Partial<Business> | null> {
    if (!this.page) return null;

    try {
      logger.info(`Extracting detailed data for: ${linkData.name}`);
      
      // STAP 2: Bezoek de bedrijfsdetailpagina
      await this.page.goto(linkData.detailLink, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      // Wacht even tot de pagina geladen is
      await this.page.waitForTimeout(2000);

      // Haal gedetailleerde bedrijfsinfo op
      const businessInfo = await this.page.evaluate(() => {
        const data: any = {
          name: '',
          address: '',
          phone: null,
          website: null,
          emails: []
        };

        // Bedrijfsnaam (meestal in h1)
        const nameElement = document.querySelector('h1') || 
                           document.querySelector('[data-attrid="title"]');
        data.name = nameElement?.textContent?.trim() || '';

        // Adres zoeken
        const addressElement = document.querySelector('[data-item-id*="address"]') ||
                              document.querySelector('[aria-label*="Address"]') ||
                              document.querySelector('span[title*="Address"]');
        data.address = addressElement?.textContent?.trim() || '';

        // Telefoon zoeken  
        const phoneElement = document.querySelector('[data-item-id*="phone"]') ||
                            document.querySelector('span[title*="phone"]') ||
                            document.querySelector('a[href^="tel:"]');
        if (phoneElement) {
          data.phone = phoneElement.textContent?.trim() || 
                      phoneElement.getAttribute('href')?.replace('tel:', '') || null;
        }

        // Website link zoeken
        const websiteElement = document.querySelector('[data-item-id*="authority"]') ||
                              document.querySelector('a[href*="http"]:not([href*="google.com"]):not([href*="maps"])') ||
                              document.querySelector('[aria-label*="Website"]');
        if (websiteElement) {
          const href = websiteElement.getAttribute('href');
          if (href && !href.includes('google.com') && !href.includes('maps')) {
            data.website = href;
          }
        }

        return data;
      });

      // STAP 3: Als we een website hebben, zoek daar naar e-mailadressen
      if (businessInfo.website) {
        try {
          const emails = await this.extractEmailsFromWebsite(businessInfo.website);
          businessInfo.emails = emails;
        } catch (error) {
          logger.error(`Failed to extract emails from ${businessInfo.website}:`, error);
        }
      }

      // Return alleen als we minstens naam en adres hebben
      if (businessInfo.name && businessInfo.address) {
        return {
          ...businessInfo,
          source: 'GOOGLE_MAPS',
          extractedAt: new Date()
        };
      }

      return null;
    } catch (error) {
      logger.error(`Error extracting detailed business data:`, error);
      return null;
    }
  }

  private async extractEmailsFromWebsite(website: string): Promise<string[]> {
    if (!this.page) return [];

    try {
      // Ensure URL has protocol
      const url = website.startsWith('http') ? website : `https://${website}`;
      
      logger.info(`Extracting emails from website: ${url}`);
      
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 15000 
      });

      // STRATEGIE: Zoek eerst naar mailto: links (meest betrouwbaar)
      const mailtoEmails = await this.page.evaluate(() => {
        const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
        return mailtoLinks.map(link => {
          const href = link.getAttribute('href') || '';
          return href.replace('mailto:', '').split('?')[0]; // Remove query parameters
        }).filter(email => email.includes('@'));
      });

      if (mailtoEmails.length > 0) {
        logger.info(`Found ${mailtoEmails.length} mailto links`);
        return [...new Set(mailtoEmails)].slice(0, 5);
      }

      // Als geen mailto links, zoek in tekst met regex
      const textEmails = await this.page.evaluate(() => {
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const pageText = document.body.textContent || '';
        const foundEmails = pageText.match(emailRegex) || [];
        
        return [...new Set(foundEmails)]
          .filter(email => !email.includes('example.com'))
          .filter(email => !email.includes('test@'))
          .filter(email => !email.includes('admin@localhost'))
          .slice(0, 3);
      });

      // Probeer ook contact pagina's
      const contactPages = ['/contact', '/contact-us', '/about'];
      const contactEmails: string[] = [];

      for (const contactPath of contactPages) {
        try {
          const contactUrl = new URL(contactPath, url).href;
          await this.page.goto(contactUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 8000 
          });

          const pageEmails = await this.page.evaluate(() => {
            // Eerst mailto links
            const mailtoLinks = Array.from(document.querySelectorAll('a[href^="mailto:"]'));
            const mailtos = mailtoLinks.map(link => {
              const href = link.getAttribute('href') || '';
              return href.replace('mailto:', '').split('?')[0];
            }).filter(email => email.includes('@'));

            if (mailtos.length > 0) return mailtos;

            // Anders regex in tekst
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
            const pageText = document.body.textContent || '';
            return pageText.match(emailRegex) || [];
          });

          contactEmails.push(...pageEmails);
          
          if (contactEmails.length > 0) break; // Stop bij eerste gevonden emails
        } catch (error) {
          continue; // Probeer volgende contact pagina
        }
      }

      // Combineer alle gevonden emails
      const allEmails = [...mailtoEmails, ...textEmails, ...contactEmails];
      const uniqueEmails = [...new Set(allEmails)]
        .filter(email => email.includes('@'))
        .slice(0, 5);

      logger.info(`Found ${uniqueEmails.length} emails from ${url}`);
      return uniqueEmails;

    } catch (error) {
      logger.error(`Error extracting emails from ${website}:`, error);
      return [];
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      logger.info('Browser closed successfully');
    } catch (error) {
      logger.error('Error closing browser:', error);
    }
  }
}

export class EmailScraper {
  private browser: Browser | null = null;
  private page: Page | null = null;

  async initialize(): Promise<void> {
    try {
      this.browser = await chromium.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage'
        ]
      });
      
      this.page = await this.browser.newPage();
      await this.page.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      });
      
      logger.info('Email scraper initialized');
    } catch (error) {
      logger.error('Failed to initialize email scraper:', error);
      throw error;
    }
  }

  async extractEmails(website: string): Promise<string[]> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      // Ensure URL has protocol
      const url = website.startsWith('http') ? website : `https://${website}`;
      
      logger.info('Extracting emails from website', { url });
      
      await this.page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      // Extract emails from page content
      const emails = await this.page.evaluate(() => {
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const pageText = document.body.textContent || '';
        const foundEmails = pageText.match(emailRegex) || [];
        
        // Remove duplicates and filter out common false positives
        const uniqueEmails = [...new Set(foundEmails)]
          .filter(email => !email.includes('example.com'))
          .filter(email => !email.includes('test@'))
          .filter(email => !email.includes('admin@localhost'));
        
        return uniqueEmails;
      });

      // Also check common contact page URLs
      const contactUrls = [
        '/contact',
        '/contact-us',
        '/about',
        '/about-us',
        '/team'
      ];

      for (const contactPath of contactUrls) {
        try {
          const contactUrl = new URL(contactPath, url).href;
          await this.page.goto(contactUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 10000 
          });

          const contactEmails = await this.page.evaluate(() => {
            const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
            const pageText = document.body.textContent || '';
            return pageText.match(emailRegex) || [];
          });

          emails.push(...contactEmails);
        } catch (error) {
          // Continue if contact page doesn't exist
          continue;
        }
      }

      // Remove duplicates from final result
      const uniqueEmails = [...new Set(emails)]
        .filter(email => !email.includes('example.com'))
        .filter(email => !email.includes('test@'))
        .slice(0, 10); // Limit to 10 emails

      logger.info('Email extraction completed', { 
        url, 
        found: uniqueEmails.length 
      });

      return uniqueEmails;
    } catch (error) {
      logger.error('Email extraction failed:', { url: website, error: error.message });
      return [];
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      logger.info('Email scraper closed');
    } catch (error) {
      logger.error('Error closing email scraper:', error);
    }
  }
}