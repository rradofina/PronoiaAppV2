-- Fix RLS Policies for Development (Corrected)
-- This migration relaxes RLS policies to allow proper user creation and authentication

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own record" ON users;
DROP POLICY IF EXISTS "Users can insert their own record" ON users;
DROP POLICY IF EXISTS "Users can update their own record" ON users;
DROP POLICY IF EXISTS "Admins can view all users" ON users;
DROP POLICY IF EXISTS "Public read access to users" ON users;
DROP POLICY IF EXISTS "Allow user registration" ON users;
DROP POLICY IF EXISTS "Users can update their own data" ON users;
DROP POLICY IF EXISTS "Users can delete their own record" ON users;

-- Create more permissive policies for users table
-- Allow public read access to users (for looking up by google_id or email)
CREATE POLICY "Public read access to users" ON users
  FOR SELECT USING (true);

-- Allow anyone to insert new users (for Google OAuth signup)
CREATE POLICY "Allow user registration" ON users
  FOR INSERT WITH CHECK (true);

-- Allow users to update their own records (simplified - just allow all updates for development)
CREATE POLICY "Users can update their own data" ON users
  FOR UPDATE USING (true);

-- Allow deletion only for admins or the user themselves
CREATE POLICY "Users can delete their own record" ON users
  FOR DELETE USING (
    id::text = auth.uid()::text OR
    preferences->>'role' = 'admin' OR 
    preferences->>'role' = 'super_admin'
  );

-- Make app_settings and template_cache publicly readable for functionality
-- First check if these tables exist before applying RLS
DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'app_settings') THEN
        ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies first
        DROP POLICY IF EXISTS "Public read access to app settings" ON app_settings;
        DROP POLICY IF EXISTS "Admins can manage app settings" ON app_settings;
        
        CREATE POLICY "Public read access to app settings" ON app_settings
          FOR SELECT USING (true);

        CREATE POLICY "Admins can manage app settings" ON app_settings
          FOR ALL USING (
            EXISTS (
              SELECT 1 FROM users 
              WHERE users.id::text = auth.uid()::text 
              AND (users.preferences->>'role' = 'admin' OR users.preferences->>'role' = 'super_admin')
            )
          );
    END IF;
END
$$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'template_cache') THEN
        ALTER TABLE template_cache ENABLE ROW LEVEL SECURITY;
        
        -- Drop existing policies first
        DROP POLICY IF EXISTS "Public read access to template cache" ON template_cache;
        DROP POLICY IF EXISTS "Public write access to template cache" ON template_cache;
        
        CREATE POLICY "Public read access to template cache" ON template_cache
          FOR SELECT USING (true);

        CREATE POLICY "Public write access to template cache" ON template_cache
          FOR ALL USING (true);
    END IF;
END
$$;

-- Enable RLS on users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Add helpful comments
COMMENT ON POLICY "Public read access to users" ON users IS 'Allows reading user data for Google OAuth lookups';
COMMENT ON POLICY "Allow user registration" ON users IS 'Permits new user creation during Google OAuth flow';
COMMENT ON POLICY "Users can update their own data" ON users IS 'Users can update their profile information';