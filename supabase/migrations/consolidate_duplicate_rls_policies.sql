-- Consolidate duplicate RLS policies for better performance
-- Fixes performance warning: Multiple permissive policies cause unnecessary overhead
-- Reference: https://supabase.com/docs/guides/database/database-linter?lint=0006_multiple_permissive_policies

-- =============================================================================
-- REFERENCE_IMAGES TABLE
-- =============================================================================

-- Drop old duplicate policies
DROP POLICY IF EXISTS "Authenticated users full access to images" ON reference_images;
DROP POLICY IF EXISTS "Anyone can view approved images" ON reference_images;

-- Create consolidated policies
-- SELECT: Authenticated users see all, public users see only tagged/approved
CREATE POLICY "View images"
  ON reference_images
  FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text)
    OR
    ((status)::text = ANY ((ARRAY['tagged'::character varying, 'approved'::character varying])::text[]))
  );

-- INSERT: Only authenticated users
CREATE POLICY "Authenticated users can insert images"
  ON reference_images
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Only authenticated users
CREATE POLICY "Authenticated users can update images"
  ON reference_images
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Only authenticated users
CREATE POLICY "Authenticated users can delete images"
  ON reference_images
  FOR DELETE
  TO authenticated
  USING (true);

-- =============================================================================
-- TAG_VOCABULARY TABLE
-- =============================================================================

-- Drop old duplicate policies
DROP POLICY IF EXISTS "Authenticated users manage tags" ON tag_vocabulary;
DROP POLICY IF EXISTS "Anyone can view active tags" ON tag_vocabulary;

-- Create consolidated policies
-- SELECT: Authenticated users see all, public users see only active tags
CREATE POLICY "View tags"
  ON tag_vocabulary
  FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text)
    OR
    (is_active = true)
  );

-- INSERT: Only authenticated users
CREATE POLICY "Authenticated users can insert tags"
  ON tag_vocabulary
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Only authenticated users
CREATE POLICY "Authenticated users can update tags"
  ON tag_vocabulary
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Only authenticated users
CREATE POLICY "Authenticated users can delete tags"
  ON tag_vocabulary
  FOR DELETE
  TO authenticated
  USING (true);

-- =============================================================================
-- VOCABULARY_CONFIG TABLE
-- =============================================================================

-- Drop old duplicate policies
DROP POLICY IF EXISTS "Authenticated users manage config" ON vocabulary_config;
DROP POLICY IF EXISTS "Anyone can view active config" ON vocabulary_config;

-- Create consolidated policies
-- SELECT: Authenticated users see all, public users see only active config
CREATE POLICY "View config"
  ON vocabulary_config
  FOR SELECT
  USING (
    (auth.role() = 'authenticated'::text)
    OR
    (is_active = true)
  );

-- INSERT: Only authenticated users
CREATE POLICY "Authenticated users can insert config"
  ON vocabulary_config
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- UPDATE: Only authenticated users
CREATE POLICY "Authenticated users can update config"
  ON vocabulary_config
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- DELETE: Only authenticated users
CREATE POLICY "Authenticated users can delete config"
  ON vocabulary_config
  FOR DELETE
  TO authenticated
  USING (true);

-- =============================================================================
-- TAG_CORRECTIONS TABLE (add RLS while we're at it)
-- =============================================================================

-- Enable RLS on tag_corrections if not already enabled
ALTER TABLE tag_corrections ENABLE ROW LEVEL SECURITY;

-- Drop any existing policies
DROP POLICY IF EXISTS "Authenticated users manage corrections" ON tag_corrections;

-- Only authenticated users can access corrections
CREATE POLICY "Authenticated users manage corrections"
  ON tag_corrections
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Add comments
COMMENT ON POLICY "View images" ON reference_images IS 'Consolidated policy: authenticated see all, public see approved only';
COMMENT ON POLICY "View tags" ON tag_vocabulary IS 'Consolidated policy: authenticated see all, public see active only';
COMMENT ON POLICY "View config" ON vocabulary_config IS 'Consolidated policy: authenticated see all, public see active only';
COMMENT ON POLICY "Authenticated users manage corrections" ON tag_corrections IS 'Only authenticated users can access tag corrections';
