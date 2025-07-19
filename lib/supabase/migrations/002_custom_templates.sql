-- Create custom_templates table for admin-designed templates
CREATE TABLE IF NOT EXISTS custom_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  print_size text CHECK (print_size IN ('4R', '5R', 'A4')) NOT NULL DEFAULT '4R',
  orientation text CHECK (orientation IN ('portrait', 'landscape')) NOT NULL DEFAULT 'portrait',
  
  -- Template layout data
  layout_data jsonb NOT NULL DEFAULT '{}',
  photo_slots jsonb NOT NULL DEFAULT '[]',
  
  -- Print specifications
  dimensions jsonb NOT NULL DEFAULT '{"width": 1200, "height": 1800, "dpi": 300}',
  margins jsonb DEFAULT '{"top": 0, "right": 0, "bottom": 0, "left": 0}',
  background_color text DEFAULT '#FFFFFF',
  
  -- Metadata
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  category text DEFAULT 'custom',
  tags text[] DEFAULT '{}',
  
  -- Status
  is_active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  sort_order integer DEFAULT 0,
  
  -- Timestamps
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure unique names per print size
  UNIQUE(name, print_size)
);

-- Create template_categories table for organization
CREATE TABLE IF NOT EXISTS template_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text UNIQUE NOT NULL,
  description text,
  color text DEFAULT '#3B82F6',
  icon text DEFAULT '📐',
  sort_order integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insert default categories
INSERT INTO template_categories (name, description, color, icon, sort_order) VALUES
  ('Studio Portraits', 'Professional portrait layouts', '#8B5CF6', '👤', 1),
  ('Couple Sessions', 'Romantic and couple-focused designs', '#EC4899', '💕', 2),
  ('Family Photos', 'Multi-person family layouts', '#10B981', '👨‍👩‍👧‍👦', 3),
  ('Events', 'Special occasion templates', '#F59E0B', '🎉', 4),
  ('Custom', 'Unique and creative designs', '#6B7280', '✨', 5)
ON CONFLICT (name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_custom_templates_print_size ON custom_templates(print_size);
CREATE INDEX IF NOT EXISTS idx_custom_templates_active ON custom_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_custom_templates_category ON custom_templates(category);
CREATE INDEX IF NOT EXISTS idx_custom_templates_created_by ON custom_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_templates_sort_order ON custom_templates(sort_order);

-- Enable Row Level Security
ALTER TABLE custom_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_templates
CREATE POLICY "Anyone can view active templates" ON custom_templates
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage all templates" ON custom_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND (users.preferences->>'role' = 'admin' OR users.preferences->>'role' = 'super_admin')
    )
  );

CREATE POLICY "Users can view template categories" ON template_categories
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage template categories" ON template_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id::text = auth.uid()::text 
      AND (users.preferences->>'role' = 'admin' OR users.preferences->>'role' = 'super_admin')
    )
  );

-- Create updated_at trigger for custom_templates
CREATE TRIGGER update_custom_templates_updated_at BEFORE UPDATE ON custom_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default 4R templates based on current hardcoded ones
INSERT INTO custom_templates (name, description, print_size, layout_data, photo_slots, category) VALUES
  (
    'Solo Portrait', 
    'Single photo with elegant white border',
    '4R',
    '{"type": "solo", "padding": 60, "spacing": 0, "arrangement": "single"}',
    '[{"id": "slot-1", "index": 0, "x": 60, "y": 60, "width": 1080, "height": 1680, "aspect_ratio": "free"}]',
    'Studio Portraits'
  ),
  (
    'Classic Collage', 
    '4 photos in perfect 2x2 grid layout',
    '4R',
    '{"type": "collage", "padding": 40, "spacing": 20, "arrangement": "grid"}',
    '[
      {"id": "slot-1", "index": 0, "x": 40, "y": 40, "width": 530, "height": 870, "aspect_ratio": "2:3"},
      {"id": "slot-2", "index": 1, "x": 630, "y": 40, "width": 530, "height": 870, "aspect_ratio": "2:3"},
      {"id": "slot-3", "index": 2, "x": 40, "y": 950, "width": 530, "height": 870, "aspect_ratio": "2:3"},
      {"id": "slot-4", "index": 3, "x": 630, "y": 950, "width": 530, "height": 870, "aspect_ratio": "2:3"}
    ]',
    'Studio Portraits'
  ),
  (
    'Seamless Photocard', 
    '4 photos edge-to-edge without borders',
    '4R',
    '{"type": "photocard", "padding": 0, "spacing": 0, "arrangement": "grid"}',
    '[
      {"id": "slot-1", "index": 0, "x": 0, "y": 0, "width": 600, "height": 900, "aspect_ratio": "2:3"},
      {"id": "slot-2", "index": 1, "x": 600, "y": 0, "width": 600, "height": 900, "aspect_ratio": "2:3"},
      {"id": "slot-3", "index": 2, "x": 0, "y": 900, "width": 600, "height": 900, "aspect_ratio": "2:3"},
      {"id": "slot-4", "index": 3, "x": 600, "y": 900, "width": 600, "height": 900, "aspect_ratio": "2:3"}
    ]',
    'Studio Portraits'
  ),
  (
    'Photo Strip', 
    '6 photos in classic strip arrangement',
    '4R',
    '{"type": "photostrip", "padding": 30, "spacing": 15, "arrangement": "strip"}',
    '[
      {"id": "slot-1", "index": 0, "x": 30, "y": 30, "width": 570, "height": 280, "aspect_ratio": "2:1"},
      {"id": "slot-2", "index": 1, "x": 630, "y": 30, "width": 570, "height": 280, "aspect_ratio": "2:1"},
      {"id": "slot-3", "index": 2, "x": 30, "y": 325, "width": 570, "height": 280, "aspect_ratio": "2:1"},
      {"id": "slot-4", "index": 3, "x": 630, "y": 325, "width": 570, "height": 280, "aspect_ratio": "2:1"},
      {"id": "slot-5", "index": 4, "x": 30, "y": 620, "width": 570, "height": 280, "aspect_ratio": "2:1"},
      {"id": "slot-6", "index": 5, "x": 630, "y": 620, "width": 570, "height": 280, "aspect_ratio": "2:1"}
    ]',
    'Events'
  )
ON CONFLICT (name, print_size) DO NOTHING;

-- Insert simple 5R templates
INSERT INTO custom_templates (name, description, print_size, orientation, layout_data, photo_slots, category) VALUES
  (
    '5R Portrait', 
    'Single full-size portrait photo',
    '5R',
    'portrait',
    '{"type": "simple", "padding": 0, "spacing": 0, "arrangement": "single"}',
    '[{"id": "slot-1", "index": 0, "x": 0, "y": 0, "width": 1500, "height": 2100, "aspect_ratio": "5:7"}]',
    'Studio Portraits'
  ),
  (
    '5R Landscape', 
    'Single full-size landscape photo',
    '5R',
    'landscape',
    '{"type": "simple", "padding": 0, "spacing": 0, "arrangement": "single"}',
    '[{"id": "slot-1", "index": 0, "x": 0, "y": 0, "width": 2100, "height": 1500, "aspect_ratio": "7:5"}]',
    'Studio Portraits'
  )
ON CONFLICT (name, print_size) DO NOTHING;

-- Insert simple A4 templates
INSERT INTO custom_templates (name, description, print_size, orientation, layout_data, photo_slots, category) VALUES
  (
    'A4 Portrait', 
    'Single full-size A4 portrait photo',
    'A4',
    'portrait',
    '{"type": "simple", "padding": 0, "spacing": 0, "arrangement": "single"}',
    '[{"id": "slot-1", "index": 0, "x": 0, "y": 0, "width": 2480, "height": 3508, "aspect_ratio": "210:297"}]',
    'Studio Portraits'
  ),
  (
    'A4 Landscape', 
    'Single full-size A4 landscape photo',
    'A4',
    'landscape',
    '{"type": "simple", "padding": 0, "spacing": 0, "arrangement": "single"}',
    '[{"id": "slot-1", "index": 0, "x": 0, "y": 0, "width": 3508, "height": 2480, "aspect_ratio": "297:210"}]',
    'Studio Portraits'
  )
ON CONFLICT (name, print_size) DO NOTHING;