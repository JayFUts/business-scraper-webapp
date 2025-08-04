# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google Maps business scraper web application with authentication and credit-based payment system. Users can scrape 50+ businesses from Google Maps searches, with automatic email extraction by visiting business websites. The app uses a credit system where 1 search costs 10 credits (€1).

## Development Commands

```bash
# Start development server with auto-reload
npm run dev

# Start production server
npm start

# Install dependencies (required after cloning)
npm install

# Run simple scraper test without authentication
node simple-test.js

# Access local development
# Visit http://localhost:3000
```

## Architecture Overview

### Core Components

**Server Architecture (server.js)**
- Express.js application with comprehensive middleware stack
- Trust proxy enabled for Railway deployment (`app.set('trust proxy', 1)`)
- Rate limiting: 10 requests per 15 minutes on `/api/scrape`
- Session-based authentication with JWT tokens
- CORS configured for production domains (app.leadfinders.nl)
- In-memory session storage using Map for active scraping sessions
- Port 8080 in production (Railway), 3000 in development

**Authentication System (auth.js + database.js)**
- JWT-based authentication with 7-day token expiry
- SQLite database with three main tables: `users`, `purchases`, `usage_history`
- Credit system: Users start with 0 credits, purchase via Stripe
- Session middleware stores tokens in both cookies and session storage
- Test account available: `stripetest@example.com` / `test123456`

**Database Schema (database.js)**
```sql
users: id, email, password_hash, credits, created_at, updated_at
purchases: id (TEXT), user_id, credits, amount, stripe_session_id, status, created_at, completed_at  
usage_history: id, user_id, search_query, credits_used, results_count, session_id, created_at
sent_emails: id, user_id, recipient_email, business_name, subject, body, sent_at, status
search_results: id, user_id, session_id, search_query, results_data, results_count, created_at
user_settings: id, user_id, company_name, company_description, services, contact_person, email_signature, company_logo, email_config, updated_at
```

**Scraping Engine (server.js:580-900+)**
- Uses Playwright with headless Chromium and performance optimizations
- **Performance**: 65-70% faster than original (1.5-2 min vs 4-6 min)
- **Parallel Processing**: 2 concurrent browser tabs for business processing
- **Smart Scrolling**: Dynamic scrolling with early termination when target reached
- **Cookie Consent**: Handles Dutch Google consent ("Voordat je verdergaat naar Google") in parallel tabs
- **Progressive Delays**: Minimal delays (10ms per business) to avoid rate limiting
- **Email Extraction**: Two-tier approach (Maps page first, then business website)
- **Improved Selectors**: Multiple CSS selectors for reliable data extraction
- Progress tracking via `updateSessionStatus()` function with real-time updates

### Frontend Architecture

**Landing Page (public/landing.html + landing.js)**
- Modern Framer/Webflow-style design with animations
- Hero section, features showcase, pricing information
- Smooth scroll, parallax effects, intersection observer animations
- Serves as default route for non-authenticated users

**Dashboard Application (public/index.html + modern-dashboard.js)**
- Single-page application with sidebar navigation
- Five main sections: Search, History, Results, Emails Sent, Settings
- **Persistent Data**: All tabs load data from database on login (search history, sent emails, user settings)
- **Export Functionality**: CSV, JSON, and Excel export with SheetJS library
- **Email Integration**: Direct email sending with Gmail/Outlook SMTP configuration
- **Real-time Updates**: Credit tracking, scraping progress, and status messages
- **Settings Persistence**: Company info, email signatures, and SMTP configs saved to database

**Modern UI System (modern-dashboard.css)**
- CSS variables for consistent theming
- Glass morphism effects and gradient backgrounds
- Responsive grid layouts and mobile-first design
- Custom animations (slideInUp, fadeIn, pulse)

**Payment Integration**
- Uses real Stripe payment link: `https://buy.stripe.com/14AdR89kIbVBgAPbxF7AI00`
- Creates pending purchase records before redirecting to Stripe
- Success page (`payment-success.html`) completes purchase and adds credits
- Only supports €10 package (100 credits) currently

### Key API Endpoints

**Authentication**
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login  
- `POST /api/auth/logout` - Session cleanup
- `GET /api/auth/me` - Get current user info

**Scraping**  
- `POST /api/scrape` - Start scraping (requires auth, deducts 10 credits)
  - Request body: `{ searchQuery: string }`
  - Response: `{ sessionId, status, creditsUsed, creditsRemaining }`
- `GET /api/status/:sessionId` - Check scraping progress
  - Response: `{ status, message, progress, results, hasResults }`
- `GET /api/export/:sessionId/:format` - Export results (CSV/JSON)

**Payments**
- `POST /api/payments/create-purchase` - Create pending purchase record
- `POST /api/payments/complete-purchase` - Complete purchase and add credits

**Email System**
- `GET /api/email/providers` - Get available email providers (Gmail, Outlook, Custom SMTP)
- `POST /api/email/verify` - Verify email configuration with test connection
- `POST /api/email/send` - Send email directly from dashboard
- `GET /api/email/history` - Get sent email history for user

**Data Persistence**
- `GET /api/search-results` - Get user's saved search history
- `POST /api/user-settings` - Save user settings (company info, email config)
- `GET /api/user-settings` - Get user settings

### Credit System Logic

- **Cost**: 10 credits per search (€1)
- **Purchase**: €10 = 100 credits via Stripe
- **Validation**: Credits checked before scraping starts
- **Deduction**: Credits deducted immediately when scraping begins
- **Refund**: Credits refunded if scraping fails with error

### Deployment Configuration

**Docker (Dockerfile)**
- Node.js 18 slim base image
- Playwright Chromium installation with system dependencies
- Two-stage copy: package files first (for layer caching), then application code
- Health check on port 8080

**Railway Deployment (railway.toml)**
- Auto-deployment from GitHub main branch
- Production CORS origins: `app.leadfinders.nl` and Railway URL
- Environment variables: `SESSION_SECRET`, `JWT_SECRET`, `NODE_ENV=production`
- Custom domain requires CNAME DNS record pointing to Railway URL
- SSL certificates auto-generated by Railway for custom domains

### Data Flow

1. **User Registration/Login** → JWT token stored in session + cookies → Load persistent data (search history, sent emails, settings)
2. **Credit Purchase** → Redirect to Stripe → Success page → Credits added to database
3. **Scraping Request** → Auth check → Credit validation → Credit deduction → Parallel browser automation → Results saved to database
4. **Progress Updates** → In-memory session tracking → Frontend polls every 2s with friendly status messages
5. **Results Storage** → Auto-saved to `search_results` table → Available in History and Results tabs → Export as CSV/JSON/Excel
6. **Email Integration** → SMTP config stored in `user_settings` → Direct sending → History saved to `sent_emails` table

### Important Implementation Details

- **Performance Optimization**: 65-70% faster scraping through parallel processing and reduced wait times
- **Cookie Consent Handling**: Handles Dutch Google consent in multiple parallel tabs independently
- **Data Persistence**: All user data (searches, emails, settings) automatically saved to SQLite database
- **Email Integration**: Full SMTP support for Gmail/Outlook with app-specific passwords, direct sending from dashboard
- **Export System**: Professional Excel exports using SheetJS with multiple worksheets and formatting
- **Email Extraction**: Enhanced two-tier approach with multiple CSS selectors for better reliability
- **Session Management**: Uses both JWT tokens and Express sessions for flexibility
- **Error Handling**: Credits refunded on scraping failures, graceful fallbacks for export functions
- **Rate Limiting**: Smart progressive delays to avoid Google Maps rate limiting
- **Security**: Helmet middleware, input validation, CORS restrictions, secure password storage
- **Status Messages**: Real-time progress updates with friendly messages and emojis
- **Responsive Design**: Mobile-first approach with glass morphism effects and smooth animations

### Database File Location

SQLite database is stored as `leadfinders.db` in the project root. This file contains all user data, credits, and purchase history.

### Testing

**Simple Scraper Test**
```bash
node simple-test.js
```
This runs a standalone scraper test with visible browser window, useful for debugging scraping issues without authentication.

### Key Dependencies

- **nodemailer** - SMTP email sending functionality
- **SheetJS (xlsx)** - Professional Excel file generation (loaded via CDN in frontend)
- **email-config.js** - Email provider configurations and SMTP handling
- **database.js** - Complete database abstraction with functions for users, purchases, usage, emails, search results, and settings