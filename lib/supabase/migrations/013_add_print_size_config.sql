-- Migration: Add print size configuration table for DPI metadata
-- This allows admin configuration of physical dimensions for each print size
-- Ensures exported images show correct physical size in photo editing software

-- Create print size configuration table
CREATE TABLE IF NOT EXISTS print_size_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  print_size TEXT UNIQUE NOT NULL,
  width_inches DECIMAL(5,2) NOT NULL,
  height_inches DECIMAL(5,2) NOT NULL,
  default_dpi INTEGER DEFAULT 300,
  default_width_pixels INTEGER,
  default_height_pixels INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- Add initial configuration values (admin can modify these)
INSERT INTO print_size_config (
  print_size, 
  width_inches, 
  height_inches, 
  default_dpi,
  default_width_pixels, 
  default_height_pixels,
  notes
)
VALUES 
  ('4R', 4.0, 6.0, 300, 1200, 1800, 'Standard 4x6 inch photo print'),
  ('5R', 5.0, 7.0, 300, 1500, 2100, 'Standard 5x7 inch photo print'),
  ('A4', 8.27, 11.69, 300, 2480, 3508, 'ISO 216 A4 paper size')
ON CONFLICT (print_size) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_print_size_config_print_size ON print_size_config(print_size);

-- Enable Row Level Security
ALTER TABLE print_size_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Everyone can read print size configurations
CREATE POLICY "Print size configs are viewable by everyone" 
  ON print_size_config FOR SELECT 
  USING (true);

-- Only admins can modify print size configurations
CREATE POLICY "Only admins can insert print size configs" 
  ON print_size_config FOR INSERT 
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.preferences->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can update print size configs" 
  ON print_size_config FOR UPDATE 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.preferences->>'role' = 'admin'
    )
  );

CREATE POLICY "Only admins can delete print size configs" 
  ON print_size_config FOR DELETE 
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.preferences->>'role' = 'admin'
    )
  );

-- Add updated_at trigger
CREATE TRIGGER update_print_size_config_updated_at
  BEFORE UPDATE ON print_size_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE print_size_config IS 'Configuration table for print size physical dimensions and DPI settings';
COMMENT ON COLUMN print_size_config.print_size IS 'Print size identifier (4R, 5R, A4, etc.)';
COMMENT ON COLUMN print_size_config.width_inches IS 'Physical width in inches for this print size';
COMMENT ON COLUMN print_size_config.height_inches IS 'Physical height in inches for this print size';
COMMENT ON COLUMN print_size_config.default_dpi IS 'Default DPI for this print size (typically 300)';
COMMENT ON COLUMN print_size_config.default_width_pixels IS 'Default pixel width at default DPI';
COMMENT ON COLUMN print_size_config.default_height_pixels IS 'Default pixel height at default DPI';
COMMENT ON COLUMN print_size_config.notes IS 'Optional notes about this print size configuration';

-- Optional: Add per-template dimension overrides to manual_templates
-- This allows specific templates to have custom physical dimensions
ALTER TABLE manual_templates 
ADD COLUMN IF NOT EXISTS custom_width_inches DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS custom_height_inches DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS custom_dpi INTEGER;

COMMENT ON COLUMN manual_templates.custom_width_inches IS 'Override physical width in inches for this specific template';
COMMENT ON COLUMN manual_templates.custom_height_inches IS 'Override physical height in inches for this specific template';
COMMENT ON COLUMN manual_templates.custom_dpi IS 'Override DPI for this specific template';