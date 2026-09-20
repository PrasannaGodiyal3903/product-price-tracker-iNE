-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES FOR PRODUCT PRICE TRACKER
-- ==============================================================================

-- 1. Enable RLS on all tracker tables
ALTER TABLE IF EXISTS tracked_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scrape_logs ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if any to prevent duplication
DROP POLICY IF EXISTS "Allow select for anon and authenticated" ON tracked_products;
DROP POLICY IF EXISTS "Allow insert for anon and authenticated" ON tracked_products;
DROP POLICY IF EXISTS "Allow update for anon and authenticated" ON tracked_products;
DROP POLICY IF EXISTS "Allow delete for anon and authenticated" ON tracked_products;

DROP POLICY IF EXISTS "Allow select for anon and authenticated" ON price_history;
DROP POLICY IF EXISTS "Allow insert for anon and authenticated" ON price_history;

DROP POLICY IF EXISTS "Allow select for anon and authenticated" ON scrape_logs;
DROP POLICY IF EXISTS "Allow insert for anon and authenticated" ON scrape_logs;

-- 3. tracked_products policies
CREATE POLICY "Allow select for anon and authenticated"
ON tracked_products FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow insert for anon and authenticated"
ON tracked_products FOR INSERT
TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Allow update for anon and authenticated"
ON tracked_products FOR UPDATE
TO anon, authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow delete for anon and authenticated"
ON tracked_products FOR DELETE
TO anon, authenticated
USING (true);

-- 4. price_history policies
CREATE POLICY "Allow select for anon and authenticated"
ON price_history FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow insert for anon and authenticated"
ON price_history FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 5. scrape_logs policies
CREATE POLICY "Allow select for anon and authenticated"
ON scrape_logs FOR SELECT
TO anon, authenticated
USING (true);

CREATE POLICY "Allow insert for anon and authenticated"
ON scrape_logs FOR INSERT
TO anon, authenticated
WITH CHECK (true);
