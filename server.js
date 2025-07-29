const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { chromium } = require('playwright');
const session = require('express-session');
const path = require('path');

// Import our modules
const { user, usage } = require('./database');
const { generateToken, requireAuth, optionalAuth } = require('./auth');

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

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// CORS and JSON middleware
app.use(cors({
  credentials: true,
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://app.leadfinders.nl', 'https://business-scraper-webapp-production-1bdd.up.railway.app']
    : 'http://localhost:3000'
}));
app.use(express.json());

// Serve static files
app.use(express.static('public'));

// Store active scraping sessions
const activeSessions = new Map();

// ==================== AUTH ENDPOINTS ====================

// Register endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await user.findUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create user
    const newUser = await user.createUser(email, password);
    const token = generateToken(newUser.id);

    // Set session
    req.session.token = token;
    req.session.userId = newUser.id;

    res.json({
      success: true,
      user: {
        id: newUser.id,
        email: newUser.email,
        credits: newUser.credits
      },
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const userData = await user.findUserByEmail(email);
    if (!userData || !user.verifyPassword(password, userData.password_hash)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(userData.id);

    // Set session
    req.session.token = token;
    req.session.userId = userData.id;

    res.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        credits: userData.credits
      },
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
  req.session.destroy();
  res.json({ success: true });
});

// Get current user
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      credits: req.user.credits
    }
  });
});

// Get user usage history
app.get('/api/user/history', requireAuth, async (req, res) => {
  try {
    const history = await usage.getUsageHistory(req.user.id, 20);
    res.json({ history });
  } catch (error) {
    console.error('History error:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});

// ==================== PAYMENT ENDPOINTS ====================

// Create a pending purchase record
app.post('/api/payments/create-purchase', requireAuth, async (req, res) => {
  try {
    const { credits, amount, email } = req.body;
    
    // Validate the payment matches our €10 package
    if (amount !== 10 || credits !== 100) {
      return res.status(400).json({ error: 'Invalid payment package' });
    }

    const purchaseId = Date.now().toString() + '_' + req.user.id;
    
    // Store pending purchase in database
    const db = require('sqlite3').verbose();
    const database = new db.Database('./leadfinders.db');
    
    await new Promise((resolve, reject) => {
      database.run(`
        INSERT INTO purchases (id, user_id, credits, amount, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', datetime('now'))
      `, [purchaseId, req.user.id, credits, amount], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    
    database.close();
    
    res.json({ purchaseId });
  } catch (error) {
    console.error('Create purchase error:', error);
    res.status(500).json({ error: 'Failed to create purchase' });
  }
});

// Complete purchase and add credits (called from success page)
app.post('/api/payments/complete-purchase', requireAuth, async (req, res) => {
  try {
    const { purchaseId, sessionId } = req.body;
    
    if (!purchaseId) {
      return res.status(400).json({ error: 'Purchase ID required' });
    }

    const db = require('sqlite3').verbose();
    const database = new db.Database('./leadfinders.db');
    
    // Get purchase details
    const purchase = await new Promise((resolve, reject) => {
      database.get(`
        SELECT * FROM purchases 
        WHERE id = ? AND user_id = ? AND status = 'pending'
      `, [purchaseId, req.user.id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!purchase) {
      database.close();
      return res.status(404).json({ error: 'Purchase not found or already completed' });
    }
    
    // Mark purchase as completed
    await new Promise((resolve, reject) => {
      database.run(`
        UPDATE purchases 
        SET status = 'completed', stripe_session_id = ?, completed_at = datetime('now')
        WHERE id = ?
      `, [sessionId || null, purchaseId], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
    
    database.close();
    
    // Add credits to user
    await user.addCredits(req.user.id, purchase.credits);
    
    // Get updated user data
    const updatedUser = await user.findUserById(req.user.id);
    
    res.json({ 
      success: true, 
      creditsAdded: purchase.credits,
      totalCredits: updatedUser.credits
    });
    
  } catch (error) {
    console.error('Complete purchase error:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

// ==================== SCRAPING ENDPOINTS ====================

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
app.post('/api/scrape', requireAuth, async (req, res) => {
  try {
    const { searchQuery } = req.body;
    
    if (!searchQuery) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    // Check if user has enough credits (10 credits per scrape)
    const creditsRequired = 10;
    if (req.user.credits < creditsRequired) {
      return res.status(402).json({ 
        error: 'Insufficient credits', 
        required: creditsRequired,
        available: req.user.credits 
      });
    }

    // Deduct credits first
    try {
      await user.deductCredits(req.user.id, creditsRequired);
    } catch (error) {
      return res.status(402).json({ error: 'Failed to deduct credits' });
    }
    
    const sessionId = Date.now().toString();
    activeSessions.set(sessionId, { 
      status: 'Starting scraping...', 
      results: null,
      startTime: new Date(),
      userId: req.user.id,
      searchQuery: searchQuery
    });
    
    // Start scraping in background
    scrapeBusinesses(searchQuery, sessionId)
      .then(async (results) => {
        activeSessions.get(sessionId).results = results;
        activeSessions.get(sessionId).status = 'Completed';
        
        // Record usage
        await usage.recordUsage(
          req.user.id, 
          searchQuery, 
          creditsRequired, 
          results.length, 
          sessionId
        );
      })
      .catch(async (error) => {
        activeSessions.get(sessionId).status = `Error: ${error.message}`;
        
        // Refund credits on error
        await user.addCredits(req.user.id, creditsRequired);
        console.log(`Refunded ${creditsRequired} credits to user ${req.user.id} due to error`);
      });
    
    res.json({ 
      sessionId, 
      status: 'Scraping started',
      creditsUsed: creditsRequired,
      creditsRemaining: req.user.credits - creditsRequired
    });

  } catch (error) {
    console.error('Scrape endpoint error:', error);
    res.status(500).json({ error: 'Scraping failed' });
  }
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