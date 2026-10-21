-- Create vocabulary_config table for flexible vocabulary structure
CREATE TABLE IF NOT EXISTS vocabulary_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Only one config exists at a time (we replace, not version)
  is_active BOOLEAN DEFAULT true,

  -- Structure definition (defines the entire vocabulary system)
  structure JSONB NOT NULL,
  /* Example structure:
  {
    "categories": [
      {
        "key": "industries",
        "label": "Industries",
        "storage_type": "array",
        "storage_path": "industries",
        "search_weight": 5,
        "description": "Select applicable industries",
        "placeholder": "e.g., restaurant, tech, fashion"
      },
      ...
    ]
  }
  */

  -- Metadata
  config_name VARCHAR(255) NOT NULL DEFAULT 'Current Vocabulary',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  description TEXT
);

-- Only allow one active config at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_config
  ON vocabulary_config(is_active)
  WHERE is_active = true;

-- Insert current mock vocabulary as initial config
INSERT INTO vocabulary_config (is_active, config_name, structure, description) VALUES (
  true,
  'Mock Vocabulary (Test Phase)',
  '{
    "categories": [
      {
        "key": "industries",
        "label": "Industries",
        "storage_type": "array",
        "storage_path": "industries",
        "search_weight": 5,
        "description": "Select all applicable industries",
        "placeholder": "restaurant, hospitality, retail, tech, healthcare..."
      },
      {
        "key": "project_types",
        "label": "Project Types",
        "storage_type": "array",
        "storage_path": "project_types",
        "search_weight": 4,
        "description": "Select all applicable project types",
        "placeholder": "branding, website, interior, packaging, editorial..."
      },
      {
        "key": "style",
        "label": "Style Tags",
        "storage_type": "jsonb_array",
        "storage_path": "tags.style",
        "search_weight": 2,
        "description": "Visual style descriptors",
        "placeholder": "minimalist, modern, organic, vintage, brutalist..."
      },
      {
        "key": "mood",
        "label": "Mood Tags",
        "storage_type": "jsonb_array",
        "storage_path": "tags.mood",
        "search_weight": 2,
        "description": "Emotional tone and atmosphere",
        "placeholder": "calm, bold, warm, sophisticated, playful..."
      },
      {
        "key": "elements",
        "label": "Visual Elements",
        "storage_type": "jsonb_array",
        "storage_path": "tags.elements",
        "search_weight": 1,
        "description": "Visual elements present in the image",
        "placeholder": "typography-heavy, photography, natural-materials..."
      },
      {
        "key": "notes",
        "label": "Notes",
        "storage_type": "text",
        "storage_path": "notes",
        "search_weight": 1,
        "description": "Optional notes about this reference image",
        "placeholder": "e.g., Great for high-end restaurant projects..."
      }
    ]
  }'::jsonb,
  'Initial mock vocabulary for testing phase. Matches current tag_vocabulary structure.'
);
