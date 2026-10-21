-- Add prompt_version column to reference_images for A/B testing
-- This tracks which version of the AI prompt was used for tag suggestions

ALTER TABLE reference_images
ADD COLUMN IF NOT EXISTS prompt_version TEXT DEFAULT 'baseline';

-- Add comment
COMMENT ON COLUMN reference_images.prompt_version IS 'Version of AI prompt used: baseline or enhanced';

-- Create index for analytics queries
CREATE INDEX IF NOT EXISTS idx_reference_images_prompt_version
ON reference_images(prompt_version);
