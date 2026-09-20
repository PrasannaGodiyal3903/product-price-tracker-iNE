# Product Price Tracker (Web Scraping)

A full-stack, production-ready Product Price Tracker built for the INE Software Engineer Intern Assignment. Automatically tracks, scrapes, and visualizes price and stock fluctuations from the INE Mock Store (`https://demo.inelabteamdev.com/`).

---

## Table of Contents
1. [Overview & Features](#overview--features)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Local Setup & Installation](#local-setup--installation)
4. [Database Setup (Supabase PostgreSQL)](#database-setup-supabase-postgresql)
5. [Environment Variables](#environment-variables)
6. [Running the Application](#running-the-application)
7. [Running the Test Suite](#running-the-test-suite)
8. [Running the Headed Scraper Demo](#running-the-headed-scraper-demo)
9. [Scheduled Scraping (cron-job.org)](#scheduled-scraping-cron-joborg)
10. [Deployment Guide (Vercel & Render)](#deployment-guide-vercel--render)
11. [API Endpoints](#api-endpoints)
12. [Scraping Reliability & Decoy Handling](#scraping-reliability--decoy-handling)

---

## Overview & Features

- **Product Catalog Search**: Real-time search against the INE storefront by product name, brand, or category.
- **Automated Scraping**: Automated Playwright scraper that satisfies the store's human-interaction proof-of-work (cursor hover tracking & WebAssembly token challenge).
- **Decoy Immunity**: Filters out hidden decoy elements (`span.price-value` with `display: none` and `[data-price="true"]`) and extracts the genuine visible price.
- **Price & Stock Normalization**: Handles diverse formatting variants (Euro decimals, Indian commas, spaced numbers, trailing tax notices, and fullwidth Unicode digits).
- **Strict Data Integrity**: Invalid, empty, or failed scrape results are **never** stored in price history.
- **Audit Logging**: Every attempt is logged honestly in `scrape_logs` with attempt number, duration, error classification, and status (`SUCCESS`, `RETRY`, `FAILED`).
- **Interactive Dashboard**: Responsive React + Vite + Tailwind CSS dashboard with interactive Recharts price history curves and audit log tables.
- **Headed Demonstration Mode**: Visual runner (`npm run scraper:headed`) for screen recordings and interview evaluations.

---

## Architecture & Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Recharts, Lucide Icons.
- **Backend**: Node.js, Express, TypeScript, Playwright (Chromium).
- **Database**: Supabase PostgreSQL (with automatic local fallback for zero-config testing).
- **Scheduler**: External HTTP webhook triggered every 2 hours via `cron-job.org`.

---

## Local Setup & Installation

### Prerequisites
- Node.js v18+ (Node v20 or v22 recommended)
- npm v9+

### 1. Clone & Install Dependencies
```bash
# From the repository root:
npm run install:all
```

### 2. Install Playwright Browsers
```bash
npx playwright install --with-deps chromium
```

---

## Database Setup (Supabase PostgreSQL)

1. Create a free project at [supabase.com](https://supabase.com/).
2. In the Supabase Dashboard, open the **SQL Editor**.
3. Copy and run the migration script located at:
   `supabase/migrations/001_initial_schema.sql`
4. Retrieve your **Project URL** and **anon/service_role API Key** from **Project Settings -> API**.

> *Note*: If Supabase credentials are not configured in `.env`, the backend runs seamlessly using an in-memory local repository with full functionality.

---

## Environment Variables

Copy `.env.example` to `backend/.env`:
```bash
cp .env.example backend/.env
```

Configure the values:
```ini
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000

# Supabase PostgreSQL
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Cron Job Secret (Required for POST /api/scraper/run)
CRON_SECRET=your-secure-cron-secret-token

# Scraper Settings
SCRAPER_HEADLESS=true
SCRAPER_MAX_RETRIES=3
SCRAPER_INITIAL_DELAY_MS=1500
SCRAPER_TIMEOUT_MS=15000
```

---

## Running the Application

### Start Backend
```bash
npm run dev:backend
# Backend starts on http://localhost:5000
# Health check: http://localhost:5000/api/health
```

### Start Frontend
```bash
npm run dev:frontend
# Frontend starts on http://localhost:5173
```

---

## Running the Test Suite

Run the full automated test suite (24 tests covering parser, normalization, backoff delay, database integrity, error logging, and API endpoints):

```bash
npm test
```

All tests run via Vitest and exit cleanly with zero open handles.

---

## Running the Headed Scraper Demo

To visibly see Playwright open the browser, perform mouse movements, dismiss cookie modals, reveal the price, and extract data:

```bash
npm run scraper:headed 918
```
*(Replace `918` with any valid product ID from the mock store catalog)*.

---

## Scheduled Scraping (cron-job.org)

Because Render free tier web services spin down after 15 minutes of inactivity, scheduled scraping is triggered via `cron-job.org`:

1. Sign up for a free account at [cron-job.org](https://cron-job.org/).
2. Click **Create Cronjob**.
3. **URL**: `https://your-backend.onrender.com/api/scraper/run`
4. **Schedule**: Set to **Every 2 hours** (e.g. `0 */2 * * *`).
5. **Request Method**: `POST`
6. **Headers**: Add:
   - Header: `x-cron-secret`
   - Value: `your-secure-cron-secret-token`
7. **Timeout**: Set to 60 seconds.
8. Save and enable the job.

---

## Deployment Guide

### Frontend Deployment (Vercel)
1. Push repository to GitHub.
2. Import project in [vercel.com](https://vercel.com/).
3. **Root Directory**: Select `frontend`.
4. **Build Command**: `npm run build`
5. **Output Directory**: `dist`
6. **Environment Variables**:
   - `VITE_API_URL`: URL of your deployed Render backend (e.g. `https://product-price-tracker-backend.onrender.com`).
7. Deploy!

### Backend Deployment (Render)
1. In Render Dashboard, click **New Web Service**.
2. Connect your repository.
3. **Root Directory**: `backend`
4. **Environment**: `Node`
5. **Build Command**: `npm install && npm run build && npx playwright install --with-deps chromium`
6. **Start Command**: `npm start`
7. **Environment Variables**: Configure `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CRON_SECRET`, and `FRONTEND_URL`.
8. Deploy!

---

## API Endpoints

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Healthcheck and scraper readiness |
| `GET` | `/api/products/search?q=:query` | Public | Search mock store catalog |
| `POST` | `/api/products/track` | Public | Track a new product (prevents duplicates) |
| `GET` | `/api/products/tracked` | Public | List tracked products with latest price & stock |
| `GET` | `/api/products/:id` | Public | Get single tracked product |
| `GET` | `/api/products/:id/history` | Public | Get price history for charts |
| `GET` | `/api/products/:id/logs` | Public | Get scrape audit logs |
| `POST` | `/api/products/:id/scrape` | Public | Manual live scrape trigger |
| `POST` | `/api/scraper/run` | `CRON_SECRET` | Scheduled batch scraper for all active products |

---

## Scraping Reliability & Decoy Handling

The target store introduces intentional hurdles:
1. **Hidden Decoys**: The store injects hidden decoy spans (`span.price-value` with `display: none` and `span.amount[data-price="true"]`) containing altered prices. Our scraper evaluates computed styles in DOM and extracts only the genuine visible price element.
2. **Cookie Overlay**: A modal randomly renders between 1.5s and 5.0s, intercepting pointer events. Our scraper detects and strips the overlay before and during interaction.
3. **Flaky Clicks**: A randomized 35% click-delay/drop mechanism is handled by verifying state transitions and retrying clicks.
4. **Rate Limits & 401s**: Upstream 429 and 401 challenge failures trigger automatic in-page retries and job-level exponential backoff.
