import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import http from 'http';

vi.mock('../src/db/supabase', () => ({
  supabase: null,
  validateAndInitSupabase: vi.fn(),
}));

import { app } from '../src/server';
import { CatalogService } from '../src/services/catalogService';

describe('Search Functionality Tests (Cases A through M)', () => {
  let server: http.Server;
  let baseUrl: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.E2E_TEST = 'true';
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(5097, () => {
        baseUrl = 'http://localhost:5097';
        resolve();
      });
    });
  });

  afterAll(async () => {
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));

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

  // A. Full product name
  it('A: should find product by full product name', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('Helix Soundbar Pro')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items[0].name).toBe('Helix Soundbar Pro');
    expect(data.items[0].brand).toBe('Helix');
  });

  // B. Partial product name
  it('B: should find product by partial product name', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('Soundbar Pro')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items.some((i: any) => i.name.includes('Soundbar Pro'))).toBe(true);
  });

  // C. Full brand
  it('C: should find products by full brand name', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('Auralite')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items.every((i: any) => i.brand.toLowerCase() === 'auralite' || i.name.toLowerCase().includes('auralite'))).toBe(true);
  });

  // D. Partial brand
  it('D: should find products by partial brand name', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('Aura')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items.some((i: any) => i.brand.toLowerCase().startsWith('aura'))).toBe(true);
  });

  // E. Full SKU
  it('E: should find product by full SKU', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('NOR-10001')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items[0].sku).toBe('NOR-10001');
    expect(data.items[0].name).toBe('Nordkraft Headphones Pro');
  });

  // F. Partial SKU
  it('F: should find product by partial SKU', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('10001')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items.some((i: any) => i.sku.includes('10001'))).toBe(true);
  });

  // G. Uppercase query
  it('G: should find products with uppercase query (case-insensitive)', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('NORDKRAFT HEADPHONES')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items[0].name.toLowerCase()).toContain('nordkraft');
  });

  // H. Lowercase query
  it('H: should find products with lowercase query (case-insensitive)', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('nordkraft headphones')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThanOrEqual(1);
    expect(data.items[0].name.toLowerCase()).toContain('nordkraft');
  });

  // I. Query with leading/trailing spaces
  it('I: should handle queries with leading and trailing whitespace properly', async () => {
    const trimmedRes = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('Ironwood Microphone')}`);
    const untrimmedRes = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('   Ironwood Microphone   ')}`);
    const data1 = await trimmedRes.json();
    const data2 = await untrimmedRes.json();
    expect(data1.total).toBe(data2.total);
    expect(data1.items.length).toBe(data2.items.length);
    expect(data2.items.length).toBeGreaterThanOrEqual(1);
  });

  // J. Query with no results
  it('J: should return empty list and zero count for nonexistent queries', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('nonexistentproductxyz98765')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.count).toBe(0);
    expect(data.total).toBe(0);
    expect(data.items).toEqual([]);
  });

  // K. Empty query
  it('K: should handle empty query cleanly and return categories', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items).toEqual([]);
    expect(Array.isArray(data.categories)).toBe(true);
    expect(data.categories.length).toBeGreaterThan(0);
  });

  // L. Multiple products returned
  it('L: should return multiple products when query matches multiple items', async () => {
    const res = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('Pro')}`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.items.length).toBeGreaterThan(1);
  });

  // M. Search followed by tracking a result
  it('M: should allow tracking a product found via search', async () => {
    const searchRes = await fetch(`${baseUrl}/api/products/search?q=${encodeURIComponent('NOR-10001')}`);
    const searchData = await searchRes.json();
    expect(searchData.items.length).toBeGreaterThanOrEqual(1);
    const found = searchData.items[0];

    const trackRes = await fetch(`${baseUrl}/api/products/track`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_name: found.name,
        product_url: found.product_url,
        external_product_id: found.id,
        category: found.category,
        brand: found.brand
      })
    });
    expect(trackRes.status).toBe(201);
    const trackData = await trackRes.json();
    expect(trackData.success).toBe(true);
    expect(trackData.product.product_name).toBe(found.name);
    expect(trackData.product.product_url).toBe(found.product_url);
  });
});
