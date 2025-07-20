-- App Settings and Template Cache Migration
-- This migration adds support for PNG template system with Google Drive folder management

-- App settings table for storing configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(50) PRIMARY KEY,
  value TEXT,
  description TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Template cache table for storing processed template data
CREATE TABLE IF NOT EXISTS template_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  drive_file_id VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  print_size VARCHAR(10) NOT NULL,
  template_type VARCHAR(50), -- 'solo', 'collage', 'photocard', 'photostrip'
  holes JSONB NOT NULL, -- Array of hole coordinates {x, y, width, height, id}
  png_url TEXT NOT NULL,
  file_size_bytes INTEGER,
  dimensions JSONB, -- {width, height}
  has_internal_branding BOOLEAN DEFAULT false,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_template_cache_print_size ON template_cache(print_size);
CREATE INDEX IF NOT EXISTS idx_template_cache_template_type ON template_cache(template_type);
CREATE INDEX IF NOT EXISTS idx_template_cache_drive_file_id ON template_cache(drive_file_id);

-- Default app settings
INSERT INTO app_settings (key, value, description) VALUES 
('template_folder_id', '', 'Google Drive folder ID containing template subfolders')
ON CONFLICT (key) DO NOTHING;

-- Add updated_at trigger for app_settings
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE
    ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_template_cache_updated_at BEFORE UPDATE
    ON template_cache FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comments for documentation
COMMENT ON TABLE app_settings IS 'Application configuration settings';
COMMENT ON TABLE template_cache IS 'Cached template data from Google Drive PNG files';
COMMENT ON COLUMN template_cache.holes IS 'JSON array of photo placement areas: [{id, x, y, width, height}]';
COMMENT ON COLUMN template_cache.dimensions IS 'Template dimensions: {width, height}';
COMMENT ON COLUMN template_cache.has_internal_branding IS 'True if branding is inside photo areas (photocards), false if external';