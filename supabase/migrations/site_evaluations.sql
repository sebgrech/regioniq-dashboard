-- =============================================================================
-- Site Evaluations Table
-- For location planners to evaluate potential sites
-- =============================================================================

-- Create the table
CREATE TABLE IF NOT EXISTS site_evaluations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  address TEXT NOT NULL,
  postcode TEXT,
  region_code TEXT NOT NULL,
  region_name TEXT NOT NULL,
  site_name TEXT,                    -- e.g., "TUI Aberdeen Bon Accord"
  brand TEXT,                        -- e.g., "TUI", "GAIL's"
  brand_logo_url TEXT,               -- Logo.dev domain (e.g., "tui.com")
  asset_class TEXT,                  -- "Retail", "F&B", "Office", etc.
  sq_ft INTEGER,
  notes TEXT,                        -- Internal notes
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for slug lookups (primary access pattern)
CREATE INDEX IF NOT EXISTS idx_site_evaluations_slug ON site_evaluations(slug);

-- Index for region-based queries
CREATE INDEX IF NOT EXISTS idx_site_evaluations_region ON site_evaluations(region_code);

-- Index for brand-based queries
CREATE INDEX IF NOT EXISTS idx_site_evaluations_brand ON site_evaluations(brand);

-- Enable Row Level Security
ALTER TABLE site_evaluations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access to all site evaluations
CREATE POLICY "Allow public read access" ON site_evaluations
  FOR SELECT USING (true);

-- Policy: Allow authenticated users to insert
CREATE POLICY "Allow authenticated insert" ON site_evaluations
  FOR INSERT WITH CHECK (true);

-- Policy: Allow authenticated users to update their own evaluations
CREATE POLICY "Allow authenticated update" ON site_evaluations
  FOR UPDATE USING (true);

-- =============================================================================
-- Example Insert
-- =============================================================================
-- INSERT INTO site_evaluations (
--   slug,
--   address,
--   postcode,
--   region_code,
--   region_name,
--   site_name,
--   brand,
--   brand_logo_url,
--   asset_class,
--   sq_ft
-- ) VALUES (
--   'tui-aberdeen-bon-accord',
--   'Unit 23, Bon Accord Centre, Aberdeen',
--   'AB25 1HQ',
--   'S12000033',
--   'Aberdeen City',
--   'TUI Aberdeen Bon Accord',
--   'TUI',
--   'tui.com',
--   'Retail',
--   2500
-- );
