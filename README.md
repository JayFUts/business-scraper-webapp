# 🗺️ Business Scraper

A powerful web application to extract business information from Google Maps search results.

## Features

- **🔍 Smart Search**: Extract 50+ businesses from any Google Maps search
- **📧 Email Discovery**: Automatically finds email addresses by visiting business websites
- **📊 Export Options**: Download results as CSV or JSON
- **📱 Responsive Design**: Works perfectly on desktop and mobile
- **⚡ Real-time Updates**: Live progress tracking during scraping

## How It Works

1. Enter your search query (e.g., "restaurants in Amsterdam")
2. The scraper automatically scrolls through Google Maps results
3. Visits each business page to collect detailed information
4. Scrapes business websites to find email addresses
5. Exports clean, structured data

## Data Collected

- Business Name
- Full Address
- Phone Number
- Email Address (when available)
- Website URL

## Tech Stack

- **Backend**: Node.js, Express.js, Playwright
- **Frontend**: Vanilla JavaScript, Modern CSS
- **Deployment**: Railway, Docker
- **Browser Automation**: Chromium via Playwright

## Local Development

```bash
npm install
npm start
```

Visit `http://localhost:3000`

## Deployment

This app is configured for easy deployment on Railway with automatic Docker builds.

---

⚡ **Powered by Playwright & Google Maps**