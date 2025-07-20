-- Initial Schema Migration
-- Creates the base users and sessions tables with proper RLS policies

-- Users table for storing Google OAuth user data
CREATE TABLE IF NOT EXISTS users (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text,
  google_id text UNIQUE NOT NULL,
  avatar_url text,
  preferences jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Sessions table for photo session management
CREATE TABLE IF NOT EXISTS sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL,
  package_type text CHECK (package_type IN ('A', 'B', 'C', 'D')) NOT NULL,
  google_drive_folder_id text NOT NULL,
  output_folder_id text,
  max_templates integer NOT NULL DEFAULT 1,
  used_templates integer NOT NULL DEFAULT 0,
  is_completed boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Templates table for storing template configurations
CREATE TABLE IF NOT EXISTS templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE NOT NULL,
  template_type text NOT NULL,
  template_data jsonb NOT NULL DEFAULT '{}',
  photo_slots jsonb NOT NULL DEFAULT '[]',
  is_completed boolean NOT NULL DEFAULT false,
  generated_file_id text,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Photo slots table for tracking individual photo assignments
CREATE TABLE IF NOT EXISTS photo_slots (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES templates(id) ON DELETE CASCADE NOT NULL,
  slot_index integer NOT NULL,
  photo_id text,
  photo_url text,
  photo_name text,
  transform_data jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(template_id, slot_index)
);

-- Generated templates table for tracking exported files
CREATE TABLE IF NOT EXISTS generated_templates (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid REFERENCES templates(id) ON DELETE CASCADE NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  google_drive_id text NOT NULL,
  file_size_bytes integer,
  dimensions jsonb,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_package_type ON sessions(package_type);
CREATE INDEX IF NOT EXISTS idx_templates_session_id ON templates(session_id);
CREATE INDEX IF NOT EXISTS idx_photo_slots_template_id ON photo_slots(template_id);
CREATE INDEX IF NOT EXISTS idx_generated_templates_template_id ON generated_templates(template_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_photo_slots_updated_at BEFORE UPDATE ON photo_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
-- Allow users to read and update their own record
CREATE POLICY "Users can view their own record" ON users
  FOR SELECT USING (google_id = auth.jwt() ->> 'user_metadata'->>'provider_id' OR email = auth.jwt() ->> 'email');

-- Allow users to insert their own record during signup
CREATE POLICY "Users can insert their own record" ON users
  FOR INSERT WITH CHECK (true); -- Allow all inserts (we'll validate in app logic)

-- Allow users to update their own record
CREATE POLICY "Users can update their own record" ON users
  FOR UPDATE USING (google_id = auth.jwt() ->> 'user_metadata'->>'provider_id' OR email = auth.jwt() ->> 'email');

-- Admins can view all users
CREATE POLICY "Admins can view all users" ON users
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.google_id = auth.jwt() ->> 'user_metadata'->>'provider_id'
      AND (users.preferences->>'role' = 'admin' OR users.preferences->>'role' = 'super_admin')
    )
  );

-- RLS Policies for sessions table
CREATE POLICY "Users can manage their own sessions" ON sessions
  FOR ALL USING (
    user_id IN (
      SELECT id FROM users 
      WHERE google_id = auth.jwt() ->> 'user_metadata'->>'provider_id' 
      OR email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for templates table
CREATE POLICY "Users can manage their session templates" ON templates
  FOR ALL USING (
    session_id IN (
      SELECT s.id FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE u.google_id = auth.jwt() ->> 'user_metadata'->>'provider_id'
      OR u.email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for photo_slots table
CREATE POLICY "Users can manage their template photo slots" ON photo_slots
  FOR ALL USING (
    template_id IN (
      SELECT t.id FROM templates t
      JOIN sessions s ON t.session_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE u.google_id = auth.jwt() ->> 'user_metadata'->>'provider_id'
      OR u.email = auth.jwt() ->> 'email'
    )
  );

-- RLS Policies for generated_templates table
CREATE POLICY "Users can view their generated templates" ON generated_templates
  FOR ALL USING (
    template_id IN (
      SELECT t.id FROM templates t
      JOIN sessions s ON t.session_id = s.id
      JOIN users u ON s.user_id = u.id
      WHERE u.google_id = auth.jwt() ->> 'user_metadata'->>'provider_id'
      OR u.email = auth.jwt() ->> 'email'
    )
  );

-- Comments for documentation
COMMENT ON TABLE users IS 'User accounts synced from Google OAuth';
COMMENT ON TABLE sessions IS 'Photo studio sessions with package selections';
COMMENT ON TABLE templates IS 'Individual templates within a session';
COMMENT ON TABLE photo_slots IS 'Photo assignments within templates';
COMMENT ON TABLE generated_templates IS 'Exported template files';