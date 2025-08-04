-- Session Templates Migration
-- Creates a junction table to store user-specific template customizations
-- This allows users to customize package templates without modifying the defaults

-- Create session_templates table to link sessions with manual templates
CREATE TABLE IF NOT EXISTS session_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  template_id uuid REFERENCES manual_templates(id) ON DELETE CASCADE NOT NULL,
  position integer NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  
  -- Ensure unique position per session
  UNIQUE(session_id, position)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_templates_session_id ON session_templates (session_id);
CREATE INDEX IF NOT EXISTS idx_session_templates_template_id ON session_templates (template_id);
CREATE INDEX IF NOT EXISTS idx_session_templates_position ON session_templates (session_id, position);

-- Add updated_at trigger
CREATE TRIGGER update_session_templates_updated_at BEFORE UPDATE ON session_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies
ALTER TABLE session_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their session templates" ON session_templates
  FOR ALL USING (
    session_id IN (
      SELECT id FROM sessions WHERE user_id = auth.uid()
    )
  );

-- Add table comment
COMMENT ON TABLE session_templates IS 'User-specific template customizations that override default package templates';
COMMENT ON COLUMN session_templates.position IS 'Position of template in user session (1-based), unique per session';