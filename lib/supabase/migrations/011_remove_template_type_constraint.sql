-- Remove Template Type Constraint Migration
-- This removes the hardcoded template type constraint to allow dynamic template types

-- Remove the CHECK constraint on template_type to allow any string value
ALTER TABLE manual_templates DROP CONSTRAINT IF EXISTS manual_templates_template_type_check;

-- Add comment to explain the change
COMMENT ON COLUMN manual_templates.template_type IS 'Dynamic template type - can be any string value (solo, collage, photocard, photostrip, or custom types)';

-- Optionally, add a NOT NULL constraint if it doesn't exist (template_type should always have a value)
ALTER TABLE manual_templates ALTER COLUMN template_type SET NOT NULL;