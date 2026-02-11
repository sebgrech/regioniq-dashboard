-- =============================================================================
-- User Portfolio Migration
-- Extends site_evaluations for per-user portfolio ownership
-- =============================================================================

-- 1. Add user_id for per-user ownership
ALTER TABLE site_evaluations
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- 2. Cache geocoded coordinates (avoids repeated Mapbox API calls)
ALTER TABLE site_evaluations
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION;

ALTER TABLE site_evaluations
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

-- 3. Headline / description for site details
ALTER TABLE site_evaluations
  ADD COLUMN IF NOT EXISTS headline TEXT;

-- 4. Soft-delete / archive support
ALTER TABLE site_evaluations
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 4. Primary index for per-user queries
CREATE INDEX IF NOT EXISTS idx_site_evaluations_user_status
  ON site_evaluations(user_id, status);

-- =============================================================================
-- RLS Policies — per-user scoping
-- =============================================================================

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow public read access" ON site_evaluations;
DROP POLICY IF EXISTS "Allow authenticated insert" ON site_evaluations;
DROP POLICY IF EXISTS "Allow authenticated update" ON site_evaluations;

-- Users can read their own sites
CREATE POLICY "Users read own sites" ON site_evaluations
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own sites
CREATE POLICY "Users insert own sites" ON site_evaluations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own sites
CREATE POLICY "Users update own sites" ON site_evaluations
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own sites
CREATE POLICY "Users delete own sites" ON site_evaluations
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can read all sites (for admin portfolio view)
CREATE POLICY "Admins read all sites" ON site_evaluations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM allowed_emails
      WHERE lower(allowed_emails.email) = lower(auth.jwt() ->> 'email')
        AND allowed_emails.assets_access = true
    )
  );
