-- Migration: Add photo_limit column to manual_packages table
-- This allows packages to specify the maximum number of photos a client can select

-- Add photo_limit column to manual_packages
ALTER TABLE manual_packages 
ADD COLUMN IF NOT EXISTS photo_limit INTEGER NOT NULL DEFAULT 20 CHECK (photo_limit > 0);

-- Update existing packages to have a reasonable default photo limit
UPDATE manual_packages 
SET photo_limit = 20 
WHERE photo_limit IS NULL;

-- Add comment to document the purpose
COMMENT ON COLUMN manual_packages.photo_limit IS 'Maximum number of photos a client can select with this package';

-- Update the updated_at timestamp for affected rows
UPDATE manual_packages 
SET updated_at = NOW() 
WHERE photo_limit = 20;