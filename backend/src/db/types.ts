export interface TrackedProduct {
  id: string;
  product_name: string;
  product_url: string;
  external_product_id: number | null;
  category: string | null;
  brand: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  // Computed fields for dashboard
  latest_price?: number | null;
  latest_stock_status?: string | null;
  last_scraped_at?: string | null;
  last_scrape_status?: string | null;
}

export interface PriceHistory {
  id: string;
  product_id: string;
  price: number;
  currency: string;
  stock_status: string;
  stock_quantity: number | null;
  raw_stock_text?: string | null;
  scraped_at: string;
}

export interface ScrapeLog {
  id: string;
  product_id: string;
  attempt_number: number;
  status: 'SUCCESS' | 'RETRY' | 'FAILED';
  message: string;
  error_type: string | null;
  started_at: string;
  finished_at: string;
  duration_ms: number;
}
