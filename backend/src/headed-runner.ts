import { chromium } from 'playwright';
import { validateAndBuildResult } from './scraper/parser';

async function runHeadedDemo() {
  console.log('==================================================');
  console.log(' INE STORE SCRAPER: HEADED DEMONSTRATION MODE');
  console.log('==================================================');

  const productId = process.argv[2] || '918';
  const url = `https://demo.inelabteamdev.com/product/${productId}`;

  console.log(`Target URL: ${url}`);
  console.log('Launching Chromium in visible (headed) mode...');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 60, // Slow down operations so actions are clearly visible
    args: ['--disable-blink-features=AutomationControlled']
  });

  try {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();
    page.setDefaultTimeout(20000);

    console.log('[1/6] Navigating to target product page...');
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    console.log(`Page loaded. Title: "${await page.title()}"`);

    // Handle cookie overlay
    const dismissCookie = async () => {
      const overlay = await page.$('.cookie-overlay');
      if (overlay) {
        console.log('[COOKIE] Dismissing cookie consent overlay...');
        await page.evaluate(() => document.querySelector('.cookie-overlay')?.remove());
        await page.waitForTimeout(300);
      }
    };
    await dismissCookie();

    console.log('[2/6] Locating price block element...');
    const priceBlock = await page.waitForSelector('.price-block', { timeout: 8000 });
    await priceBlock.scrollIntoViewIfNeeded();

    console.log('[3/6] Simulating human cursor movements over price area...');
    const box = await priceBlock.boundingBox();
    if (box) {
      for (let i = 0; i < 20; i++) {
        await page.mouse.move(box.x + 20 + i * 8, box.y + 20 + (i % 3) * 6);
        await page.waitForTimeout(50);
      }
    }
    await page.waitForTimeout(800); // Satisfy minDwellMs (600ms)

    await dismissCookie();

    console.log('[4/6] Clicking "Reveal price" button...');
    const btn = await page.waitForSelector('button[aria-label="Reveal price"], button:has-text("Reveal price")');
    await btn.click({ force: true });

    console.log('[5/6] Waiting for price resolution (observing store status)...');
    const start = Date.now();
    let resolved = false;

    while (Date.now() - start < 18000) {
      await dismissCookie();

      const state = await page.evaluate(() => {
        const blk = document.querySelector('.price-block');
        if (!blk) return null;
        return {
          isSuccess: blk.classList.contains('price-success'),
          isError: blk.classList.contains('price-error'),
          text: (blk as HTMLElement).innerText.replace(/\s+/g, ' ').trim()
        };
      });

      if (state) {
        console.log(`  -> Store State: ${state.text.slice(0, 80)}`);
        if (state.isSuccess) {
          resolved = true;
          break;
        }
        if (state.isError) {
          console.log('  -> Store indicated error. Clicking "Try again"...');
          const tryAgain = await page.$('button:has-text("Try again")');
          if (tryAgain) await tryAgain.click({ force: true }).catch(() => {});
        }
      }

      await page.waitForTimeout(1000);
    }

    if (!resolved) {
      console.log('Scraper timed out before price-success was reached.');
      return;
    }

    console.log('[6/6] Price revealed! Extracting genuine visible price and stock...');
    const extracted = await page.evaluate(() => {
      const blk = document.querySelector('.price-block');
      if (!blk) return { rawPrice: null, rawStock: null };

      // Bypassing decoys (display:none and line-through)
      const candidates = Array.from(blk.querySelectorAll('.price-main *'));
      let rawPrice = null;

      for (const el of candidates) {
        const h = el as HTMLElement;
        const style = window.getComputedStyle(h);
        if (style.display === 'none' || style.visibility === 'hidden') continue;
        if (style.textDecoration.includes('line-through')) continue;
        if (h.classList.contains('amount') || h.classList.contains('price-value') && h.hasAttribute('aria-hidden')) continue;
        if (h.innerText.includes('% off') || h.innerText.includes('Deal price') || h.innerText.includes('Updating')) continue;

        const t = h.innerText.trim();
        if (/[0-9\uFF10-\uFF19]/.test(t)) {
          rawPrice = t;
          break;
        }
      }

      const stockBadge = blk.querySelector('.stock-badge');
      const rawStock = stockBadge ? (stockBadge as HTMLElement).innerText.trim() : null;

      return { rawPrice, rawStock };
    });

    const parsed = validateAndBuildResult(extracted.rawPrice, extracted.rawStock);
    console.log('==================================================');
    console.log(' EXTRACTION SUMMARY');
    console.log('==================================================');
    console.log(JSON.stringify(parsed, null, 2));

    // Keep window open briefly for inspection
    console.log('Closing browser in 5 seconds...');
    await page.waitForTimeout(5000);

  } catch (err: any) {
    console.error('Headed mode error:', err.message);
  } finally {
    await browser.close();
    console.log('Browser closed cleanly.');
  }
}

runHeadedDemo();
