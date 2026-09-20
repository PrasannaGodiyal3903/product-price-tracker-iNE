# Design Note: Product Price Tracker (Web Scraping)

## 1. Scraping Strategy: Why HTTP + Cheerio Was Not Sufficient

During our initial technical inspection of the target storefront (`https://demo.inelabteamdev.com/`), we requested the raw page HTML to verify whether lightweight HTTP fetching + Cheerio HTML parsing was viable.

Inspection of the response confirmed:
1. **Client-Side Rendering (SPA)**: The server responds only with an empty root shell:
   ```html
   <!doctype html>
   <html lang="en">
     <body><div id="root"></div></body>
   </html>
   ```
   The catalog, product layout, and pricing elements are dynamically mounted via React client bundles.
2. **Interactive Proof-of-Work Challenge**: Prices are not embedded in static API responses. The application requires:
   - Mouse movement tracking (`minMoves: 8`, `minDwellMs: 600ms`) over `.price-block`.
   - Dynamic token generation via `/api/challenge` and `/api/session`.
   - WebAssembly execution to solve a client-side cryptographic proof of work before an encrypted quote is returned by `/api/products/:id/price`.
3. **Decoy Elements**: The mock store injects decoy elements to mislead naive scrapers:
   - `span.price-value` with `style: { display: 'none' }` holding decoy value `d.d1`.
   - `span.amount[data-price="true"]` with `style: { display: 'none' }` holding decoy value `d.d2` (`shown + 7`).
   - The genuine price is rendered in a dynamically styled container that rotates CSS classes and tags across layout versions.

Because of these explicit anti-bot and client-side dynamics, lightweight HTTP fetching + Cheerio is incapable of extracting the true price. A real browser execution environment is required.

---

## 2. Headless Browser Decision: Why Playwright Was Required

Playwright was chosen because it executes modern Chromium with full WebAssembly, WebGL, canvas fingerprinting, and trusted pointer event emulation:
- **Interaction Emulation**: Playwright navigates, moves the virtual cursor across the price container bounding box with realistic intervals (> 50ms), satisfies dwell time, and clicks the reveal trigger.
- **Overlay & Flakiness Handling**: The mock store randomly displays a cookie consent overlay (`.cookie-overlay`) after 1.5–5 seconds, which intercepts pointer events. Our Playwright integration proactively detects and dismisses this modal to prevent click timeouts.
- **Dynamic Decoy Filtering**: Playwright inspects computed styles directly in the DOM, filtering out `display: none` decoys and strikethrough MRP spans to extract the genuine visible price.

---

## 3. Reliability Strategy: Handling Slow, Delayed, and Failing Requests

To guarantee reliable scraping without hanging or crashing:
1. **Explicit Timeouts**: All Playwright navigations and element waits enforce a strict 10–15 second timeout. No operation waits indefinitely.
2. **Exponential Backoff with Jitter**:
   - Initial delay: 1,500ms
   - Multiplier: 2.0
   - Random jitter: ±200ms
   - Maximum retries: 3 attempts per scrape job
3. **Internal Flakiness Recovery**: The mock store includes an intentional click-drop simulator (`Xn` function) and simulated 429 / 401 errors. If the store displays "Try again" or enters an error state, the scraper retries the action before escalating to job-level retry.
4. **Selector Resilience**: Instead of brittle hierarchical paths (e.g. `div > div:nth-child(3)`), the scraper relies on semantic identifiers, `[aria-label="Reveal price"]`, `.price-block`, and computed style inspection.

---

## 4. Data Correctness & Integrity

A central requirement of the assignment is that **no empty, zero, null, or fabricated data may ever enter price history**:
- **Strict Validation**:
  - Price must be parseable, finite, and strictly greater than 0.
  - Formats with currency symbols (`₹`, `$`, `€`, `Rs.`), European decimals (`16.619,00`), fullwidth Unicode digits (`１６６１９`), and zero-width spaces are normalized to numeric integers.
  - Stock is parsed into `In Stock` (with numeric quantity if available) or `Out of Stock`.
- **Integrity Rule**: If extraction fails or an error occurs:
  - **No record is inserted into `price_history`**.
  - A comprehensive audit entry is created in `scrape_logs` recording the attempt number, duration, error type, and status (`RETRY` or `FAILED`).
  - Existing historical records remain untainted.

---

## 5. Scheduling Strategy: External Cron vs. setInterval

The backend exposes a secure endpoint:
`POST /api/scraper/run` protected by `CRON_SECRET`.

**Why `cron-job.org` is used instead of `setInterval`**:
- Render's free tier spins down web services after 15 minutes of inactivity.
- Any in-process timer (`setInterval`) will freeze when the container sleeps.
- An external scheduler like `cron-job.org` wakes the Render instance by issuing an HTTPS POST request every 2 hours, triggers the batch scraper, authenticates via `x-cron-secret`, and receives a completion summary.

---

## 6. Trade-offs & Simplicity

- **Sequential Scrapes**: When running the scheduled cron job across multiple tracked products, products are scraped sequentially rather than in parallel. This trade-off prevents triggering upstream rate limits (`429 Too Many Requests`) on the target store.
- **Repository Abstraction**: The database layer uses a Repository pattern with a Supabase client and an automatic local fallback store. This allows local evaluation and testing without requiring immediate cloud credentials, while remaining 100% compliant with Supabase PostgreSQL migrations in production.

---

## 7. AI-Assisted Development: Encountered Issues & Corrections

> [!NOTE]
> This section documents the actual technical hurdles discovered and resolved during development:

1. **AI Misconception on Cheerio**:
   - *Initial AI Assumption*: Assumed the store could be scraped with simple HTTP `fetch` and Cheerio HTML parsing.
   - *Target Reality*: The store is a client-side React SPA where prices require cursor hover movement and a WebAssembly cryptographic challenge. Cheerio saw only `<div id="root"></div>`.
   - *Correction*: Adopted Playwright with headless automation and interaction emulation.
2. **The Hidden Decoy Traps**:
   - *Initial AI Assumption*: Assumed selecting `.price-value` or `[data-price="true"]` would yield the product price.
   - *Target Reality*: The store intentionally rendered decoy elements with `display: none` containing fake prices (`d.d1` and `d.d2 = shown + 7`).
   - *Correction*: Implemented computed style inspection to discard `display: none` elements and extract the true visible price element.
3. **Cookie Overlay Click Interception**:
   - *Initial AI Assumption*: Calling `btn.click()` on "Reveal price" would always succeed.
   - *Target Reality*: A `<div class="cookie-overlay">` modal popped up 1.5–5 seconds after page load, intercepting pointer events and causing 30-second Playwright timeouts.
   - *Correction*: Added an automated overlay detector and dismisser before and during interactive steps.
4. **Node Process Hanging After Test Suite**:
   - *Initial AI Assumption*: Calling `server.close()` would exit the test runner.
   - *Target Reality*: Active HTTP keep-alive connections from global `fetch()` kept sockets open in the event loop.
   - *Correction*: Added `server.closeAllConnections()` and explicit socket teardown in test lifecycle hooks.
