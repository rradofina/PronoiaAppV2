-- SQL script to run in Supabase SQL Editor
-- This will help diagnose and fix the template folder ID issue

-- 1. Check current state of app_settings table
SELECT 
    id,
    key,
    value,
    description,
    created_at,
    updated_at
FROM app_settings 
WHERE key = 'template_folder_id'
ORDER BY created_at DESC;

-- 2. Check if there are multiple records (which shouldn't happen)
SELECT 
    key,
    COUNT(*) as record_count,
    ARRAY_AGG(value ORDER BY created_at DESC) as all_values
FROM app_settings 
WHERE key = 'template_folder_id'
GROUP BY key;

-- 3. Check table structure
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'app_settings' 
ORDER BY ordinal_position;

-- 4. Check RLS policies on app_settings table
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'app_settings';

-- 5. Check if RLS is enabled
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'app_settings';

-- 6. MANUAL FIX: Delete all template_folder_id records and insert the correct one
-- Replace 'YOUR_CORRECT_FOLDER_ID' with the folder ID you want to use
-- DELETE FROM app_settings WHERE key = 'template_folder_id';
-- INSERT INTO app_settings (key, value, description) 
-- VALUES ('template_folder_id', 'YOUR_CORRECT_FOLDER_ID', 'Google Drive folder ID containing template subfolders');

-- 7. If RLS is blocking operations, temporarily disable it for testing
-- (Only run this if you're having permission issues)
-- ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- 8. Re-enable RLS after testing (if you disabled it)
-- ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;