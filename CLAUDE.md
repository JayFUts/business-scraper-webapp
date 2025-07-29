# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Google Maps business scraper web application that extracts business information including names, addresses, phone numbers, emails, and websites. The application uses Playwright for web automation and serves a simple HTML/CSS/JavaScript frontend.

## Architecture

The project has two distinct implementations:

1. **Simple Web App (Primary)**: Single-file Express.js server (`server.js`) with static frontend in `public/`
2. **Complex SaaS Platform**: Full TypeScript microservices architecture in `backend/` and `frontend/` directories (appears to be unused/legacy)

The primary application is the simple web app that runs directly from the root directory.

## Development Commands

```bash
# Start the application (production mode)
npm start

# Start with hot reloading (development mode)
npm run dev

# Install dependencies
npm install
```

The server runs on port 3000 locally, but uses `process.env.PORT` in production (Railway sets this to 8080).

## Core Functionality

### Scraping Process
The main scraping logic in `server.js` follows this flow:
1. Navigate to Google Maps search results
2. Handle cookie consent (Dutch locale specific)
3. Scroll through results feed (`div[role="feed"]`) to load more businesses (up to 10 scrolls, targeting 50+ results)
4. Extract business links using `a[href*="/maps/place/"]` selectors
5. Visit each business page to collect detailed information
6. Scrape business websites for email addresses (with priority filtering for info@, contact@, etc.)

### API Endpoints
- `POST /api/scrape` - Start scraping job (rate limited to 10 requests per 15 minutes)
- `GET /api/status/:sessionId` - Get scraping progress and results
- `GET /api/export/:sessionId/csv` - Export results as CSV
- `GET /api/export/:sessionId/json` - Export results as JSON

### Session Management
Uses in-memory Map for active scraping sessions with automatic cleanup after 1 hour.

## Key Selectors and Anti-Detection

### Google Maps Selectors
- Results feed: `div[role="feed"]`
- Business links: `a[href*="/maps/place/"]`
- Business name: `aria-label` attribute on links
- Address: `[data-item-id*="address"]`
- Phone: `[data-item-id*="phone"]` or `button[data-item-id*="phone"]`
- Website: `a[data-item-id*="authority"]`

### Email Extraction
- Regex pattern: `/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g`
- Filters out: noreply, no-reply, support@google, maps-noreply, example.com, test@
- Prioritizes: info@, contact@, hello@, reservations@, booking@

### Browser Configuration
Chromium is launched with specific args for cloud deployment:
- `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-dev-shm-usage`, `--disable-gpu`
- Custom User-Agent string for better compatibility
- Always headless: true in production

## Deployment

### Railway Deployment
- Uses Dockerfile with Node.js 18-slim base image
- Playwright and Chromium dependencies are installed during build
- Configured via `railway.toml` with health checks
- Port automatically detected by Railway (typically 8080)

### Docker Configuration
The Dockerfile installs system dependencies required for Playwright:
- wget, gnupg, ca-certificates, procps, libxss1
- Runs `npx playwright install chromium` and `npx playwright install-deps chromium`

### Legacy Architecture (Unused)
The `backend/` and `frontend/` directories contain a more complex TypeScript-based architecture with MongoDB, Redis, job queues, and Next.js frontend. This appears to be legacy code as the active deployment uses only the simple Express server.

## Rate Limiting and Security

- Express rate limiter: 10 requests per 15 minutes on `/api/scrape`
- Helmet.js for security headers (CSP disabled for inline scripts)
- CORS enabled for cross-origin requests
- Session cleanup prevents memory leaks in long-running processes

## Frontend

Simple vanilla JavaScript application in `public/`:
- Real-time progress updates via polling `/api/status/:sessionId`
- Progress bar with detailed status messages
- Export functionality for CSV/JSON downloads
- Mobile-responsive design with CSS Grid

## Error Handling

The scraper includes fallback mechanisms:
- Multiple selector strategies if primary feed selector fails
- Graceful degradation when business websites are unreachable
- Session timeout and cleanup mechanisms
- Continue processing even if individual businesses fail