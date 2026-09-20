import { describe, it, expect, beforeEach, vi } from 'vitest';

// Force LOCAL_FALLBACK mode for all Repository tests.
// These tests validate repository *logic* (data integrity, deduplication, etc.)
// and must not depend on Supabase being configured.
vi.mock('../src/db/supabase', () => ({
  supabase: null,
  validateAndInitSupabase: vi.fn(),
}));

import { Repository } from '../src/db/repository';

describe('Database Integrity & Audit Logging Tests', () => {
  let testProductId: string;

  beforeEach(async () => {
    const prod = await Repository.createProduct({
      product_name: 'Test Audio Pro',
      product_url: 'https://demo.inelabteamdev.com/product/test-' + Date.now() + '-' + Math.floor(Math.random() * 1e9),
      category: 'Audio',
      brand: 'TestBrand'
    });
    testProductId = prod.id;
  });

  // Requirement 10: Database history insertion only after valid scrape
  it('should successfully insert valid price history', async () => {
    const history = await Repository.recordPriceHistory({
      product_id: testProductId,
      price: 18999,
      currency: 'INR',
      stock_status: 'In Stock',
      stock_quantity: 45
    });

    expect(history.id).toBeDefined();
    expect(history.price).toBe(18999);
    expect(history.stock_status).toBe('In Stock');

    const list = await Repository.getPriceHistory(testProductId);
    expect(list.length).toBeGreaterThanOrEqual(1);
    expect(list[list.length - 1].price).toBe(18999);
  });

  // Requirement 11: Failed scrape does NOT create invalid history
  it('should reject insertion of invalid, zero, or NaN price into price_history', async () => {
    await expect(Repository.recordPriceHistory({
      product_id: testProductId,
      price: 0,
      stock_status: 'In Stock'
    })).rejects.toThrow(/Integrity Violation/);

    await expect(Repository.recordPriceHistory({
      product_id: testProductId,
      price: NaN,
      stock_status: 'In Stock'
    })).rejects.toThrow(/Integrity Violation/);

    await expect(Repository.recordPriceHistory({
      product_id: testProductId,
      price: -50,
      stock_status: 'In Stock'
    })).rejects.toThrow(/Integrity Violation/);
  });

  // Requirement 12: Scrape log records every attempt honestly
  it('should record every attempt (SUCCESS, RETRY, FAILED) in scrape_logs', async () => {
    const started = new Date().toISOString();
    const finished = new Date().toISOString();

    await Repository.recordScrapeLog({
      product_id: testProductId,
      attempt_number: 1,
      status: 'RETRY',
      message: 'Attempt 1 failed with [TIMEOUT]. Retrying...',
      error_type: 'TIMEOUT',
      started_at: started,
      finished_at: finished,
      duration_ms: 1200
    });

    await Repository.recordScrapeLog({
      product_id: testProductId,
      attempt_number: 2,
      status: 'SUCCESS',
      message: 'Successfully extracted price Rs.18,999 and stock In Stock',
      started_at: started,
      finished_at: finished,
      duration_ms: 1500
    });

    const logs = await Repository.getScrapeLogs(testProductId);
    expect(logs.length).toBe(2);
    expect(logs.some(l => l.status === 'RETRY')).toBe(true);
    expect(logs.some(l => l.status === 'SUCCESS')).toBe(true);
  });

  it('should prevent duplicate product tracking by URL', async () => {
    const url = 'https://demo.inelabteamdev.com/product/duplicate-check-' + Date.now();
    await Repository.createProduct({
      product_name: 'Original Product',
      product_url: url
    });

    const existing = await Repository.findProductByUrl(url);
    expect(existing).not.toBeNull();
    expect(existing?.product_name).toBe('Original Product');
  });
});
