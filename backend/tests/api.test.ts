import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';

vi.mock('../src/db/supabase', () => ({
  supabase: null,
  validateAndInitSupabase: vi.fn(),
}));

import { app } from '../src/server';
import { ScraperController } from '../src/controllers/scraperController';

describe('API Integration Tests', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.E2E_TEST = 'true';
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(5098, () => {
        baseUrl = 'http://localhost:5098';
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Clean up any remaining TLS sockets from fetch
    const handles = (process as any)._getActiveHandles ? (process as any)._getActiveHandles() : [];
    for (const h of handles) {
      if (h && typeof h.destroy === 'function' && h !== process.stdout && h !== process.stderr && h !== process.stdin) {
        h.destroy();
      }
      if (h && typeof h.unref === 'function' && h !== process.stdout && h !== process.stderr && h !== process.stdin) {
        h.unref();
      }
    }
  });

  it('GET /api/health should return 200 and healthy status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('HEALTHY');
    expect(data.service).toBe('product-price-tracker-backend');
  });

  it('GET /api/products/search should filter catalog items', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=kettle`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.items)).toBe(true);
    if (data.items.length > 0) {
      expect(data.items[0].product_url).toContain('https://demo.inelabteamdev.com/product/');
    }
  });

  it('POST /api/products/track should validate store URL', async () => {
    const res = await fetch(`${baseUrl}/api/products/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_name: 'Fake Amazon Product',
        product_url: 'https://www.amazon.com/dp/B08N5WRWNW'
      })
    });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('INVALID_STORE_URL');
  });

  it('POST /api/scraper/run should require CRON_SECRET authentication (401 on missing/invalid)', async () => {
    const unauth = await fetch(`${baseUrl}/api/scraper/run`, { method: 'POST' });
    expect(unauth.status).toBe(401);
    const unauthData = await unauth.json();
    expect(unauthData.error).toBe('UNAUTHORIZED');

    const badSecret = await fetch(`${baseUrl}/api/scraper/run`, {
      method: 'POST',
      headers: { 'x-cron-secret': 'wrong-secret-value' }
    });
    expect(badSecret.status).toBe(401);
  });

  it('POST /api/scraper/run should immediately return 202 Accepted with valid secret', async () => {
    // Ensure clean initial state
    ScraperController.setScraperActive(false);

    const startTime = Date.now();
    const auth = await fetch(`${baseUrl}/api/scraper/run`, {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET || 'cron-secret-ine-2026'
      }
    });
    const elapsedMs = Date.now() - startTime;

    expect(auth.status).toBe(202);
    const data = await auth.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Scraper run started');
    // Verify response was sent immediately (well under 1 second)
    expect(elapsedMs).toBeLessThan(1000);
  });

  it('POST /api/scraper/run should return 409 Conflict if a scraper run is already in progress', async () => {
    // Simulate active scraper run
    ScraperController.setScraperActive(true);

    const conflict = await fetch(`${baseUrl}/api/scraper/run`, {
      method: 'POST',
      headers: {
        'x-cron-secret': process.env.CRON_SECRET || 'cron-secret-ine-2026'
      }
    });

    expect(conflict.status).toBe(409);
    const data = await conflict.json();
    expect(data.success).toBe(false);
    expect(data.message).toBe('Scraper run already in progress');

    // Reset state after test
    ScraperController.setScraperActive(false);
  });
});
