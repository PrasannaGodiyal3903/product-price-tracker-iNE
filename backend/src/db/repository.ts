import { supabase } from './supabase';
import { TrackedProduct, PriceHistory, ScrapeLog } from './types';
import crypto from 'crypto';

// In-memory fallback cache for development/testing when Supabase credentials are not yet supplied
const fallbackProducts: Map<string, TrackedProduct> = new Map();
const fallbackHistory: PriceHistory[] = [];
const fallbackLogs: ScrapeLog[] = [];

function handleSupabaseError(action: string, error: any): never {
  if (error?.code === '42501') {
    throw new Error(
      `[DB RLS Error] Action '${action}' blocked by Supabase Row-Level Security policy (code 42501). ` +
      `Fix: Either run 'supabase/migrations/002_rls_policies.sql' in the Supabase SQL editor, ` +
      `or provide SUPABASE_SERVICE_ROLE_KEY in your environment to bypass RLS for backend operations. ` +
      `Original message: ${error.message}`
    );
  }
  throw new Error(`Supabase ${action} error: ${error.message || JSON.stringify(error)}`);
}

export class Repository {
  /**
   * Find product by URL (prevents duplicate tracking)
   */
  public static async findProductByUrl(url: string): Promise<TrackedProduct | null> {
    const normalizedUrl = url.trim().toLowerCase();
    if (supabase) {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('product_url', normalizedUrl)
        .maybeSingle();

      if (error) handleSupabaseError('findProductByUrl', error);
      return data;
    }

    for (const p of fallbackProducts.values()) {
      if (p.product_url.toLowerCase() === normalizedUrl) return p;
    }
    return null;
  }

  /**
   * Create a new tracked product
   */
  public static async createProduct(data: {
    product_name: string;
    product_url: string;
    external_product_id?: number | null;
    category?: string | null;
    brand?: string | null;
  }): Promise<TrackedProduct> {
    const now = new Date().toISOString();
    const normalizedUrl = data.product_url.trim();

    if (supabase) {
      const { data: created, error } = await supabase
        .from('tracked_products')
        .insert({
          product_name: data.product_name,
          product_url: normalizedUrl,
          external_product_id: data.external_product_id ?? null,
          category: data.category ?? null,
          brand: data.brand ?? null,
          created_at: now,
          updated_at: now,
          is_active: true
        })
        .select()
        .single();

      if (error) handleSupabaseError('createProduct', error);
      return created;
    }

    const newProd: TrackedProduct = {
      id: crypto.randomUUID(),
      product_name: data.product_name,
      product_url: normalizedUrl,
      external_product_id: data.external_product_id ?? null,
      category: data.category ?? null,
      brand: data.brand ?? null,
      created_at: now,
      updated_at: now,
      is_active: true
    };
    fallbackProducts.set(newProd.id, newProd);
    return newProd;
  }

  /**
   * List all tracked products with latest price and stock status
   */
  public static async listTrackedProducts(): Promise<TrackedProduct[]> {
    if (supabase) {
      const { data: products, error } = await supabase
        .from('tracked_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) handleSupabaseError('listTrackedProducts', error);

      // Enrich with latest price & stock
      const enriched: TrackedProduct[] = [];
      for (const prod of products || []) {
        const { data: history } = await supabase
          .from('price_history')
          .select('*')
          .eq('product_id', prod.id)
          .order('scraped_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const { data: log } = await supabase
          .from('scrape_logs')
          .select('*')
          .eq('product_id', prod.id)
          .order('started_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        enriched.push({
          ...prod,
          latest_price: history ? Number(history.price) : null,
          latest_stock_status: history ? history.stock_status : null,
          last_scraped_at: log ? log.started_at : null,
          last_scrape_status: log ? log.status : null
        });
      }
      return enriched;
    }

    const list = Array.from(fallbackProducts.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return list.map(p => {
      const pHistory = fallbackHistory
        .filter(h => h.product_id === p.id)
        .sort((a, b) => new Date(b.scraped_at).getTime() - new Date(a.scraped_at).getTime())[0];

      const pLog = fallbackLogs
        .filter(l => l.product_id === p.id)
        .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())[0];

      return {
        ...p,
        latest_price: pHistory ? pHistory.price : null,
        latest_stock_status: pHistory ? pHistory.stock_status : null,
        last_scraped_at: pLog ? pLog.started_at : null,
        last_scrape_status: pLog ? pLog.status : null
      };
    });
  }

  /**
   * Find product by ID
   */
  public static async findProductById(id: string): Promise<TrackedProduct | null> {
    if (supabase) {
      const { data, error } = await supabase
        .from('tracked_products')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) handleSupabaseError('findProductById', error);
      return data;
    }
    return fallbackProducts.get(id) || null;
  }

  /**
   * Save valid price history.
   * STRICT INTEGRITY: Throws if price <= 0 or is NaN.
   */
  public static async recordPriceHistory(data: {
    product_id: string;
    price: number;
    currency?: string;
    stock_status: string;
    stock_quantity?: number | null;
    raw_stock_text?: string | null;
    scraped_at?: string;
  }): Promise<PriceHistory> {
    if (!data.price || isNaN(data.price) || data.price <= 0) {
      throw new Error(`Integrity Violation: Cannot insert invalid price (${data.price}) into price_history.`);
    }

    const now = data.scraped_at || new Date().toISOString();

    if (supabase) {
      const { data: history, error } = await supabase
        .from('price_history')
        .insert({
          product_id: data.product_id,
          price: data.price,
          currency: data.currency || 'INR',
          stock_status: data.stock_status,
          stock_quantity: data.stock_quantity ?? null,
          raw_stock_text: data.raw_stock_text ?? null,
          scraped_at: now
        })
        .select()
        .single();

      if (error) handleSupabaseError('recordPriceHistory', error);
      return history;
    }

    const record: PriceHistory = {
      id: crypto.randomUUID(),
      product_id: data.product_id,
      price: data.price,
      currency: data.currency || 'INR',
      stock_status: data.stock_status,
      stock_quantity: data.stock_quantity ?? null,
      raw_stock_text: data.raw_stock_text ?? null,
      scraped_at: now
    };
    fallbackHistory.push(record);
    return record;
  }

  /**
   * Record every single scrape attempt honestly in scrape_logs
   */
  public static async recordScrapeLog(data: {
    product_id: string;
    attempt_number: number;
    status: 'SUCCESS' | 'RETRY' | 'FAILED';
    message: string;
    error_type?: string | null;
    started_at: string;
    finished_at: string;
    duration_ms: number;
  }): Promise<ScrapeLog> {
    if (supabase) {
      const { data: log, error } = await supabase
        .from('scrape_logs')
        .insert({
          product_id: data.product_id,
          attempt_number: data.attempt_number,
          status: data.status,
          message: data.message,
          error_type: data.error_type ?? null,
          started_at: data.started_at,
          finished_at: data.finished_at,
          duration_ms: data.duration_ms
        })
        .select()
        .single();

      if (error) handleSupabaseError('recordScrapeLog', error);
      return log;
    }

    const log: ScrapeLog = {
      id: crypto.randomUUID(),
      product_id: data.product_id,
      attempt_number: data.attempt_number,
      status: data.status,
      message: data.message,
      error_type: data.error_type ?? null,
      started_at: data.started_at,
      finished_at: data.finished_at,
      duration_ms: data.duration_ms
    };
    fallbackLogs.push(log);
    return log;
  }

  /**
   * Get price history for charting
   */
  public static async getPriceHistory(productId: string): Promise<PriceHistory[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('product_id', productId)
        .order('scraped_at', { ascending: true });

      if (error) handleSupabaseError('getPriceHistory', error);
      return data || [];
    }

    return fallbackHistory
      .filter(h => h.product_id === productId)
      .sort((a, b) => new Date(a.scraped_at).getTime() - new Date(b.scraped_at).getTime());
  }

  /**
   * Get scrape logs for a product
   */
  public static async getScrapeLogs(productId: string): Promise<ScrapeLog[]> {
    if (supabase) {
      const { data, error } = await supabase
        .from('scrape_logs')
        .select('*')
        .eq('product_id', productId)
        .order('started_at', { ascending: false });

      if (error) handleSupabaseError('getScrapeLogs', error);
      return data || [];
    }

    return fallbackLogs
      .filter(l => l.product_id === productId)
      .sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime());
  }
}
