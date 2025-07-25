-- Add template sample images to manual templates
-- This allows storing sample images showing what templates look like filled with photos

-- Add sample_image_url column to manual_templates
ALTER TABLE manual_templates 
ADD COLUMN IF NOT EXISTS sample_image_url TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN manual_templates.sample_image_url IS 'URL to sample image showing template filled with photos (Google Drive link or Supabase storage)';

-- Update updated_at timestamp when sample_image_url changes
CREATE OR REPLACE FUNCTION update_manual_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger if it doesn't exist
DROP TRIGGER IF EXISTS update_manual_templates_updated_at ON manual_templates;
CREATE TRIGGER update_manual_templates_updated_at
    BEFORE UPDATE ON manual_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_manual_templates_updated_at();