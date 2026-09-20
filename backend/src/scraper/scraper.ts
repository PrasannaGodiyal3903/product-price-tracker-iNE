import { chromium, Browser, Page } from 'playwright';
import { ExtractionResult, ScrapeAttemptResult, ScraperOptions } from './types';
import { validateAndBuildResult } from './parser';
import { delay, getBackoffDelay } from './retry';

export class ProductScraper {
  private browser: Browser | null = null;

  /**
   * Dismisses the cookie overlay popup if present
   */
  private async dismissCookieOverlay(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        const overlay = document.querySelector('.cookie-overlay');
        if (overlay) overlay.remove();
      });
    } catch {
      // Ignore evaluation errors during page unload
    }
  }

  /**
   * Performs hover movements inside the price block to trigger the site's human verification
   */
  private async triggerHoverTracking(page: Page): Promise<void> {
    const priceBlock = await page.$('.price-block');
    if (!priceBlock) return;

    const box = await priceBlock.boundingBox();
    if (!box) return;

    for (let i = 0; i < 18; i++) {
      await page.mouse.move(box.x + 20 + i * 8, box.y + 20 + (i % 3) * 6);
      await delay(50);
    }
    await delay(750); // Satisfy minDwellMs (600ms)
  }

  /**
   * Extracts visible price, bypassing hidden decoys
   */
  private async extractVisibleData(page: Page): Promise<{ rawPrice: string | null; rawStock: string | null }> {
    return page.evaluate(() => {
      const blk = document.querySelector('.price-block');
      if (!blk) return { rawPrice: null, rawStock: null };

      // Filter out display:none elements (which contain decoys d.d1 and d.d2)
      // and line-through elements (MRP)
      const candidates = Array.from(blk.querySelectorAll('.price-main *'));
      let rawPrice: string | null = null;

      for (const el of candidates) {
        const htmlEl = el as HTMLElement;
        const style = window.getComputedStyle(htmlEl);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (style.textDecoration.includes('line-through')) continue;
        if (htmlEl.classList.contains('amount') || htmlEl.classList.contains('price-value') && htmlEl.hasAttribute('aria-hidden')) continue;
        if (htmlEl.innerText && htmlEl.innerText.includes('% off')) continue;
        if (htmlEl.innerText && htmlEl.innerText.includes('Deal price')) continue;
        if (htmlEl.innerText && htmlEl.innerText.includes('Updating')) continue;

        const text = htmlEl.innerText.trim();
        // Check if contains digits
        if (/[0-9\uFF10-\uFF19]/.test(text)) {
          rawPrice = text;
          break;
        }
      }

      // If candidates loop didn't grab it, inspect price-main direct children
      if (!rawPrice) {
        const priceMain = blk.querySelector('.price-main');
        if (priceMain) {
          const visibleChildren = Array.from(priceMain.children).filter(c => {
            const h = c as HTMLElement;
            return window.getComputedStyle(h).display !== 'none' && !h.innerText.includes('% off');
          });
          for (const c of visibleChildren) {
            const h = c as HTMLElement;
            if (/[0-9\uFF10-\uFF19]/.test(h.innerText)) {
              rawPrice = h.innerText.trim();
              break;
            }
          }
        }
      }

      // Stock badge
      const stockBadge = blk.querySelector('.stock-badge') || document.querySelector('.stock-badge');
      const rawStock = stockBadge ? (stockBadge as HTMLElement).innerText.trim() : null;

      return { rawPrice, rawStock };
    });
  }

  /**
   * Scrapes a single attempt
   */
  private async executeAttempt(url: string, headless: boolean, timeoutMs: number): Promise<ExtractionResult> {
    let browser: Browser | null = null;
    try {
      browser = await chromium.launch({
        headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
      });

      const context = await browser.newContext({
        viewport: { width: 1280, height: 800 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      });

      const page = await context.newPage();
      page.setDefaultTimeout(timeoutMs);
      page.setDefaultNavigationTimeout(timeoutMs);

      // Navigate to product page
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
      await this.dismissCookieOverlay(page);

      // Wait for price block
      const priceBlock = await page.waitForSelector('.price-block', { timeout: 8000 }).catch(() => null);
      if (!priceBlock) {
        return {
          success: false,
          errorType: 'PRICE_NOT_FOUND',
          message: 'Product price container was not found on page.'
        };
      }

      // Human interaction simulation
      await this.triggerHoverTracking(page);
      await this.dismissCookieOverlay(page);

      // Reveal price button
      const revealBtn = await page.$('button[aria-label="Reveal price"], button:has-text("Reveal price")');
      if (revealBtn) {
        await revealBtn.click({ force: true }).catch(() => {});
      }

      // Poll until price-success or error resolution
      const pollStart = Date.now();
      let resolved = false;

      while (Date.now() - pollStart < timeoutMs) {
        await this.dismissCookieOverlay(page);

        const state = await page.evaluate(() => {
          const blk = document.querySelector('.price-block');
          if (!blk) return { status: 'missing' };
          if (blk.classList.contains('price-success')) return { status: 'SUCCESS' };
          if (blk.classList.contains('price-error')) return { status: 'ERROR', text: (blk as HTMLElement).innerText };
          return { status: 'LOADING' };
        });

        if (state.status === 'SUCCESS') {
          resolved = true;
          break;
        }

        if (state.status === 'ERROR') {
          // Attempt Try again click inside the page
          const tryAgain = await page.$('button:has-text("Try again")');
          if (tryAgain) {
            await tryAgain.click({ force: true }).catch(() => {});
          }
        }

        await delay(800);
      }

      if (!resolved) {
        return {
          success: false,
          errorType: 'TIMEOUT',
          message: `Price quote did not resolve within ${timeoutMs}ms (site rate limit or slow response).`
        };
      }

      // Extract visible data
      const { rawPrice, rawStock } = await this.extractVisibleData(page);
      return validateAndBuildResult(rawPrice, rawStock);

    } catch (err: any) {
      return {
        success: false,
        errorType: err.name === 'TimeoutError' ? 'TIMEOUT' : 'PAGE_ERROR',
        message: err.message || 'Error occurred during scraping process.'
      };
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }
  }

  /**
   * Full scraping workflow with configurable retries, exponential backoff, and logging
   */
  public async scrapeProductWithRetry(
    url: string,
    options: ScraperOptions = {}
  ): Promise<{ finalResult: ExtractionResult; attempts: ScrapeAttemptResult[] }> {
    const maxRetries = options.maxRetries ?? 3;
    const initialDelay = options.initialDelayMs ?? 1500;
    const timeoutMs = options.timeoutMs ?? 15000;
    const headless = options.headless ?? true;

    const attempts: ScrapeAttemptResult[] = [];
    let finalResult: ExtractionResult = {
      success: false,
      errorType: 'UNKNOWN',
      message: 'Scraping has not executed.'
    };

    for (let attemptNumber = 1; attemptNumber <= maxRetries; attemptNumber++) {
      const startedAt = new Date().toISOString();
      const t0 = Date.now();

      const result = await this.executeAttempt(url, headless, timeoutMs);
      const finishedAt = new Date().toISOString();
      const durationMs = Date.now() - t0;

      if (result.success) {
        const attemptLog: ScrapeAttemptResult = {
          attemptNumber,
          status: 'SUCCESS',
          message: `Successfully extracted price ₹${result.price.toLocaleString('en-IN')} and stock status "${result.stockStatus}"`,
          startedAt,
          finishedAt,
          durationMs,
          data: result
        };
        attempts.push(attemptLog);
        if (options.onAttempt) await options.onAttempt(attemptLog);

        finalResult = result;
        return { finalResult, attempts };
      } else {
        const isLastAttempt = attemptNumber === maxRetries;
        const status = isLastAttempt ? 'FAILED' : 'RETRY';
        const msg = isLastAttempt
          ? `Scrape permanently failed after ${maxRetries} attempts. [${result.errorType}]: ${result.message}`
          : `Attempt ${attemptNumber} failed with [${result.errorType}]: ${result.message}. Retrying...`;

        const attemptLog: ScrapeAttemptResult = {
          attemptNumber,
          status,
          message: msg,
          errorType: result.errorType,
          startedAt,
          finishedAt,
          durationMs
        };
        attempts.push(attemptLog);
        if (options.onAttempt) await options.onAttempt(attemptLog);

        finalResult = result;

        if (!isLastAttempt) {
          const backoff = getBackoffDelay(attemptNumber, initialDelay);
          await delay(backoff);
        }
      }
    }

    return { finalResult, attempts };
  }
}
