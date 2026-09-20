# Design Note — Product Price Tracker

## 1. Scraping Reliability

The main priority of this implementation was reliable price and stock extraction rather than simply making a scraper that works once.

The scraper uses Playwright with Chromium because the target store is client-rendered and requires browser interaction. The scraper validates the extracted data before storing it. In particular, hidden/decoy price elements are ignored by checking DOM visibility and computed styles, and only a valid visible price is accepted.

The scraper also handles common transient failures using bounded timeouts, up to three attempts, exponential backoff with jitter, and retry handling for browser/page errors and retryable HTTP responses such as 401/429. Cookie overlays and unreliable interactions are handled before extracting the final data.

Every attempt is recorded in `scrape_logs` with its status, attempt number, duration, and error information. A `price_history` record is created only after a successful scrape produces a valid price. This prevents failed or invalid attempts from creating misleading historical data.

The scheduled scraper is triggered externally through cron-job.org every two hours. The `/api/scraper/run` endpoint authenticates the cron request using `x-cron-secret`, starts the scraper asynchronously, and immediately returns `202 Accepted`. This prevents the scheduler from timing out while the browser is still scraping products.

---

## 2. Trade-offs

### Reliability vs. Speed

Retries and backoff make scraping slower when failures occur, but they significantly reduce the chance of losing a scrape because of a temporary browser or network failure.

### Browser Automation vs. Simple HTTP Requests

Playwright is more resource-intensive than direct HTTP requests, but it is necessary because the target site uses client-rendered content and browser interactions.

### Strict Validation vs. Missing Data

The scraper prefers recording no price rather than storing a potentially incorrect price. A failed scrape is logged, but it does not create a bogus price-history entry.

### External Scheduler vs. Internal Timer

An external scheduler was chosen because the backend is deployed on Render's free tier, where the service can become inactive. cron-job.org provides a simple external trigger without requiring a continuously running scheduler process.

### Asynchronous Cron Endpoint

The scraper itself can take longer than a typical HTTP request timeout because of browser startup, retries, and backoff. Returning `202 Accepted` immediately allows the scheduled request to finish quickly while the scraper continues in the backend.

---

## 3. AI-Assisted Development: Initial Mistakes and Corrections

AI coding tools were used during development, but several generated assumptions were incorrect and were identified through testing and deployment.

### Playwright Deployment

The initial Render configuration used:

```bash
npx playwright install --with-deps chromium
