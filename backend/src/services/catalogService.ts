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
  private static readonly TTL_MS = 10 * 60 * 1000; // 10 minutes
  private static isFetching = false;
  private static fetchPromise: Promise<CatalogItem[]> | null = null;

  /**
   * Fetch all 1,000 products from the mock store API across all pages with caching.
   */
  public static async getAllProducts(forceRefresh = false): Promise<CatalogItem[]> {
    const now = Date.now();
    if (!forceRefresh && this.cache && now < this.cacheExpiresAt) {
      return this.cache;
    }

    if (this.isFetching && this.fetchPromise) {
      return this.fetchPromise;
    }

    this.isFetching = true;
    this.fetchPromise = (async () => {
      try {
        console.log('[CatalogService] Fetching full product catalog from demo.inelabteamdev.com...');
        // First fetch page 1 to detect total items and pages
        const firstRes = await fetch('https://demo.inelabteamdev.com/api/catalog?page=1&pageSize=60');
        if (!firstRes.ok) {
          throw new Error('Failed to fetch page 1: HTTP ' + firstRes.status);
        }
        const firstData: any = await firstRes.json();
        const totalPages = firstData.pages || 17;
        const allItems: any[] = [...(firstData.items || [])];

        // Fetch remaining pages concurrently
        if (totalPages > 1) {
          const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
          const pageResults = await Promise.all(
            remainingPages.map(async (page) => {
              try {
                const res = await fetch('https://demo.inelabteamdev.com/api/catalog?page=' + page + '&pageSize=60');
                if (!res.ok) return [];
                const data: any = await res.json();
                return data.items || [];
              } catch (err) {
                console.warn('[CatalogService] Failed to fetch catalog page ' + page + ':', err);
                return [];
              }
            })
          );

          for (const pageItems of pageResults) {
            allItems.push(...pageItems);
          }
        }

        // Map and format
        const formatted: CatalogItem[] = allItems.map((item: any) => ({
          id: item.id,
          slug: item.slug || ('product-' + item.id),
          name: item.name || ('Product #' + item.id),
          brand: item.brand || 'INE Store',
          category: item.category || 'General',
          sku: item.sku || ('SKU-' + item.id),
          description: item.description || '',
          product_url: 'https://demo.inelabteamdev.com/product/' + item.id
        }));

        this.cache = formatted;
        this.cacheExpiresAt = Date.now() + this.TTL_MS;
        console.log('[CatalogService] Catalog cached successfully with ' + formatted.length + ' products.');
        return formatted;
      } catch (err: any) {
        console.error('[CatalogService] Error fetching full catalog:', err.message);
        if (this.cache) {
          console.warn('[CatalogService] Returning stale cache due to fetch error.');
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
   * Search and filter the catalog with multi-token query and optional category filter.
   */
  public static async searchProducts(params: {
    query?: string;
    category?: string;
    page?: number;
    pageSize?: number;
  }): Promise<CatalogSearchResult> {
    const all = await this.getAllProducts();
    const query = (params.query || '').trim().toLowerCase();
    const categoryFilter = (params.category || '').trim().toLowerCase();
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(params.pageSize) || 20));

    // Extract all unique categories for UI filters
    const categoriesSet = new Set<string>();
    for (const item of all) {
      if (item.category) categoriesSet.add(item.category);
    }
    const categories = Array.from(categoriesSet).sort();

    // Filter items
    let filtered = all;

    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(item => item.category.toLowerCase() === categoryFilter);
    }

    if (query) {
      const tokens = query.split(/\s+/).filter(t => t.length > 0);
      filtered = filtered.filter(item => {
        const searchable = (item.name + ' ' + item.brand + ' ' + item.category + ' ' + item.sku + ' ' + item.description).toLowerCase();
        return tokens.every(token => searchable.includes(token));
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / pageSize);
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
