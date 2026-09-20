-- ==============================================================================
-- PRODUCT PRICE TRACKER: DATABASE SCHEMA & RLS POLICIES (SUPABASE POSTGRESQL)
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- TABLE 1: tracked_products
CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_name TEXT NOT NULL,
    product_url TEXT NOT NULL UNIQUE,
    external_product_id INTEGER,
    category TEXT,
    brand TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tracked_products_active ON tracked_products(is_active);
CREATE INDEX IF NOT EXISTS idx_tracked_products_url ON tracked_products(product_url);

-- TABLE 2: price_history
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    price NUMERIC(12, 2) NOT NULL,
    currency TEXT DEFAULT 'INR' NOT NULL,
    stock_status TEXT NOT NULL,
    stock_quantity INTEGER,
    raw_stock_text TEXT,
    scraped_at TIMESTAMPTZ DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_scraped_at ON price_history(scraped_at DESC);

-- TABLE 3: scrape_logs
CREATE TABLE IF NOT EXISTS scrape_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES tracked_products(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('SUCCESS', 'RETRY', 'FAILED')),
    message TEXT NOT NULL,
    error_type TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    finished_at TIMESTAMPTZ NOT NULL,
    duration_ms INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scrape_logs_product_id ON scrape_logs(product_id);
CREATE INDEX IF NOT EXISTS idx_scrape_logs_started_at ON scrape_logs(started_at DESC);

-- ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE scrape_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow select for anon and authenticated" ON tracked_products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert for anon and authenticated" ON tracked_products FOR INSERT TO anon, authenticated WITH CHECK (true);
CREATE POLICY "Allow update for anon and authenticated" ON tracked_products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for anon and authenticated" ON tracked_products FOR DELETE TO anon, authenticated USING (true);

CREATE POLICY "Allow select for anon and authenticated" ON price_history FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert for anon and authenticated" ON price_history FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Allow select for anon and authenticated" ON scrape_logs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Allow insert for anon and authenticated" ON scrape_logs FOR INSERT TO anon, authenticated WITH CHECK (true);
