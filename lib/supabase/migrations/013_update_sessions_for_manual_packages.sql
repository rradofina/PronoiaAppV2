-- Update Sessions for Manual Package System
-- Adds package_id reference to manual_packages and removes old package_type

-- Add package_id column to reference manual_packages
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS package_id UUID REFERENCES manual_packages(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_sessions_package_id ON sessions (package_id);

-- Update table comment
COMMENT ON COLUMN sessions.package_id IS 'Reference to manual package selected by user';

-- Note: Keep package_type column for backward compatibility
-- The old package_type (A, B, C, D) can coexist with new package_id system