-- Run this SQL directly in Supabase Dashboard > SQL Editor
-- This fixes the RLS policy that's blocking session creation

-- Drop the existing problematic policy
DROP POLICY IF EXISTS "Users can manage their own sessions" ON sessions;

-- Create a new, simpler policy using auth.uid()
CREATE POLICY "Users can manage their own sessions" ON sessions
  FOR ALL USING (auth.uid() = user_id);

-- Also add a specific INSERT policy to be extra clear
CREATE POLICY "Users can create their own sessions" ON sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);