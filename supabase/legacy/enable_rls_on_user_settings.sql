-- Enable Row Level Security on user_settings table
-- Fixes security issue: RLS was disabled, allowing unrestricted access

-- Enable RLS
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies (in case this migration is re-run)
DROP POLICY IF EXISTS "Authenticated users can read settings" ON user_settings;
DROP POLICY IF EXISTS "Authenticated users can update settings" ON user_settings;
DROP POLICY IF EXISTS "Authenticated users can insert settings" ON user_settings;

-- Policy: Authenticated users can read all settings
CREATE POLICY "Authenticated users can read settings"
  ON user_settings
  FOR SELECT
  TO authenticated
  USING (true);

-- Policy: Authenticated users can update all settings
CREATE POLICY "Authenticated users can update settings"
  ON user_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policy: Authenticated users can insert settings
CREATE POLICY "Authenticated users can insert settings"
  ON user_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Note: DELETE is intentionally not allowed via RLS
-- Settings should be managed through the application, not deleted

-- Add comment
COMMENT ON TABLE user_settings IS 'Application settings with RLS enabled. Only authenticated users can access.';
