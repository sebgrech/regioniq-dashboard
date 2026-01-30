-- =============================================================================
-- Authorized Users Table
-- Controls access to admin features (assets page, site evaluations, etc.)
-- =============================================================================

-- Create the table
CREATE TABLE IF NOT EXISTS authorized_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'user',  -- 'admin', 'assets', 'viewer', etc.
  name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT
);

-- Index for fast email lookups
CREATE INDEX IF NOT EXISTS idx_authorized_users_email ON authorized_users(email);

-- Enable Row Level Security
ALTER TABLE authorized_users ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read for authenticated users (needed for auth checks)
CREATE POLICY "Allow read for authenticated" ON authorized_users
  FOR SELECT USING (true);

-- =============================================================================
-- Roles:
--   'admin'  - Full access to all admin features
--   'assets' - Access to asset pages and site evaluations
--   'viewer' - Read-only access (future use)
-- =============================================================================

-- Example inserts:
-- INSERT INTO authorized_users (email, role, name) VALUES
--   ('slrgrech@hotmail.com', 'admin', 'Seb'),
--   ('user@example.com', 'assets', 'Asset User');
