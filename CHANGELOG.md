# Changelog

All notable changes to the PronoiaApp project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Project Documentation**: Created comprehensive project planning and documentation
  - New `PLAN.md` file outlining app vision, roadmap, and upcoming features
  - New `CHANGELOG.md` file for tracking all project changes
  - Updated `CLAUDE.md` with mandatory changelog documentation guidelines
  - Files: `PLAN.md`, `CHANGELOG.md`, `CLAUDE.md`

### Fixed
- **Photo Zoom/Crop Reset Issue**: Fixed bug where user's zoom and crop adjustments were resetting to default when clicking checkmark
  - **Root Cause**: Smart transform calculation was overwriting user's manual adjustments due to race condition
  - **Solution**: 
    - Enhanced transform validation and logging in `handleApplyPhotoToSlot`
    - Fixed transform preservation logic to create default transform when none exists
    - Updated `InlinePhotoEditor` to check if user has made changes before applying smart transform
    - Smart transform now only applies if transform is still at default values (no user interaction)
  - **Files Modified**: 
    - `components/screens/PhotoSelectionScreen.tsx` - Added transform validation and improved preservation logic
    - `components/InlinePhotoEditor.tsx` - Added user interaction detection to prevent overwriting manual adjustments
    - `components/PhotoRenderer.tsx` - Added transform update logging
  - **Impact**: Users can now properly zoom/crop photos while still getting auto-fit for initial placement

- **Template Navigation Slot Selection**: Fixed issue where selected slot persisted on previous template when swiping to new template
  - **Root Cause**: No communication between TemplateGrid's template navigation and parent's slot selection state
  - **Solution**:
    - Added `onTemplateChange` callback to TemplateGrid component
    - Implemented `handleTemplateChange` in PhotoSelectionScreen to auto-select first available slot
    - When navigating templates, system now selects first empty slot (or first slot if all filled)
  - **Files Modified**:
    - `components/TemplateGrid.tsx` - Added onTemplateChange prop and callback in navigateToTemplate
    - `components/screens/PhotoSelectionScreen.tsx` - Added handleTemplateChange to update slot selection
  - **Impact**: Photos now correctly go to visible template slots instead of hidden background templates

- **Transform Display in Non-Interactive Mode**: Fixed issue where zoom/crop transforms were ignored in template view after editing
  - **Root Cause**: PhotoRenderer was bypassing transform system for non-interactive mode, defaulting to center positioning
  - **Solution**:
    - Modified PhotoRenderer to always apply transforms when they exist, regardless of interactive mode
    - Only falls back to default `object-fit: cover` when no transform is present
  - **Files Modified**:
    - `components/PhotoRenderer.tsx` - Updated photoStyle calculation to respect transforms in all modes
  - **Impact**: Photos now display with correct zoom/crop in template view after editing, matching what users see in edit mode

## [2024-08-05] - Session-Based Template Management

### Added
- **Session-Based Template Management**: Implemented complete session storage architecture to prevent client template changes from corrupting admin-configured packages
  - Created session state in `components/screens/FolderSelectionScreen.tsx` with base templates and session overrides
  - Added `getEffectiveTemplates()` helper to merge admin configurations with client customizations
  - Client changes now isolated to session storage only
- **Add Prints Feature**: Added "Add Prints" button with print size grouping
  - New `components/AddPrintsModal.tsx` modal for adding templates to packages
  - Templates grouped by print size order: 4R → 5R → A4 using configurable `PRINT_SIZE_ORDER`
  - Integration with `components/PackageTemplatePreview.tsx` header
- **Print Size Configuration**: Added `utils/constants.ts` with `PRINT_SIZE_ORDER` for configurable sorting
- **Template Flow Integration**: Session changes now properly flow to photo templates screen via `handlePackageContinue()`

### Changed
- **Template Replacement Architecture**: Restored working template replacement using `manualPackageService.replaceTemplateAtPosition()`
- **Package Selection Flow**: Updated `pages/index.tsx` to handle effective templates from session state
- **Admin Package Protection**: Admin-configured packages remain untouched by client customizations

### Fixed
- **Template Change Bug**: Fixed templates not changing when users selected different templates
- **Template Flash Issue**: Eliminated templates flashing briefly then reverting to original
- **Permanent Package Corruption**: Prevented client changes from permanently modifying admin packages

### Technical Details
- **Commit**: `8ca13e6` - Session-based template management implementation
- **Files Modified**: 
  - `components/screens/FolderSelectionScreen.tsx` (major refactor)
  - `components/AddPrintsModal.tsx` (new file)
  - `components/PackageTemplatePreview.tsx` (add prints button)
  - `utils/constants.ts` (print size ordering)
  - `pages/index.tsx` (template flow integration)

## [2024-08-04] - Template Replacement System Fixes

### Fixed
- **Template Replacement Animations**: Fixed janky template replacement animations for smooth UX
  - **Commit**: `3536dd6`
- **Template Duplication**: Eliminated template duplicates and race conditions in replacement system
  - **Commit**: `da03df8`

### Changed
- **Package Template Preview**: Enhanced with photo display and improved layout
  - **Commit**: `a0a65f3`

## [2024-08-03] - Auto-Snap and Photo Positioning

### Fixed
- **Auto-Snap Movement Direction Bug** (CRITICAL): Fixed fundamental bug where auto-snap moved photos in opposite directions
  - **Root Cause**: Movement logic was backwards - gaps on left moved photo left (away from edge) instead of right (toward edge)
  - **Files Modified**: `components/PhotoRenderer.tsx`, `components/InlinePhotoEditor.tsx`
  - **Commit**: `5189474` - Auto-snap gap detection with corrected movement directions and scaling
- **Photo Scaling Issues**: Fixed photo scaling and cropping issues with container adjustment approach
  - **Commit**: `3ba3104`

### Added
- **Post-Snap Gap Validation**: Added validation to prevent movement that would create worse positioning
- **Enhanced Debug UI**: Added gap visualization and post-snap override warnings
- **Smart Movement Algorithm**: 
  - 4+ sides with gaps → Reset to default view
  - 3 sides with gaps → Reset to default view
  - 2 sides with gaps → Move by exact pixel amounts
  - 1 side with gaps → Move by exact pixel amount

### Technical Details
- **Gap Detection**: Set `GAP_THRESHOLD = 0` to detect ANY gap amount
- **Interaction Blocking**: Removed 3-second interaction timeout that prevented auto-snap after user interactions
- **Functions Added**: `detectGaps()`, `calculateGapBasedMovement()`, `detectPostSnapGaps()`, `finalizePositioning()`

## [2024-08-02] - Debug UI and Template Restrictions

### Added
- **Active Template Restrictions**: Implemented template restrictions and portal-based debug UI
  - **Commit**: `84169d4`
- **Package Selection Updates**: Enhanced select package functionality with holes debug
  - **Commit**: `d326495`, `73301cc`

## Earlier Changes

### Critical Bug Fixes (Historical - NEVER REVERT)

#### 1. Template Hole Positioning
- **Problem**: Photo placeholders were square and misaligned with PNG template holes
- **Fix**: `components/FullscreenTemplateEditor.tsx` - Fixed container sizing with exact aspect ratio (800px width, auto height) and removed `object-contain` to eliminate letterboxing

#### 2. Photo Loading CORS Issue
- **Problem**: Photos showed filenames but no images due to CORS blocking
- **Fix**: `next.config.js` - Set `Cross-Origin-Embedder-Policy: 'unsafe-none'` (NOT 'require-corp')

#### 3. PNG Templates Not Displaying
- **Problem**: PNG template backgrounds weren't showing in template bar
- **Fix**: `components/PngTemplateVisual.tsx` - Extract file ID from Google Drive URLs and use `lh3.googleusercontent.com/d/${fileId}` format

#### 4. Photo Cropping in Editor
- **Problem**: Photos were automatically cropped to match slot aspect ratios
- **Fix**: `components/FullscreenTemplateEditor.tsx` - Use natural photo dimensions (`width: 'auto', height: 'auto'`) with `initialScale={0.5}` to show complete photos first

### Known Issues

#### Photo Rasterization Positioning Shift (PARKED)
- **Problem**: Downloaded/rasterized photos have slight upward shift compared to editor preview display
- **Root Cause**: Mathematical differences between CSS percentage-based transforms and canvas pixel-based positioning calculations
- **Status**: Investigation in progress - parked until other priority tasks completed

---

## Changelog Maintenance

This changelog is maintained to track all significant changes to the PronoiaApp project. When making changes:

1. **Document ALL changes** in the appropriate version section
2. **Use clear categories**: Added, Changed, Fixed, Removed, Security
3. **Include file locations** for code changes
4. **Reference commit hashes** for traceability
5. **Explain impact** for breaking changes
6. **Update immediately** when changes are made

For more details on any change, refer to the git commit history and the technical documentation in `CLAUDE.md`.