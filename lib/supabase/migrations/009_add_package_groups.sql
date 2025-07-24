-- Migration 009: Add package groups functionality
-- Allows organizing packages into editable groups like "Premium Packages", "Student Packages", etc.

-- Create package_groups table
CREATE TABLE IF NOT EXISTS package_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(255)
);

-- Add RLS policies for package_groups
ALTER TABLE package_groups ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read package groups
CREATE POLICY "Anyone can read package groups" ON package_groups
  FOR SELECT USING (true);

-- Policy: Only authenticated users can insert package groups
CREATE POLICY "Authenticated users can insert package groups" ON package_groups
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Policy: Only authenticated users can update package groups
CREATE POLICY "Authenticated users can update package groups" ON package_groups
  FOR UPDATE USING (auth.role() = 'authenticated');

-- Policy: Only authenticated users can delete package groups
CREATE POLICY "Authenticated users can delete package groups" ON package_groups
  FOR DELETE USING (auth.role() = 'authenticated');

-- Add group_id column to manual_packages table
ALTER TABLE manual_packages ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES package_groups(id) ON DELETE SET NULL;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_manual_packages_group_id ON manual_packages (group_id);
CREATE INDEX IF NOT EXISTS idx_package_groups_sort_order ON package_groups (sort_order);

-- Insert default package groups
INSERT INTO package_groups (name, description, sort_order, created_by) VALUES
  ('Premium Packages', 'High-end packages for premium clients', 1, 'system'),
  ('Student Packages', 'Discounted packages for students', 2, 'system'),
  ('Special Offers', 'Limited time and seasonal packages', 3, 'system')
ON CONFLICT DO NOTHING;

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_package_groups_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_package_groups_updated_at
  BEFORE UPDATE ON package_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_package_groups_updated_at();

-- Update table comments
COMMENT ON TABLE package_groups IS 'Groups for organizing packages (Premium, Student, Special Offers, etc.)';
COMMENT ON COLUMN package_groups.name IS 'Display name of the package group';
COMMENT ON COLUMN package_groups.description IS 'Optional description of the group';
COMMENT ON COLUMN package_groups.sort_order IS 'Order for displaying groups (ascending)';
COMMENT ON COLUMN manual_packages.group_id IS 'Reference to package group (null = ungrouped)';