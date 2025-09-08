-- Remove Unused Database Tables
-- Drops tables that were created but never implemented in the application
-- Part of database cleanup initiative to reduce schema complexity

-- Drop session_templates table (created in migration 012 but never used)
-- This table was intended for user-specific template customizations
-- but the feature was implemented differently using template duplication
DROP TABLE IF EXISTS session_templates CASCADE;

-- Drop generated_templates table (created in migration 001 but never used)
-- This table was intended to track exported template files
-- but the app evolved to use Google Drive file IDs stored in templates.generated_file_id instead
DROP TABLE IF EXISTS generated_templates CASCADE;

-- Note: CASCADE automatically removes:
-- - All associated indexes (idx_session_templates_*, idx_generated_templates_*)
-- - All RLS policies ("Users can manage their session templates", etc.)
-- - All triggers (update_session_templates_updated_at, etc.)
-- - Any foreign key references

-- Comments documenting why these tables were removed
COMMENT ON SCHEMA public IS 'Removed unused tables: generated_templates (replaced by Drive file IDs in templates table), session_templates (replaced by template duplication per session)';

-- Verify cleanup was successful
-- These queries should return 0 rows after migration
-- SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('generated_templates', 'session_templates');