# Deprecated & Legacy Code Documentation

This document tracks deprecated, dead, and legacy code that should be cleaned up in future maintenance cycles.

## TypeScript Interface Issues

### Package vs ManualPackage Type Mismatch
**Status**: Critical issue causing data loss
**Location**: `types/index.ts`
**Problem**: 
- Old `Package` interface (lines 78-84) has different field names than database
- Database returns `ManualPackage` objects with snake_case fields (`template_count`, `photo_limit`)
- Old interface uses camelCase (`templateCount`) and lacks critical fields
- Causes `photo_limit` to be undefined, breaking photo upload limits

**Impact**: Photo limit enforcement doesn't work
**Root Cause**: Type mismatch between interface and database schema
**Temporary Fix**: Cast to ManualPackage when accessing photo_limit
**Future Fix**: Remove Package interface entirely and migrate all code to ManualPackage

## Database Legacy Tables

### 1. Dropped Tables Still Referenced in Code
**Migration**: `005_remove_custom_templates.sql`
**Dropped**: 
- `custom_templates` table
- `template_categories` table

**Still Referenced In**:
- `services/supabaseService.ts` (lines 9-10, 221-389)
- `lib/supabase/types.ts` (auto-generated, outdated)

**Dead Functions in supabaseService.ts**:
```typescript
// Lines 221-389 - All reference non-existent tables
getCustomTemplates()
getCustomTemplatesByType()  
getCustomTemplate()
createCustomTemplate()
updateCustomTemplate()
deleteCustomTemplate()
getTemplateCategories()
createTemplateCategory()
uploadTemplateImage()
```

### 2. Legacy Column Still Present
**Table**: `sessions`
**Column**: `package_type` - Uses old 'A', 'B', 'C', 'D' values
**Status**: Replaced by `package_id` (UUID reference to manual_packages)
**Migration**: `013_update_sessions_for_manual_packages.sql` added new column but kept old for "backward compatibility"
**Still Used In**: `supabaseService.ts` analytics functions (lines 191, 208)

## Type Definition Issues

### Auto-Generated Types Out of Date
**File**: `lib/supabase/types.ts`
**Problem**: Contains definitions for dropped tables
- `custom_templates` table definition (line 179+)
- `template_categories` table definition (line 241+)
**Fix**: Regenerate types from current database schema using Supabase CLI

## Package System Evolution

### Current State:
1. **Original System**: Hardcoded packages A/B/C/D with `package_type` column
2. **Legacy Interface**: `Package` type with `templateCount` field
3. **Current System**: Manual packages in database with `package_id` column
4. **Current Interface**: `ManualPackage` type with `template_count` field

### Migration Path:
```
sessions.package_type (A/B/C/D) → sessions.package_id (UUID)
Package interface (templateCount) → ManualPackage interface (template_count)
Hardcoded packages → Database-driven manual_packages table
```

## Analytics Code Issues

### getUserStatistics() Function
**Location**: `services/supabaseService.ts:191-210`
**Problem**: Queries old `package_type` column instead of joining with manual_packages
**Current Code**:
```sql
SELECT id, package_type, is_completed, created_at
FROM sessions
```
**Should Be**:
```sql
SELECT s.id, mp.name as package_name, s.is_completed, s.created_at
FROM sessions s
LEFT JOIN manual_packages mp ON s.package_id = mp.id
```

## Cleanup Recommendations

### High Priority (Breaks functionality):
1. **Fix Package/ManualPackage type mismatch** - Causes photo_limit to be undefined
2. **Remove dead supabaseService functions** - Reference non-existent tables
3. **Update analytics to use package_id** - Currently uses deprecated package_type

### Medium Priority (Technical debt):
1. **Regenerate Supabase types** - Remove references to dropped tables
2. **Create migration to drop sessions.package_type** - After ensuring all sessions have package_id
3. **Update all Package references to ManualPackage** - Systematic codebase migration

### Low Priority (Documentation):
1. **Remove Package type comments** - Clean up any remaining references
2. **Update CHANGELOG.md** - Document cleanup activities

## Testing Required After Cleanup

1. **Photo limit enforcement** - Verify limits work correctly
2. **Package selection flow** - Ensure no type errors
3. **Analytics dashboard** - Verify statistics display correctly
4. **Admin package management** - Test CRUD operations
5. **Session creation** - Verify package_id is set correctly

## Notes

- This documentation created after discovering type mismatch causing photo_limit issue
- Many of these issues stem from incremental evolution without cleaning up old code
- Database schema is correct - the issues are in TypeScript types and dead code
- Conservative approach: Document now, clean up later to avoid breaking changes