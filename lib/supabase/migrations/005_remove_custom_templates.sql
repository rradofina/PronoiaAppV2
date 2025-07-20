-- Remove Custom Template System (Method 2)
-- Keep only PNG template system (Method 1) for simplicity

-- Drop custom template tables and their dependencies
DROP TABLE IF EXISTS custom_templates CASCADE;
DROP TABLE IF EXISTS template_categories CASCADE;

-- Drop related policies
DROP POLICY IF EXISTS "Anyone can view active templates" ON custom_templates;
DROP POLICY IF EXISTS "Admins can manage all templates" ON custom_templates;
DROP POLICY IF EXISTS "Users can view template categories" ON template_categories;
DROP POLICY IF EXISTS "Admins can manage template categories" ON template_categories;

-- Remove from supabaseService types and clean up imports
COMMENT ON TABLE template_cache IS 'PNG templates automatically detected from Google Drive with magenta holes';
COMMENT ON COLUMN template_cache.holes IS 'JSON array of photo placement areas detected from magenta regions: [{id, x, y, width, height}]';
COMMENT ON COLUMN template_cache.template_type IS 'Auto-detected template type: solo, collage, photocard, photostrip';
COMMENT ON COLUMN template_cache.has_internal_branding IS 'Whether branding appears inside photo areas vs external borders';

-- Update app_settings with better descriptions for PNG template system
INSERT INTO app_settings (key, value, description) VALUES 
('png_cache_duration_minutes', '5', 'How long to cache PNG template data before re-scanning Google Drive')
ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description;