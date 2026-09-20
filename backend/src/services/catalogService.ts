import fs from 'fs';
import path from 'path';

export interface CatalogItem {
  id: number;
  slug: string;
  name: string;
  brand: string;
  category: string;
  sku: string;
  description: string;
  product_url: string;
}

export interface CatalogSearchResult {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  categories: string[];
  items: CatalogItem[];
}

export class CatalogService {
  private static cache: CatalogItem[] | null = null;
  private static cacheExpiresAt: number = 0;
  private static readonly TTL_MS = 15 * 60 * 1000; // 15 minutes
  private static isFetching = false;
  private static fetchPromise: Promise<CatalogItem[]> | null = null;
  private static cacheFilePath = path.resolve(__dirname, '../data/catalog.json');

  /**
   * Load seed/cached catalog from local disk file if available.
   */
  private static loadFromDisk(): CatalogItem[] | null {
    try {
      if (fs.existsSync(this.cacheFilePath)) {
        const raw = fs.readFileSync(this.cacheFilePath, 'utf8');
        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length > 0) {
          return items;
        }
      }
    } catch (err: any) {
      console.warn('[CatalogService] Warning: Could not read disk catalog cache:', err.message);
    }
    return null;
  }

  /**
   * Persist current cache to local disk.
   */
  private static saveToDisk(items: CatalogItem[]): void {
    try {
      const dir = path.dirname(this.cacheFilePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.cacheFilePath, JSON.stringify(items, null, 2), 'utf8');
    } catch (err: any) {
      console.warn('[CatalogService] Warning: Could not write disk catalog cache:', err.message);
    }
  }

  /**
   * Fetch all real products from the mock store API with throttling and fallback.
   */
  public static async getAllProducts(forceRefresh = false): Promise<CatalogItem[]> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    // Try loading from disk if memory cache is empty
    if (!this.cache) {
      const diskItems = this.loadFromDisk();
      if (diskItems) {
        this.cache = diskItems;
        this.cacheExpiresAt = now + this.TTL_MS;
      }
    }

    if (this.isFetching && this.fetchPromise) {
      return this.fetchPromise;
    }

    // If we already have cached items and are just refreshing, return current cache immediately
    // while refreshing in the background.
    if (this.cache && !forceRefresh) {
      this.refreshCatalogInBackground().catch(err =>
        console.warn('[CatalogService] Background refresh failed:', err.message)
      );
      return this.cache;
    }

    return this.refreshCatalog();
  }

  private static async refreshCatalogInBackground(): Promise<void> {
    if (this.isFetching) return;
    await this.refreshCatalog();
  }

  private static async refreshCatalog(): Promise<CatalogItem[]> {
    this.isFetching = true;
    this.fetchPromise = (async () => {
      try {
        console.log('[CatalogService] Synchronizing catalog from demo.inelabteamdev.com...');
        const map = new Map<number, CatalogItem>();

        // Seed with existing cache if available
        if (this.cache) {
          for (const item of this.cache) {
            map.set(item.id, item);
          }
        }

        // Fetch pages with safe concurrency of 2 to avoid Cloudflare rate limits
        for (let p = 1; p <= 17; p += 2) {
          const batch = [p];
          if (p + 1 <= 17) batch.push(p + 1);

          const results = await Promise.all(
            batch.map(async page => {
              try {
                const res = await fetch(`https://demo.inelabteamdev.com/api/catalog?page=${page}&pageSize=60`, {
                  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ProductPriceTracker/1.0)' },
                  signal: AbortSignal.timeout(7000)
                });
                if (!res.ok) return [];
                const contentType = res.headers.get('content-type') || '';
                if (!contentType.includes('json')) return [];
                const data: any = await res.json();
                return data.items || [];
              } catch (err: any) {
                console.warn(`[CatalogService] Page ${page} fetch notice: ${err.message}`);
                return [];
              }
            })
          );

          for (const pageItems of results) {
            for (const item of pageItems) {
              map.set(item.id, {
                id: item.id,
                slug: item.slug || `product-${item.id}`,
                name: item.name || `Product #${item.id}`,
                brand: item.brand || 'INE Store',
                category: item.category || 'General',
                sku: item.sku || `SKU-${item.id}`,
                description: item.description || '',
                product_url: `https://demo.inelabteamdev.com/product/${item.id}`
              });
            }
          }
          await new Promise(r => setTimeout(r, 60)); // Polite throttle
        }

        const formatted = Array.from(map.values()).sort((a, b) => a.id - b.id);

        if (formatted.length > 0) {
          this.cache = formatted;
          this.cacheExpiresAt = Date.now() + this.TTL_MS;
          this.saveToDisk(formatted);
          console.log(`[CatalogService] Catalog cached successfully with ${formatted.length} real products.`);
          return formatted;
        }

        // If fetch yielded 0 items (e.g. offline), try disk or keep existing
        if (this.cache && this.cache.length > 0) {
          return this.cache;
        }

        throw new Error('No products could be fetched from catalog.');
      } catch (err: any) {
        console.error('[CatalogService] Catalog synchronization error:', err.message);
        if (this.cache && this.cache.length > 0) {
          return this.cache;
        }
        throw err;
      } finally {
        this.isFetching = false;
        this.fetchPromise = null;
      }
    })();

    return this.fetchPromise;
  }

  /**
   * Search and filter the catalog with multi-token query, partial matching,
   * case insensitivity, whitespace trimming, and relevance sorting.
   */
  public static async searchProducts(params: {
    query?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CatalogSearchResult> {
    const all = await this.getAllProducts();
    const rawQuery = (params.query || '').trim();
    const cleanQuery = rawQuery.toLowerCase();
    const categoryFilter = (params.category || '').trim().toLowerCase();
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 30));

    // Extract all unique categories for UI filters
    const categoriesSet = new Set<string>();
    for (const item of all) {
      if (item.category) categoriesSet.add(item.category);
    }
    const categories = Array.from(categoriesSet).sort();

    // If query is empty and no category filter, return 0 items + categories list
    // (satisfies Requirement 6: empty query should not dump catalog / show empty state)
    if (!cleanQuery && (!categoryFilter || categoryFilter === 'all')) {
      return {
        total: 0,
        page,
        pageSize,
        totalPages: 0,
        categories,
        items: []
      };
    }

    // Filter items
    let filtered = all;

    // 1. Category filter
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(item => (item.category || '').toLowerCase() === categoryFilter);
    }

    // 2. Query filter (multi-token, case-insensitive, partial match on name, brand, SKU)
    if (cleanQuery) {
      const tokens = cleanQuery.split(/\s+/).filter(t => t.length > 0);

      filtered = filtered.filter(item => {
        const nameLower = (item.name || '').toLowerCase();
        const brandLower = (item.brand || '').toLowerCase();
        const categoryLower = (item.category || '').toLowerCase();
        const skuLower = (item.sku || '').toLowerCase();
        const skuNoHyphen = skuLower.replace(/-/g, '');
        const descLower = (item.description || '').toLowerCase();

        // Check each token against name, brand, category, SKU, description
        return tokens.every(token => {
          const cleanToken = token.replace(/-/g, '');
          return (
            nameLower.includes(token) ||
            brandLower.includes(token) ||
            skuLower.includes(token) ||
            skuNoHyphen.includes(cleanToken) ||
            categoryLower.includes(token) ||
            descLower.includes(token)
          );
        });
      });

      // 3. Relevance ranking
      filtered.sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aSku = a.sku.toLowerCase();
        const bSku = b.sku.toLowerCase();
        const aBrand = a.brand.toLowerCase();
        const bBrand = b.brand.toLowerCase();

        // Exact SKU match gets top priority
        const aExactSku = aSku === cleanQuery;
        const bExactSku = bSku === cleanQuery;
        if (aExactSku && !bExactSku) return -1;
        if (!aExactSku && bExactSku) return 1;

        // SKU starts with query
        const aSkuStart = aSku.startsWith(cleanQuery);
        const bSkuStart = bSku.startsWith(cleanQuery);
        if (aSkuStart && !bSkuStart) return -1;
        if (!aSkuStart && bSkuStart) return 1;

        // Exact name match
        const aExactName = aName === cleanQuery;
        const bExactName = bName === cleanQuery;
        if (aExactName && !bExactName) return -1;
        if (!aExactName && bExactName) return 1;

        // Name starts with query
        const aNameStart = aName.startsWith(cleanQuery);
        const bNameStart = bName.startsWith(cleanQuery);
        if (aNameStart && !bNameStart) return -1;
        if (!aNameStart && bNameStart) return 1;

        // Brand starts with query
        const aBrandStart = aBrand.startsWith(cleanQuery);
        const bBrandStart = bBrand.startsWith(cleanQuery);
        if (aBrandStart && !bBrandStart) return -1;
        if (!aBrandStart && bBrandStart) return 1;

        return a.id - b.id;
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize) || 1;
    const startIndex = (page - 1) * pageSize;
    const items = filtered.slice(startIndex, startIndex + pageSize);

    return {
      total,
      page,
      pageSize,
      totalPages,
      categories,
      items
    };
  }
}
