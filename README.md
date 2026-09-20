# Product Price Tracker (Web Scraping)

A full-stack Product Price Tracker built for the **INE Software Engineer Intern Assignment**.

The application allows users to search products from the INE Mock Store, track selected products, automatically scrape their price and stock status using Playwright, maintain price history, and monitor scraper attempts through audit logs.

## Live Application

- **Frontend:** https://product-price-tracker-ine-frontend.vercel.app (Deployed on Vercel)
- **Backend:** https://product-price-tracker-ine-backend.onrender.com (Deployed on Render)
- **Database:** Supabase PostgreSQL
- **Scheduled Scraping:** cron-job.org

---

## Table of Contents

1. [Overview & Features](#overview--features)
2. [Architecture & Tech Stack](#architecture--tech-stack)
3. [Local Setup & Installation](#local-setup--installation)
4. [Database Setup](#database-setup)
5. [Environment Variables](#environment-variables)
6. [Running the Application](#running-the-application)
7. [Running the Test Suite](#running-the-test-suite)
8. [Running the Headed Scraper Demo](#running-the-headed-scraper-demo)
9. [Scheduled Scraping](#scheduled-scraping)
10. [Deployment](#deployment)
11. [API Endpoints](#api-endpoints)
12. [Scraping Reliability](#scraping-reliability)
13. [Project Structure](#project-structure)

---

# Overview & Features

## Product Search

Users can search the INE Mock Store catalog using:

- Partial product name
- Full product name
- Partial brand
- Full brand
- Partial SKU
- Full SKU

Search is case-insensitive and handles leading/trailing whitespace.

## Product Tracking

Users can select products from search results and add them to their tracked products list.

Duplicate tracking is prevented by the backend.

## Automated Web Scraping

The backend uses **Playwright with Chromium** to scrape tracked products from the INE Mock Store.

For each tracked product, the scraper extracts:

- Current price
- Stock availability

The scraper performs real browser interaction rather than relying only on static HTTP requests.

## Price History

Successful scraping results are stored in Supabase PostgreSQL and used to display price history for tracked products.

Invalid or failed scraping results are never inserted into price history.

## Scrape Audit Logs

Every scraper attempt is recorded with information such as:

- Attempt number
- Status
- Duration
- Error classification
- Timestamp
- Error details when applicable

Possible scraper statuses include:

```text
SUCCESS
RETRY
FAILED
```

This provides visibility into scraper reliability and failures.

## Retry & Failure Handling

The scraper handles transient failures using:

- Multiple attempts
- Exponential backoff
- Jitter
- Page-load timeouts
- Retryable HTTP failures
- Browser/page errors
- Invalid price detection
- Stock validation

A scraper failure does not create fake price-history records.

## Decoy Handling

The mock store intentionally contains misleading/hidden price elements.

The scraper checks DOM visibility and computed styles before accepting a price, ensuring that hidden decoy values are not stored.

## Headed Scraper Demo

A headed Playwright mode is included for demonstrating the scraper visually.

It allows reviewers to observe:

- Browser launch
- Page navigation
- Human-like interaction
- Cookie overlay handling
- Price extraction
- Stock extraction
- Retry behavior

---

# Architecture & Tech Stack

## Frontend

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Recharts
- Lucide Icons

## Backend

- Node.js
- Express
- TypeScript
- Playwright
- Chromium

## Database

- Supabase
- PostgreSQL

## Scheduler

- cron-job.org
- HTTP POST webhook

## Deployment

- Frontend → Vercel
- Backend → Render
- Database → Supabase

---

# Architecture

```text
                    ┌─────────────────────┐
                    │      Vercel         │
                    │   React Frontend    │
                    └──────────┬──────────┘
                               │
                               │ HTTP API
                               ▼
                    ┌─────────────────────┐
                    │      Render         │
                    │  Express Backend    │
                    └──────────┬──────────┘
                               │
                 ┌─────────────┼─────────────┐
                 │             │             │
                 ▼             ▼             ▼
          ┌────────────┐ ┌───────────┐ ┌──────────────┐
          │ Playwright │ │ Supabase  │ │ Scraper Logs │
          │  Chromium  │ │ PostgreSQL│ │ & History    │
          └─────┬──────┘ └───────────┘ └──────────────┘
                │
                ▼
       ┌──────────────────────┐
       │    INE Mock Store     │
       │ demo.inelabteamdev.com│
       └──────────────────────┘

       ┌──────────────────────┐
       │     cron-job.org     │
       │      Every 2 Hours   │
       └──────────┬───────────┘
                  │
                  │ POST /api/scraper/run
                  ▼
             Render Backend
```

The scheduled scraper endpoint authenticates the request using the `x-cron-secret` header.

The endpoint returns `202 Accepted` immediately after starting the scraper job, allowing cron-job.org to complete the HTTP request without waiting for the complete scraping operation.

---

# Local Setup & Installation

## Prerequisites

- Node.js 18+
- npm 9+
- Git
- Supabase account (for production persistence)

Node.js 20 or 22 is recommended for local development.

## 1. Clone the Repository

```bash
git clone https://github.com/PrasannaGodiyal3903/product-price-tracker-iNE.git
cd product-price-tracker-iNE
```

## 2. Install Dependencies

From the repository root:

```bash
npm run install:all
```

## 3. Install Playwright Chromium

```bash
npx playwright install chromium
```

For Linux environments where Playwright system dependencies are available:

```bash
npx playwright install --with-deps chromium
```

---

# Database Setup

The application uses **Supabase PostgreSQL**.

## 1. Create a Supabase Project

Create a project from the Supabase dashboard.

## 2. Run the Database Migration

Open:

```text
Supabase Dashboard
→ SQL Editor
```

Run:

```text
supabase/migrations/001_initial_schema.sql
```

The migration creates the required tables:

- `tracked_products`
- `price_history`
- `scrape_logs`

## 3. Configure Supabase Credentials

The backend requires:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

The service-role key must remain server-side and must never be exposed through the frontend.

---

# Environment Variables

Create:

```text
backend/.env
```

based on:

```text
.env.example
```

Example:

```ini
PORT=5000
NODE_ENV=development

FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:5000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# Cron authentication
CRON_SECRET=your-secure-cron-secret

# Scraper configuration
SCRAPER_HEADLESS=true
SCRAPER_MAX_RETRIES=3
SCRAPER_INITIAL_DELAY_MS=1500
SCRAPER_TIMEOUT_MS=15000
```

### Security

Never commit:

```text
.env
.env.local
```

or any secret credentials to GitHub.

The Supabase service-role key and `CRON_SECRET` are backend-only credentials.

---

# Running the Application

## Start Backend

```bash
npm run dev:backend
```

Backend:

```text
http://localhost:5000
```

Health check:

```text
http://localhost:5000/api/health
```

## Start Frontend

```bash
npm run dev:frontend
```

Frontend:

```text
http://localhost:5173
```

---

# Running the Test Suite

The project uses **Vitest** for automated testing.

Run:

```bash
npm test
```

The current test suite contains:

```text
28 tests
```

covering functionality including:

- Parser behavior
- Price normalization
- Retry/backoff behavior
- Database behavior
- Error logging
- API endpoints
- Production database configuration
- Cron authentication
- Search functionality

The complete test suite currently passes successfully.

---

# Running the Headed Scraper Demo

The headed scraper mode launches a visible Chromium browser.

From the backend directory:

```bash
npm run scraper:headed 918
```

Replace `918` with a valid product ID from the mock store catalog.

The headed mode demonstrates the actual browser-based scraping workflow, including interaction with the target store and extraction of price and stock information.

---

# Scheduled Scraping

The production scraper is triggered automatically every **2 hours** using cron-job.org.

This approach is used because the Render free web service can spin down after periods of inactivity.

## cron-job.org Configuration

Create a cron job with:

### URL

```text
https://your-backend.onrender.com/api/scraper/run
```

### Request Method

```text
POST
```

### Header

```text
x-cron-secret: YOUR_CRON_SECRET
```

### Schedule

```text
Every 2 hours
```

Equivalent cron expression:

```text
0 */2 * * *
```

### Timeout

```text
30 seconds
```

The `/api/scraper/run` endpoint returns:

```text
202 Accepted
```

after authenticating the request and starting the scraper job.

The actual scraper then continues in the backend process.

This prevents cron-job.org from waiting for the entire scraping process and timing out.

## Preventing Concurrent Runs

The backend prevents duplicate scraper runs from executing concurrently.

If a scraper run is already active, another scheduled request is rejected rather than starting a second scraper process.

---

# Deployment

## Frontend — Vercel

1. Push the repository to GitHub.
2. Import the repository into Vercel.
3. Configure the frontend directory:

```text
Root Directory: frontend
```

4. Framework:

```text
Vite
```

5. Build command:

```bash
npm run build
```

6. Output directory:

```text
dist
```

7. Add the frontend environment variable:

```text
VITE_API_URL=https://your-backend.onrender.com
```

Only public frontend configuration should be exposed to Vercel.

Do not add:

```text
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET
```

to the frontend environment.

---

# Backend — Render

Create a Render Web Service connected to the GitHub repository.

### Root Directory

```text
backend
```

### Build Command

```bash
npm install && npm run build && PLAYWRIGHT_BROWSERS_PATH=0 npx playwright install chromium
```

### Start Command

```bash
npm start
```

### Required Environment Variables

```text
NODE_ENV=production
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
CRON_SECRET=...
FRONTEND_URL=...
PLAYWRIGHT_BROWSERS_PATH=0
```

Additional application-specific variables can be configured using `.env.example`.

### Playwright Production Configuration

The production environment uses:

```text
PLAYWRIGHT_BROWSERS_PATH=0
```

so that the Playwright browser is installed in the application's local environment and remains available when the deployed service starts.

---

# API Endpoints

| Method | Endpoint | Authentication | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Backend health check |
| `GET` | `/api/products/search?q=:query` | Public | Search products by name, brand, or SKU |
| `POST` | `/api/products/track` | Public | Track a product |
| `GET` | `/api/products/tracked` | Public | List tracked products |
| `GET` | `/api/products/:id` | Public | Get a tracked product |
| `GET` | `/api/products/:id/history` | Public | Get price history |
| `GET` | `/api/products/:id/logs` | Public | Get scraper audit logs |
| `POST` | `/api/products/:id/scrape` | Public | Trigger a manual scrape |
| `POST` | `/api/scraper/run` | `x-cron-secret` | Start the scheduled scraper |

---

# Search Behavior

The product search supports:

```text
Partial product name
Full product name
Partial brand
Full brand
Partial SKU
Full SKU
```

Search is:

- Case-insensitive
- Whitespace-trimmed
- Partial-match based
- Performed through the backend API

Examples:

```text
auralite
Auralite
aur
sony
headphones
partial-SKU
```

The search results are obtained from the product catalog rather than relying on hardcoded frontend product data.

---

# Scraping Reliability

The target INE Mock Store introduces several challenges that the scraper must handle reliably.

## 1. Client-Rendered Content

The scraper uses Playwright/Chromium to interact with the rendered page rather than relying only on raw HTTP responses.

## 2. Hidden Price Decoys

The target store can contain hidden price elements containing misleading values.

The scraper verifies element visibility and computed styles before accepting a price.

Only the genuine visible price is accepted.

## 3. Cookie Overlays

Cookie overlays can intercept browser interactions.

The scraper detects and handles the overlay before continuing with the required interaction.

## 4. Flaky Interactions

The scraper verifies expected page/state transitions and retries failed interactions when appropriate.

## 5. Rate Limits and HTTP Errors

Transient failures such as:

```text
401
429
```

are treated as retryable conditions where appropriate.

## 6. Retry Strategy

The scraper uses:

```text
Maximum retries: 3
Initial delay: 1500 ms
Exponential backoff
Jitter
```

This prevents immediate repeated requests and improves resilience against transient failures.

## 7. Timeout Handling

Page operations use bounded timeouts.

A timeout does not immediately terminate the entire scraper. The configured retry mechanism can attempt the operation again.

## 8. Price Validation

Prices are normalized before being stored.

The scraper handles formatting variations including:

- Decimal prices
- Comma-separated numbers
- Spaced numbers
- Currency symbols
- Unicode/fullwidth digits
- Trailing tax or formatting text

Invalid or empty prices are rejected.

## 9. Stock Validation

Stock information is validated before being persisted.

## 10. Data Integrity

A price-history record is created only after a successful scrape produces a valid price.

Failed attempts are recorded in `scrape_logs` but do not create bogus price-history entries.

---

# Project Structure

```text
product-price-tracker-iNE/
│
├── backend/
│   ├── src/
│   │   ├── controllers/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── scraper/
│   │   ├── db/
│   │   └── ...
│   │
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   │
│   ├── package.json
│   └── vite.config.ts
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
│
├── .env.example
├── .gitignore
├── README.md
└── DESIGN_NOTE.md
```

---

# Design Considerations

The application prioritizes **scraper reliability and data integrity** over unnecessary UI functionality.

The main production workflow is:

```text
Search Product
      ↓
Select Product
      ↓
Track Product
      ↓
Scheduled Scraper
      ↓
Playwright Browser
      ↓
Extract Price + Stock
      ↓
Validate Result
      ↓
Supabase
      ├── price_history
      └── scrape_logs
```

For failed scraping attempts:

```text
Scrape Attempt
      ↓
Failure
      ↓
Log Failure
      ↓
Retry with Backoff
      ↓
Success ───────→ Store Price History
      │
      └── Final Failure ──→ Log Failure Only
```

This ensures that unreliable or invalid scraper results cannot contaminate the stored price history.
