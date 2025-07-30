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

# Access local development
# Visit http://localhost:3000
```

## Architecture Overview

### Core Components

**Server Architecture (server.js)**
- Express.js application with comprehensive middleware stack
- Rate limiting: 10 requests per 15 minutes on `/api/scrape`
- Session-based authentication with JWT tokens
- CORS configured for production domains (app.leadfinders.nl)
- In-memory session storage using Map for active scraping sessions

**Authentication System (auth.js + database.js)**
- JWT-based authentication with 7-day token expiry
- SQLite database with three main tables: `users`, `purchases`, `usage_history`
- Credit system: Users start with 0 credits, purchase via Stripe
- Session middleware stores tokens in both cookies and session storage

**Database Schema (database.js)**
```sql
users: id, email, password_hash, credits, created_at, updated_at
purchases: id (TEXT), user_id, credits, amount, stripe_session_id, status, created_at, completed_at  
usage_history: id, user_id, search_query, credits_used, results_count, session_id, created_at
```

**Scraping Engine (server.js:266-456)**
- Uses Playwright with headless Chromium
- Handles Dutch cookie consent ("Voordat je verdergaat naar Google")
- Scrolls Google Maps feed 10 times to load 50+ businesses
- Two-phase extraction: Maps data + website email scraping
- Progress tracking via `updateSessionStatus()` function

### Frontend Architecture

**Main Application (public/index.html + script.js)**
- Single-page application with auth-gated access
- Two main sections: `#authSection` (login/register) and `#appSection` (scraper)
- Real-time credit tracking and updates
- Modal-based credit purchase flow

**Payment Integration (script.js:434-475)**
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
- `GET /api/status/:sessionId` - Check scraping progress
- `GET /api/export/:sessionId/:format` - Export results (CSV/JSON)

**Payments**
- `POST /api/payments/create-purchase` - Create pending purchase record
- `POST /api/payments/complete-purchase` - Complete purchase and add credits

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
- Health check on port 3000

**Railway Deployment**
- Auto-deployment from GitHub main branch
- Production CORS origins: `app.leadfinders.nl` and Railway URL
- Environment variables: `SESSION_SECRET`, `JWT_SECRET`, `NODE_ENV`

### Data Flow

1. **User Registration/Login** → JWT token stored in session + cookies
2. **Credit Purchase** → Redirect to Stripe → Success page → Credits added to database
3. **Scraping Request** → Auth check → Credit validation → Credit deduction → Browser automation
4. **Progress Updates** → In-memory session tracking → Polled by frontend every 2s
5. **Results** → Stored in session Map → Available for export

### Important Implementation Details

- **Cookie Consent Handling**: Specifically handles Dutch Google consent page
- **Email Extraction**: Two-tier approach (Maps page first, then business website)
- **Session Management**: Uses both JWT tokens and Express sessions for flexibility
- **Error Handling**: Credits are refunded on scraping failures
- **Rate Limiting**: Applied specifically to scraping endpoint only
- **Security**: Helmet middleware, input validation, CORS restrictions

### Database File Location

SQLite database is stored as `leadfinders.db` in the project root. This file contains all user data, credits, and purchase history.