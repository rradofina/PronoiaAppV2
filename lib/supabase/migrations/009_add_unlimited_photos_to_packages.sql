-- Migration: Add unlimited photos feature to manual packages
-- Date: 2025-01-25
-- Description: Add is_unlimited_photos boolean flag to allow packages with unlimited photo selections

-- Add is_unlimited_photos column to manual_packages table
ALTER TABLE manual_packages 
ADD COLUMN IF NOT EXISTS is_unlimited_photos BOOLEAN NOT NULL DEFAULT false;

-- Add comment to document the column
COMMENT ON COLUMN manual_packages.is_unlimited_photos IS 'When true, this package allows unlimited photo selections (ignores photo_limit)';

-- Update the check constraint to allow photo_limit to be flexible when unlimited
-- Remove existing constraint if it exists
ALTER TABLE manual_packages DROP CONSTRAINT IF EXISTS manual_packages_photo_limit_check;

-- Add new constraint that allows photo_limit to be any positive number or ignored when unlimited
ALTER TABLE manual_packages 
ADD CONSTRAINT manual_packages_photo_limit_check 
CHECK (photo_limit > 0);

-- Note: We keep photo_limit as NOT NULL but when is_unlimited_photos is true, 
-- the application logic will ignore the photo_limit value
-- This maintains data consistency while allowing unlimited functionality

-- Create an index for better performance when querying unlimited packages
CREATE INDEX IF NOT EXISTS idx_manual_packages_unlimited_photos 
ON manual_packages(is_unlimited_photos) 
WHERE is_unlimited_photos = true;

-- Update any existing "student" or "unlimited" packages if they exist
-- This is optional and can be customized based on existing data
UPDATE manual_packages 
SET is_unlimited_photos = true 
WHERE LOWER(name) LIKE '%student%' 
   OR LOWER(name) LIKE '%unlimited%' 
   OR LOWER(description) LIKE '%unlimited%'
   OR LOWER(description) LIKE '%all soft%';

-- Add a helpful view for unlimited packages
CREATE OR REPLACE VIEW unlimited_packages AS
SELECT 
    id,
    name,
    description,
    print_size,
    template_count,
    price,
    photo_limit,
    is_unlimited_photos,
    is_active,
    is_default,
    created_at,
    updated_at
FROM manual_packages 
WHERE is_unlimited_photos = true 
  AND is_active = true;

COMMENT ON VIEW unlimited_packages IS 'View of all active packages that offer unlimited photo selections';