-- Migration: Add base64_preview field to manual_templates for instant loading
-- This allows templates to show immediately while full images load in background

-- Add base64_preview column to manual_templates table
ALTER TABLE manual_templates 
ADD COLUMN base64_preview TEXT;

-- Add comment explaining the field
COMMENT ON COLUMN manual_templates.base64_preview IS 'Base64-encoded small preview image for instant loading (max 50KB recommended)';

-- Create index for better performance when loading templates with previews
CREATE INDEX idx_manual_templates_preview ON manual_templates(id, base64_preview) 
WHERE base64_preview IS NOT NULL;

-- Update RLS policies to include the new field (users can read base64_preview)
-- No additional RLS needed since base64_preview follows same rules as other template fields