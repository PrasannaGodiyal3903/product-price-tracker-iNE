import { TrackedProduct, PriceHistory, ScrapeLog, CatalogItem } from './types';

const API_BASE = import.meta.env.VITE_API_URL || '';

export async function fetchHealth(): Promise<{ status: string; database: string }> {
  const res = await fetch(API_BASE + '/api/health');
  if (!res.ok) throw new Error('Healthcheck failed');
  return res.json();
}

export interface CatalogSearchResult {
  items: CatalogItem[];
  total: number;
  categories: string[];
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function searchCatalog(
  query: string,
  category = '',
  page = 1,
  pageSize = 40
): Promise<CatalogSearchResult> {
  const params = new URLSearchParams();
  const trimmed = query.trim();
  if (trimmed) params.set('q', trimmed);
  if (category && category !== 'all') params.set('category', category);
  params.set('page', String(page));
  params.set('limit', String(pageSize));

  const res = await fetch(API_BASE + '/api/products/search?' + params.toString());
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.message || 'Catalog search request failed (HTTP ' + res.status + ')');
  }
  const data = await res.json();
  return {
    items: data.items || [],
    total: data.total || 0,
    categories: data.categories || [],
    page: data.page || 1,
    pageSize: data.pageSize || pageSize,
    totalPages: data.totalPages || 1,
  };
}

export async function fetchTrackedProducts(): Promise<TrackedProduct[]> {
  const res = await fetch(API_BASE + '/api/products/tracked');
  if (!res.ok) throw new Error('Failed to fetch tracked products');
  const data = await res.json();
  return data.products || [];
}

export async function trackProduct(payload: {
  product_name: string;
  product_url: string;
  external_product_id?: number | null;
  category?: string | null;
  brand?: string | null;
}): Promise<{ success: boolean; message: string; product: TrackedProduct }> {
  const res = await fetch(API_BASE + '/api/products/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Failed to track product');
  return data;
}

export async function fetchPriceHistory(productId: string): Promise<PriceHistory[]> {
  const res = await fetch(API_BASE + '/api/products/' + productId + '/history');
  if (!res.ok) throw new Error('Failed to fetch price history');
  const data = await res.json();
  return data.history || [];
}

export async function fetchScrapeLogs(productId: string): Promise<ScrapeLog[]> {
  const res = await fetch(API_BASE + '/api/products/' + productId + '/logs');
  if (!res.ok) throw new Error('Failed to fetch scrape logs');
  const data = await res.json();
  return data.logs || [];
}

export async function triggerManualScrape(productId: string): Promise<any> {
  const res = await fetch(API_BASE + '/api/products/' + productId + '/scrape', {
    method: 'POST'
  });
  const data = await res.json();
  return data;
}
