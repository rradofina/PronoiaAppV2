-- Fix Sessions RLS Policy Migration
-- The original RLS policy uses complex JWT parsing which can fail
-- Modern Supabase uses auth.uid() for simpler and more reliable policies

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can manage their own sessions" ON sessions;

-- Create a new, simpler policy using auth.uid()
CREATE POLICY "Users can manage their own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- Also add a specific INSERT policy to be extra clear
CREATE POLICY "Users can create their own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Add policy comment for clarity
COMMENT ON TABLE sessions IS 'User sessions with simplified RLS using auth.uid()';