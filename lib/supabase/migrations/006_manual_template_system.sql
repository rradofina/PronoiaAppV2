-- Manual Template/Package System Migration
-- This adds manual configuration alongside existing auto-detection system

-- Manual Templates Table
CREATE TABLE IF NOT EXISTS manual_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  template_type TEXT NOT NULL CHECK (template_type IN ('solo', 'collage', 'photocard', 'photostrip')),
  print_size TEXT NOT NULL CHECK (print_size IN ('4R', '5R', 'A4')),
  drive_file_id TEXT NOT NULL UNIQUE,
  holes_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  dimensions JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  created_by TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Manual Packages Table
CREATE TABLE IF NOT EXISTS manual_packages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  thumbnail_url TEXT,
  print_size TEXT NOT NULL CHECK (print_size IN ('4R', '5R', 'A4')),
  template_count INTEGER NOT NULL CHECK (template_count > 0),
  price DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Package-Template Relationships
CREATE TABLE IF NOT EXISTS package_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  package_id UUID REFERENCES manual_packages(id) ON DELETE CASCADE,
  template_id UUID REFERENCES manual_templates(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(package_id, template_id),
  UNIQUE(package_id, order_index)
);

-- Manual Template Categories (optional organization)
CREATE TABLE IF NOT EXISTS manual_template_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT DEFAULT '#6B7280',
  icon TEXT DEFAULT '📁',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add category relationship to templates
ALTER TABLE manual_templates 
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES manual_template_categories(id) ON DELETE SET NULL;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_templates_active ON manual_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_manual_templates_type_size ON manual_templates(template_type, print_size);
CREATE INDEX IF NOT EXISTS idx_manual_templates_drive_file ON manual_templates(drive_file_id);
CREATE INDEX IF NOT EXISTS idx_manual_packages_active ON manual_packages(is_active);
CREATE INDEX IF NOT EXISTS idx_manual_packages_print_size ON manual_packages(print_size);
CREATE INDEX IF NOT EXISTS idx_package_templates_package ON package_templates(package_id);
CREATE INDEX IF NOT EXISTS idx_package_templates_order ON package_templates(package_id, order_index);

-- RLS Policies (Row Level Security)
ALTER TABLE manual_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE package_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE manual_template_categories ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read active templates and packages
CREATE POLICY "Anyone can view active manual templates" ON manual_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view active manual packages" ON manual_packages
  FOR SELECT USING (is_active = true);

CREATE POLICY "Anyone can view package templates" ON package_templates
  FOR SELECT USING (true);

CREATE POLICY "Anyone can view template categories" ON manual_template_categories
  FOR SELECT USING (is_active = true);

-- Admin users can manage all data (update with your admin email logic)
CREATE POLICY "Admins can manage manual templates" ON manual_templates
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT value FROM app_settings WHERE key = 'admin_emails'
    )
  );

CREATE POLICY "Admins can manage manual packages" ON manual_packages
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT value FROM app_settings WHERE key = 'admin_emails'  
    )
  );

CREATE POLICY "Admins can manage package templates" ON package_templates
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT value FROM app_settings WHERE key = 'admin_emails'
    )
  );

CREATE POLICY "Admins can manage template categories" ON manual_template_categories
  FOR ALL USING (
    auth.jwt() ->> 'email' IN (
      SELECT value FROM app_settings WHERE key = 'admin_emails'
    )
  );

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_manual_templates_updated_at
  BEFORE UPDATE ON manual_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_manual_packages_updated_at
  BEFORE UPDATE ON manual_packages  
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default template category
INSERT INTO manual_template_categories (name, description, icon, sort_order) 
VALUES 
  ('General', 'Default category for templates', '📋', 0),
  ('Wedding', 'Wedding and celebration templates', '💒', 1),
  ('Portrait', 'Portrait and headshot templates', '👤', 2),
  ('Events', 'Event and party templates', '🎉', 3)
ON CONFLICT (name) DO NOTHING;

-- Comments for documentation
COMMENT ON TABLE manual_templates IS 'Manually configured templates with precise definitions';
COMMENT ON TABLE manual_packages IS 'Admin-configured packages with selected templates';  
COMMENT ON TABLE package_templates IS 'Many-to-many relationship between packages and templates';
COMMENT ON TABLE manual_template_categories IS 'Organization categories for templates';

COMMENT ON COLUMN manual_templates.holes_data IS 'JSON array of hole positions: [{"id": "1", "x": 100, "y": 200, "width": 300, "height": 400}]';
COMMENT ON COLUMN manual_templates.dimensions IS 'JSON object: {"width": 1200, "height": 1800}';
COMMENT ON COLUMN manual_packages.template_count IS 'Number of templates to generate for this package';
COMMENT ON COLUMN package_templates.order_index IS 'Order of template within package (0-based)';