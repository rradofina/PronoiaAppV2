-- Fix Manual Template RLS Policies
-- The original policies reference app_settings admin_emails which doesn't match our admin system
-- Our admin system uses users.preferences->>'role' = 'admin'

-- Drop existing admin policies that don't work
DROP POLICY IF EXISTS "Admins can manage manual templates" ON manual_templates;
DROP POLICY IF EXISTS "Admins can manage manual packages" ON manual_packages;
DROP POLICY IF EXISTS "Admins can manage package templates" ON package_templates;
DROP POLICY IF EXISTS "Admins can manage template categories" ON manual_template_categories;

-- Create new admin policies that work with our user.preferences system
CREATE POLICY "Admins can manage manual templates" ON manual_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.email = auth.jwt() ->> 'email' 
      AND users.preferences->>'role' IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage manual packages" ON manual_packages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.email = auth.jwt() ->> 'email' 
      AND users.preferences->>'role' IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage package templates" ON package_templates
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.email = auth.jwt() ->> 'email' 
      AND users.preferences->>'role' IN ('admin', 'super_admin')
    )
  );

CREATE POLICY "Admins can manage template categories" ON manual_template_categories
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.email = auth.jwt() ->> 'email' 
      AND users.preferences->>'role' IN ('admin', 'super_admin')
    )
  );

-- Comment for documentation
COMMENT ON TABLE manual_templates IS 'Manual templates - RLS updated to use users.preferences for admin access';