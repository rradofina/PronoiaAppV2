-- Migration 008: Fix package_templates unique constraint to allow duplicate templates
-- This allows the same template to be used multiple times in a single package
-- by adding a position field and updating the unique constraint

-- Drop the existing unique constraint that prevents duplicate templates
ALTER TABLE package_templates DROP CONSTRAINT IF EXISTS package_templates_package_id_template_id_key;

-- Add position field if it doesn't exist
ALTER TABLE package_templates ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Update existing records to have sequential positions
WITH numbered_templates AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (PARTITION BY package_id ORDER BY order_index, created_at) as new_position
  FROM package_templates
)
UPDATE package_templates 
SET position = numbered_templates.new_position
FROM numbered_templates 
WHERE package_templates.id = numbered_templates.id;

-- Make position NOT NULL
ALTER TABLE package_templates ALTER COLUMN position SET NOT NULL;

-- Create new unique constraint that allows duplicate templates but ensures unique positions per package
ALTER TABLE package_templates ADD CONSTRAINT package_templates_package_id_position_key UNIQUE (package_id, position);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_package_templates_package_position ON package_templates (package_id, position);

-- Update the table comment
COMMENT ON TABLE package_templates IS 'Associates templates with packages, allowing same template multiple times with unique positions';
COMMENT ON COLUMN package_templates.position IS 'Sequential position of template in package (1-based), unique per package';