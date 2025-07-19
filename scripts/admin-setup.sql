-- Admin Setup SQL Script for PronoiaApp Vercel Deployment
-- Run this in Supabase SQL Editor to grant admin privileges

-- Step 1: Check existing users
SELECT 
    id,
    email,
    google_id,
    preferences,
    created_at
FROM users
ORDER BY created_at ASC;

-- Step 2: Grant admin privileges to a specific user (replace 'your-email@gmail.com')
-- IMPORTANT: Replace 'your-email@gmail.com' with your actual email address

UPDATE users 
SET preferences = COALESCE(preferences, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'your-email@gmail.com';

-- Step 3: Verify admin role was granted
SELECT 
    email,
    preferences->>'role' as role,
    preferences
FROM users 
WHERE email = 'your-email@gmail.com';

-- Step 4: (Optional) Grant admin to the first user in the system
-- Uncomment the lines below if you want to make the first registered user an admin

/*
UPDATE users 
SET preferences = COALESCE(preferences, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE id = (
    SELECT id 
    FROM users 
    ORDER BY created_at ASC 
    LIMIT 1
);
*/

-- Step 5: View all admin users
SELECT 
    email,
    preferences->>'role' as role,
    google_id,
    created_at
FROM users 
WHERE preferences->>'role' IN ('admin', 'super_admin')
ORDER BY created_at;