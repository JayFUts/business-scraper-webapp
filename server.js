const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { chromium } = require('playwright');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false // Allow inline scripts for simplicity
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  message: 'Too many scraping requests, please try again later.'
});

app.use('/api/scrape', limiter);

// CORS and JSON middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Store active scraping sessions
const activeSessions = new Map();

// Main scraping function (converted from Electron version)
async function scrapeBusinesses(searchQuery, sessionId) {
  const browser = await chromium.launch({ 
    headless: true, // Always headless in production
    args: [
      '--no-sandbox', 
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu'
    ]
  });
  
  const page = await browser.newPage();
  
  // Set user agent
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
  });
  
  try {
    // Update status
    updateSessionStatus(sessionId, 'Opening Google Maps...');
    
    // Go directly to search URL
    const searchUrl = `https://www.google.com/maps/search/${encodeURIComponent(searchQuery)}`;
    await page.goto(searchUrl, { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    await page.waitForTimeout(3000);
    
    // Handle consent if it appears
    updateSessionStatus(sessionId, 'Checking for cookie consent...');
    
    const isConsentPage = await page.evaluate(() => {
      return document.body?.textContent?.includes('Voordat je verdergaat naar Google');
    });
    
    if (isConsentPage) {
      updateSessionStatus(sessionId, 'Handling cookie consent...');
      
      const acceptButton = await page.$('input[type="submit"][value="Alles accepteren"]');
      if (acceptButton) {
        await acceptButton.click();
        updateSessionStatus(sessionId, 'Clicked accept button, waiting for redirect...');
        await page.waitForTimeout(5000);
      } else {
        const rejectButton = await page.$('input[type="submit"][value="Alles afwijzen"]');
        if (rejectButton) {
          await rejectButton.click();
          await page.waitForTimeout(5000);
        }
      }
    }
    
    updateSessionStatus(sessionId, 'Waiting for results to load...');
    await page.waitForTimeout(5000);
    
    // Scroll to load more businesses
    updateSessionStatus(sessionId, 'Loading more businesses by scrolling...');
    
    const feed = await page.$('div[role="feed"]');
    if (feed) {
      for (let i = 0; i < 10; i++) {
        updateSessionStatus(sessionId, `Scrolling to load more results... (${i + 1}/10)`);
        
        await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          if (feed) {
            feed.scrollTo(0, feed.scrollHeight);
          }
        });
        
        await page.waitForTimeout(3000);
        
        const currentCount = await page.evaluate(() => {
          const feed = document.querySelector('div[role="feed"]');
          return feed ? feed.querySelectorAll('a[href*="/maps/place/"]').length : 0;
        });
        
        console.log(`After scroll ${i + 1}: Found ${currentCount} businesses`);
        
        if (i > 3 && currentCount >= 50) {
          console.log(`Found ${currentCount} businesses - target of 50+ reached`);
          break;
        }
        
        if (i > 5 && currentCount < 20) {
          console.log('Not finding many new results, stopping scroll');
          break;
        }
      }
    }
    
    // Extract businesses
    updateSessionStatus(sessionId, 'Extracting business listings...');
    
    const businesses = await page.evaluate(() => {
      const businessSet = new Set();
      const results = [];

      const feed = document.querySelector('div[role="feed"]');
      
      if (feed) {
        console.log('Found results feed');
        const links = feed.querySelectorAll('a[href*="/maps/place/"]');
        console.log(`Found ${links.length} business links in feed`);
        
        links.forEach((link, index) => {
          if (index < 75) {
            const name = link.getAttribute('aria-label');
            const url = link.href;
            
            if (name && url && !businessSet.has(name)) {
              businessSet.add(name);
              results.push({ name, url });
            }
          }
        });
      } else {
        console.log('Feed not found, trying fallback selectors');
        const selectors = [
          'a.hfpxzc',
          'a[href*="/maps/place/"]'
        ];
        
        for (const selector of selectors) {
          const links = document.querySelectorAll(selector);
          if (links.length > 0) {
            console.log(`Found ${links.length} elements with selector: ${selector}`);
            
            for (let i = 0; i < Math.min(links.length, 75); i++) {
              const link = links[i];
              if (link.href && link.href.includes('/maps/place/')) {
                const name = link.getAttribute('aria-label') || 
                           link.textContent?.trim() || 
                           `Business ${i + 1}`;
                
                if (!businessSet.has(name)) {
                  businessSet.add(name);
                  results.push({ name, url: link.href });
                }
              }
            }
            break;
          }
        }
      }
      
      console.log('Results found:', results.length);
      return results;
    });
    
    // Get details for each business
    updateSessionStatus(sessionId, `Processing ${businesses.length} businesses...`);
    const detailedResults = [];
    
    for (let i = 0; i < Math.min(businesses.length, 50); i++) {
      const business = businesses[i];
      updateSessionStatus(sessionId, `Getting details for ${business.name} (${i+1}/${Math.min(businesses.length, 50)})...`);
      
      try {
        await page.goto(business.url, { 
          waitUntil: 'domcontentloaded',
          timeout: 15000 
        });
        await page.waitForTimeout(2000);
        
        const details = await page.evaluate(() => {
          const data = {
            name: document.querySelector('h1')?.textContent || '',
            address: document.querySelector('[data-item-id*="address"]')?.textContent || '',
            phone: document.querySelector('[data-item-id*="phone"]')?.textContent || 
                    document.querySelector('button[data-item-id*="phone"]')?.textContent || '',
            website: null,
            email: null
          };
          
          // Look for website
          const websiteSelectors = [
            'a[data-item-id*="authority"]',
            'a[href*="http"]:not([href*="google"]):not([href*="maps"])',
            'button[data-item-id*="authority"]'
          ];
          
          for (const selector of websiteSelectors) {
            const el = document.querySelector(selector);
            if (el) {
              const href = el.getAttribute('href') || el.getAttribute('data-url');
              if (href) {
                const urlMatch = href.match(/[?&]q=([^&]+)/);
                data.website = urlMatch ? decodeURIComponent(urlMatch[1]) : href;
                break;
              }
            }
          }
          
          // Look for email on Maps page
          const pageText = document.body.textContent || '';
          const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
          const emailMatches = pageText.match(emailRegex);
          
          if (emailMatches && emailMatches.length > 0) {
            const filteredEmails = emailMatches.filter(email => 
              !email.includes('noreply') && 
              !email.includes('no-reply') &&
              !email.includes('support@google') &&
              !email.includes('maps-noreply')
            );
            
            if (filteredEmails.length > 0) {
              data.email = filteredEmails[0];
            }
          }
          
          return data;
        });
        
        // If no email found on Maps page and website is available, try to scrape the website
        if (!details.email && details.website) {
          updateSessionStatus(sessionId, `Checking website for ${business.name}...`);
          
          try {
            let websiteUrl = details.website;
            if (!websiteUrl.startsWith('http')) {
              websiteUrl = 'https://' + websiteUrl;
            }
            
            await page.goto(websiteUrl, { 
              waitUntil: 'domcontentloaded',
              timeout: 10000 
            });
            await page.waitForTimeout(2000);
            
            const websiteEmail = await page.evaluate(() => {
              const pageText = document.body.textContent || '';
              const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
              const emailMatches = pageText.match(emailRegex);
              
              if (emailMatches && emailMatches.length > 0) {
                const filteredEmails = emailMatches.filter(email => 
                  !email.includes('noreply') && 
                  !email.includes('no-reply') &&
                  !email.includes('support@google') &&
                  !email.includes('maps-noreply') &&
                  !email.includes('example.com') &&
                  !email.includes('test@')
                );
                
                const priorityEmails = filteredEmails.filter(email =>
                  email.includes('info@') || 
                  email.includes('contact@') ||
                  email.includes('hello@') ||
                  email.includes('reservations@') ||
                  email.includes('booking@')
                );
                
                return priorityEmails.length > 0 ? priorityEmails[0] : 
                       (filteredEmails.length > 0 ? filteredEmails[0] : null);
              }
              
              return null;
            });
            
            if (websiteEmail) {
              details.email = websiteEmail;
              console.log(`Found email on website for ${business.name}: ${websiteEmail}`);
            }
            
          } catch (websiteError) {
            console.log(`Failed to scrape website for ${business.name}:`, websiteError.message);
          }
        }
        
        detailedResults.push({ ...business, ...details });
      } catch (error) {
        console.log(`Failed to get details for ${business.name}:`, error.message);
        detailedResults.push(business);
      }
    }
    
    updateSessionStatus(sessionId, 'Scraping completed!');
    return detailedResults;
    
  } catch (error) {
    updateSessionStatus(sessionId, `Error: ${error.message}`);
    throw error;
  } finally {
    await browser.close();
  }
}

// Helper function to update session status
function updateSessionStatus(sessionId, status) {
  if (activeSessions.has(sessionId)) {
    activeSessions.get(sessionId).status = status;
    console.log(`Session ${sessionId}: ${status}`);
  }
}

// API Routes
app.post('/api/scrape', async (req, res) => {
  const { searchQuery } = req.body;
  
  if (!searchQuery) {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  const sessionId = Date.now().toString();
  activeSessions.set(sessionId, { 
    status: 'Starting scraping...', 
    results: null,
    startTime: new Date()
  });
  
  // Start scraping in background
  scrapeBusinesses(searchQuery, sessionId)
    .then(results => {
      activeSessions.get(sessionId).results = results;
      activeSessions.get(sessionId).status = 'Completed';
    })
    .catch(error => {
      activeSessions.get(sessionId).status = `Error: ${error.message}`;
    });
  
  res.json({ sessionId, status: 'Scraping started' });
});

// Get scraping status
app.get('/api/status/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json({
    status: session.status,
    results: session.results,
    hasResults: session.results !== null
  });
});

// Export results as CSV
app.get('/api/export/:sessionId/csv', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (!session || !session.results) {
    return res.status(404).json({ error: 'No results found' });
  }
  
  const csv = 'Name,Address,Phone,Email,Website\n' + 
    session.results.map(r => `"${r.name}","${r.address || ''}","${r.phone || ''}","${r.email || ''}","${r.website || ''}"`).join('\n');
  
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="businesses.csv"');
  res.send(csv);
});

// Export results as JSON
app.get('/api/export/:sessionId/json', (req, res) => {
  const { sessionId } = req.params;
  const session = activeSessions.get(sessionId);
  
  if (!session || !session.results) {
    return res.status(404).json({ error: 'No results found' });
  }
  
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="businesses.json"');
  res.json(session.results);
});

// Clean up old sessions (every hour)
setInterval(() => {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.startTime < oneHourAgo) {
      activeSessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

// Start server
app.listen(PORT, () => {
  console.log(`Business Scraper Server running on port ${PORT}`);
});