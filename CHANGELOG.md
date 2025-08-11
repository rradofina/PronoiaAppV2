# Changelog

All notable changes to the PronoiaApp project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2025-08-11] - Complete Photo Viewer Zoom Fixes

### Fixed
- **Zoom State Not Resetting**:
  - File: `components/ZoomableImage.tsx`
  - Issue: Swipe navigation stayed disabled after zooming back to 1x
  - Root Cause: onZoomChange only called when setting target, not during animation
  - Solution: Track zoom state in animation loop with 1.01 threshold
  - Now properly enables swipe when scale returns close to 1.0
  - Commit: Current

## [2025-08-11] - Photo Viewer Centering and Progressive Loading

### Fixed
- **Photo Centering in Viewer**:
  - File: `components/ZoomableImage.tsx`
  - Added `flex items-center justify-center` to container
  - Photos now properly centered in viewport
  - Commit: Current

- **Black Flash Completely Eliminated**:
  - File: `components/ZoomableImage.tsx`
  - Added progressive loading support to ZoomableImage
  - Shows low-res thumbnail immediately
  - Loads high-res in background with blur transition
  - Uses same image cache as ProgressiveImage
  - Commit: Current

- **Auto-Recenter on Zoom Out**:
  - File: `components/ZoomableImage.tsx`
  - Automatically resets to center when scale <= 1.0
  - Added rubber band effect when pinching below minimum
  - Bounce-back animation when releasing under-zoom
  - Smooth spring-like return to center
  - Commit: Current

## [2025-08-11] - Smooth Zoom Implementation and Photo Viewer Enhancements

### Added
- **ZoomableImage Component with Buttery Smooth Zoom**:
  - File: `components/ZoomableImage.tsx` (new file)
  - **Smooth 60fps animations** using requestAnimationFrame with easing
  - **Multi-platform support**:
    - Touch: Pinch-to-zoom with two fingers
    - Mouse: Ctrl+scroll wheel zoom
    - Trackpad: Native pinch gestures
    - Click-and-drag panning when zoomed
  - **Smart zoom features**:
    - Zoom range from 1x to 5x
    - Double-tap to zoom (2.5x) with focus on tap point
    - Zoom centers on cursor/pinch point
    - Constrained panning within image bounds
  - **Smooth interpolation** with 0.15 easing factor for natural feel
  - Commit: `271951f` (initial), current (improved)

### Fixed
- **Eliminated Black Flash on Photo Navigation**:
  - File: `components/FullscreenPhotoViewer.tsx`
  - Root Cause: ProgressiveImage component was resetting state for every photo change
  - Solution: Enhanced image caching to detect when photos are already loaded
  - Now checks imageCache before resetting image state
  - Only shows blur effect for truly new images, not cached ones
  - Maintains photo ID tracking to prevent unnecessary reloads
  - Impact: Smooth, instant transitions between photos without black flash
  - Commit: `271951f`

### Changed
- **Complete Zoom System Rewrite**:
  - Replaced `usePinchZoom` hook with dedicated `ZoomableImage` component
  - Separated zoom container from carousel for clean gesture handling
  - Only current photo uses ZoomableImage (adjacent photos use ProgressiveImage)
  - Smooth real-time zoom updates instead of instant state changes
  - All input methods now supported (touch, mouse, trackpad)
  - Transform calculations simplified for smoother performance

### Removed
- **Removed usePinchZoom Hook**: Replaced with better ZoomableImage component

## [2025-08-11] - Photo Viewer Black Flash Fix

### Fixed
- **Eliminated Black Flash in Photo Viewer**:
  - File: `components/FullscreenPhotoViewer.tsx`
  - Added `ProgressiveImage` component for smooth loading
  - Shows thumbnail immediately (no black screen)
  - Loads high-res (2400px) in background
  - Smooth transition with subtle blur effect
  - Preloads both thumbnail and high-res for adjacent photos
  - Commit: `01ffddd`

## [2025-08-11] - Photo Viewer Resolution Enhancement

### Changed
- **Increased Photo Viewer Resolution**:
  - File: `components/FullscreenPhotoViewer.tsx` (lines 229-233)
  - Primary resolution increased from 1600px to 2400px
  - Added 1800px as intermediate fallback
  - Better image quality on tablet displays
  - Resolution chain: 2400px → 1800px → 1200px → 800px → 600px
  - Commit: `1ac702b`

## [2025-08-11] - Template Change Functionality Fix

### Fixed
- **Template Change in Fill Templates Screen**:
  - Replaced complex `TemplateSwapModal` with simpler `TemplateSelectionModal`
  - Files: `components/screens/PhotoSelectionScreen.tsx`, `components/TemplateGrid.tsx`
  - Now uses position-based replacement like Select Package screen
  - Fixes template matching by unique ID instead of generic type
  - Preserves photo assignments correctly when changing templates
  - Resolves issues with A4, 5R, and 4R template confusion
  - Commit: `9e8654c`

### Changed
- **Simplified Template Swap Logic**:
  - Track template index for position-based replacement
  - Keep original slots unchanged, only update template reference
  - Reset transforms for recalculation with new template dimensions
  - Consistent behavior between Select Package and Fill Templates screens

## [2025-08-11] - Security Fixes and Code Quality Improvements

### Security
- **Removed Admin Setup Key Hardcoded Fallback**: 
  - File: `pages/api/admin/setup.ts` (lines 17-24)
  - Removed insecure fallback value `'setup-admin-2024'`
  - Now requires `ADMIN_SETUP_KEY` environment variable to be set
  - Returns proper error if not configured

- **Fixed Token Refresh Security Issue**:
  - Created new server-side endpoint: `pages/api/auth/refresh.ts`
  - Updated client code in `pages/index.tsx` (lines 1009-1019)
  - Removed attempt to use non-existent `NEXT_PUBLIC_GOOGLE_CLIENT_SECRET`
  - Token refresh now handled securely server-side with `GOOGLE_OAUTH_SECRET`

### Fixed
- **Viewport Meta Tag Warning**:
  - Moved viewport meta tag from `pages/_document.tsx` to `pages/_app.tsx`
  - Added proper Next.js Head import and implementation
  - Removed duplicate from _document.tsx (lines 14-18)

- **Service Worker Memory Leak**:
  - File: `components/ServiceWorkerRegistration.tsx`
  - Added cleanup function to clear setInterval on unmount
  - Added cleanup for window 'load' event listener
  - Properly track interval ID for cleanup

- **Duplicate Meta Tags**:
  - File: `pages/_document.tsx`
  - Removed duplicate `apple-mobile-web-app-capable` meta tag (line 38)
  - Cleaned up redundant metadata

### Changed
- **Console Logging Improvements**:
  - Updated `services/loggerService.ts` to only output console logs in development or for errors
  - Updated `components/ServiceWorkerRegistration.tsx` to use logger service
  - Production builds now have minimal console output

- **TODO Comments Resolved**:
  - `components/screens/PhotoSelectionScreen.tsx` (line 1376): Added user-friendly toast error message
  - `services/templateExportService.ts` (line 142): Documented duplicate handling strategy
  - `services/templateExportService.ts` (line 480): Added detailed error message for Drive upload requirement

### Added
- **Environment Variables Documentation**:
  - Created `.env.example` file with all required environment variables
  - Includes setup instructions and generation commands
  - Documents optional configuration values

## [2025-08-10] - Complete A4 Template Display Fix & Template Matching Bug

### Fixed  
- **A4 Solo Templates Showing as 4R Solo in Fill Templates**: Fixed critical template matching bug
  - **Root Cause**: Template matching was using generic `template_type` field ("solo") instead of unique template ID, causing all solo templates to match the first one found (usually 4R)
  - **Solution**: Changed slot creation to store unique template ID instead of generic type, and updated matching logic to find templates by ID
  - **Files Modified**:
    - `pages/index.tsx` (lines 894, 914) - Store template.id instead of template.template_type in slots
    - `components/screens/PhotoSelectionScreen.tsx` (line 151) - Match templates by unique ID instead of generic type
    - `types/index.ts` (line 302) - Updated getHoleDimensions to match templates by ID for 2-step auto-fill
  - **Impact**: Each template is now uniquely identified, so A4 Solo and 4R Solo templates are properly distinguished, and 2-step auto-fill process works correctly

- **A4 Templates Reverting to 4R in Fill Templates Screen**: Fixed template selection priority issue
  - **Root Cause**: PhotoSelectionScreen was loading ALL templates from database instead of using the specific templates selected in the package
  - **Solution**: Changed template priority to use window templates (selected from package) over database templates
  - **File Modified**: `components/screens/PhotoSelectionScreen.tsx` (line 57)
  - **Impact**: Templates now correctly maintain their type when transitioning from "Select Package" to "Fill Templates" screen

- **A4 Templates Showing with Wrong Aspect Ratio**: Comprehensive fix for hardcoded 4R dimensions throughout codebase
  - **Root Cause**: Multiple layers of hardcoded 4R dimensions (1200×1800) forcing all templates into 4R shape
  - **Solution**: Created centralized print size dimensions utility and removed all hardcoded 4R assumptions
  - **Files Modified**: 
    - Created `utils/printSizeDimensions.ts` - Centralized helper for print size dimensions
    - `components/PngTemplateVisual.tsx` - Removed hardcoded 4R validation, now uses dynamic dimensions
    - `components/AddPrintsModal.tsx` - Dynamic aspect ratios and dimension fallbacks
    - `components/PackageTemplatePreview.tsx` - Uses getPrintSizeDimensions for fallbacks
    - `components/TemplateSelectionModal.tsx` - Dynamic dimension handling
    - `services/templateGenerationService.ts` - Fixed hardcoded '4R' parameter, now uses actual print_size
    - `components/admin/ManualTemplateManagerScreen.tsx` - Dynamic defaults based on selected print size
  - **Implementation**: 
    - Created `getPrintSizeDimensions()` helper function returning proper dimensions for each print size
    - All dimension fallbacks now use `getPrintSizeDimensions(template.print_size)` instead of hardcoded 4R
    - PngTemplateVisual validation now compares against correct print size dimensions
    - Template generation service uses actual template print_size instead of hardcoded '4R'
  - **Impact**: A4 templates now display, validate, and render with correct A4 proportions (2480×3508) throughout the entire application

## [2025-08-09] - Critical Photo Editing, Auto-Fit, Mobile Navigation & Prints Folder Management

### Fixed
- **2-Process Auto-Fit Not Working**: Restored the "double adjustment" functionality for photos
  - **Change Button Fix**: Now properly calculates smart transform (Process 1) when selecting new photo via Change button
  - **Normal Photo Addition Fix**: Empty slots now correctly apply smart scale when photos are added
  - **Implementation**: Added `createSmartPhotoTransformFromSlot()` call in `handlePhotoClick` for both scenarios
  - **Files Modified**: `components/screens/PhotoSelectionScreen.tsx` (lines 547-603)
  - **Impact**: Photos now auto-fit correctly to fill slots without gaps on initial placement

- **Immediate Editing After Photo Selection**: Fixed workflow to allow instant editing
  - **Previous Issue**: Photos were applied and interaction ended, preventing immediate adjustments
  - **Solution**: Modified to start inline editing mode immediately after photo selection
  - **Workflow**: Select photo → Apply with smart transform → Open inline editor → User can adjust
  - **Files Modified**: `components/screens/PhotoSelectionScreen.tsx` (lines 547-603)
  - **Impact**: Users can now immediately edit zoom/position after selecting any photo

- **Cannot Edit Photos After Placement**: Fixed auto-selection preventing photo editing
  - **Root Cause**: System was auto-selecting next empty slot after photo placement
  - **Solution**: Modified selection logic to keep current slot selected so user can edit if desired
  - **Files Modified**: `components/screens/PhotoSelectionScreen.tsx` (lines 965-975)
  - **Impact**: Users can now click placed photos to edit zoom/position without interference

- **Zoom/Frame/Crop Working Correctly**: Verified inline editing functionality
  - **Edit Button**: Properly triggers inline editing mode with existing transforms preserved
  - **Change Button**: Now opens inline editor for immediate adjustments
  - **Existing Logic**: `components/InlinePhotoEditor.tsx` already handles both cases correctly
  - **Impact**: Full editing capabilities restored for photo positioning and zooming

- **Missing Mobile Navigation**: Added Back and Finalize buttons for mobile/tablet users
  - **Problem**: Navigation buttons were only in desktop sidebar, completely missing on mobile
  - **Solution**: Added fixed bottom navigation bar above favorites bar on mobile/tablet
  - **Layout**: Positioned between main content and favorites bar with proper z-index
  - **Files Modified**: 
    - `components/screens/PhotoSelectionScreen.tsx` (lines 1468-1488)
    - `styles/globals.css` (updated height calculations for mobile layout)
  - **Impact**: Mobile and tablet users can now navigate back to packages and finalize selections

### Changed
- **Improved Mobile Navigation Layout**: Swapped Back button with mode toggle for better UX
  - **Mobile Nav Bar**: Now shows mode toggle (Select Photos/Fill Templates) and Finalize button
  - **Back Button**: Moved to header on mobile for consistency with app patterns
  - **Confirmation Dialog**: Added "Are you sure?" dialog when backing out with selections
  - **Progress Display**: Shows number of photos selected and slots remaining in confirmation
  - **Files Modified**: `components/screens/PhotoSelectionScreen.tsx`
  - **Impact**: More intuitive navigation flow and prevents accidental loss of work

### Added
- **Automatic Prints Folder Creation**: Creates organized folder structure in Google Drive
  - **Folder Naming**: Creates "Prints - [Client Folder Name]" inside selected client folder
  - **Duplicate Prevention**: Checks if folder exists before creating to avoid duplicates
  - **Content Detection**: Checks if existing folder has files to prevent overwriting
  - **User Feedback**: Shows dialog if prints already exist, directing to contact staff
  - **Files Modified**: 
    - `services/googleDriveService.ts` - Added `checkFolderExists()` and `getFolderContents()`
    - `pages/index.tsx` - Implemented `handlePhotoContinue()` with folder management
  - **Impact**: Organized file structure and protection against accidental overwrites

## [2025-08-09] - Template Change Auto-Fit Fix & Enhanced Photo Selection UX

### Changed
- **Enhanced Photo Editing Workflow**: Clear separation between Edit and Change functions
  - Added "Change" button (green) for selecting a different photo via favorites bar
  - Edit button (blue) for adjusting position/zoom with inline editor
  - Remove button (red) for deleting photos
  - Change button properly applies auto-fit transform to new photos
  - Three distinct functions for better user experience
  - Files Modified: `components/screens/PhotoSelectionScreen.tsx`, `components/PngTemplateVisual.tsx`

## [Previous - Same Day]

### Added
- **Enhanced Photo Selection Mode**: Intuitive mobile/tablet experience for filling empty slots
  - **Expanded Favorites Bar**: When tapping "Tap to add" on empty slot, favorites bar expands upward showing larger photos
  - **Visual Overlay**: Clear instruction overlay "Select a photo to fill the slot" guides users
  - **Smooth Animations**: Height-based expansion animation with proper positioning
  - **Responsive Heights**: 50% viewport on mobile, 40% on tablets for optimal viewing
  - **Auto-Collapse**: Bar automatically collapses when photo is selected or cancelled
  - **Escape Support**: Press ESC or tap outside to cancel selection
  - **Files Modified**: 
    - `components/screens/PhotoSelectionScreen.tsx` - Added isSelectingPhoto state and overlay
    - `components/FavoritesBar.tsx` - Enhanced with dynamic expansion and larger photo sizes
    - `styles/globals.css` - Added animation classes
  - **Impact**: Foolproof and intuitive photo selection process on touch devices

## [Previous - Same Day] - Template Change Auto-Fit Fix

### Fixed
- **Template Change Transform Bug**: Photos now properly auto-fit when changing templates
  - **Root Cause**: Old transform values were being preserved when switching between templates with different aspect ratios
  - **Solution**: Set transform to `undefined` when changing templates to trigger 2-step auto-fit recalculation
  - **Files Modified**: `components/TemplateSwapModal.tsx`
  - **Impact**: Photos now correctly reposition when switching between templates (e.g., Solo to Photo Strip)
  - **Commit**: Pending


### Changed
- **Template Selection Modal UI**: Updated to match main template selection page design
  - **Layout**: Changed from 3-column to responsive 4-column grid on larger screens
  - **Styling**: Consistent card design with centered text and preview images
  - **Visual Hierarchy**: Better template information display with photo count and style type
  - **Interaction**: Cleaner selection state with blue ring and background
  - **Files Modified**: `components/TemplateSwapModal.tsx`
  - **Impact**: More consistent and professional UI across the application

## [Previous Updates]

### Changed
- **Circular App Icons**: Redesigned all PWA icons to be circular with white background
  - **Previous**: Square icons with colored background
  - **New**: Circular masked icons with logo centered on white circle
  - **Implementation**: Updated icon generation script to create circular clipping paths
  - **File Modified**: `scripts/generate-icons.js`
  - **Impact**: Browser tabs and installed apps now show distinctive circular logo

- **Dynamic Viewport Height**: Fixed mobile browser viewport issues
  - **Problem**: App required scrolling due to browser UI (address bar, bookmarks) taking space
  - **Solution**: Implemented dynamic viewport height detection and CSS adjustments
  - **Implementation**:
    - Created `useViewportHeight` hook to track actual available viewport
    - Updated CSS to use `dvh` (dynamic viewport height) units
    - Added CSS custom properties updated by JavaScript
    - Modified main layout containers to use dynamic heights
  - **Files Created**: `hooks/useViewportHeight.ts`
  - **Files Modified**: 
    - `styles/globals.css` - Added dynamic viewport CSS
    - `pages/_app.tsx` - Integrated viewport hook
    - `pages/_document.tsx` - Added `minimal-ui` viewport hint
    - `components/screens/PhotoSelectionScreen.tsx` - Use dynamic height
  - **Impact**: App now perfectly fits available viewport without scrolling on tablets/mobile

### Added
- **Progressive Web App (PWA) Support**: Full "Add to Home Screen" functionality
  - **Web App Manifest**: Created `manifest.json` with app metadata, theme colors, and icon definitions
  - **App Icons**: Generated 8 icon sizes (72x72 to 512x512) for all device types
  - **Service Worker**: Implemented offline caching with network-first and cache-first strategies
  - **PWA Meta Tags**: Added comprehensive meta tags for iOS and Android app installation
  - **Files Created**: 
    - `public/manifest.json` - PWA manifest configuration
    - `public/service-worker.js` - Offline support and caching
    - `public/icons/` - Complete icon set for all platforms
    - `components/ServiceWorkerRegistration.tsx` - SW registration component
    - `scripts/generate-icons.js` - Icon generation utility
  - **Files Modified**:
    - `pages/_document.tsx` - Added manifest link and PWA meta tags
    - `pages/_app.tsx` - Integrated service worker registration
  - **Impact**: Users can now install the app to their home screen on Chrome, Edge, Safari, and other browsers

- **Project Documentation**: Created comprehensive project planning and documentation
  - New `PLAN.md` file outlining app vision, roadmap, and upcoming features
  - New `CHANGELOG.md` file for tracking all project changes
  - Updated `CLAUDE.md` with mandatory changelog documentation guidelines
  - Files: `PLAN.md`, `CHANGELOG.md`, `CLAUDE.md`

### Changed
- **Photo Movement Boundaries**: Removed restrictive boundaries for zoomed photos to enable creative positioning
  - **Previous Behavior**: Photos hit invisible walls even when zoomed enough to cover the entire container
  - **New Behavior**: At 1.5x zoom or higher, photos have unlimited movement freedom for creative control
  - **Implementation**: Modified `getPhotoTransformBounds()` function to return effectively unlimited bounds (-10 to 10) when photoScale >= 1.5
  - **File Modified**: `types/index.ts` lines 110-132
  - **Impact**: Users can now position any part of a zoomed photo anywhere in the placeholder without restrictions

- **Touch Dragging Consistency**: Fixed touch dragging to use same smart bounds system as mouse dragging
  - **Previous Behavior**: Touch dragging had hardcoded 0-1 bounds that were more restrictive than mouse dragging
  - **New Behavior**: Touch and mouse dragging now use identical zoom-aware boundary calculations
  - **Implementation**: Updated touch move handler to use `getPhotoTransformBounds()` and apply scale-adjusted movement
  - **File Modified**: `components/PhotoRenderer.tsx` lines 1359-1382
  - **Impact**: Consistent photo manipulation experience across all input methods (mouse, touch, tablet)

### Fixed
- **Loading States After Photo Edit**: Fixed persistent loading spinners appearing after photo edits and during slot navigation
  - **Root Cause**: Multiple issues causing unnecessary loading states:
    1. PhotoRenderer treated URL upgrades (immediate URL → blob URL) as new photos, resetting loading state
    2. Complex state transitions with setTimeout delays caused race conditions during slot navigation
    3. State cleanup delays between editing modes triggered loading flashes
  - **Solution**:
    - Enhanced PhotoRenderer with `isSamePhoto()` function to detect URL upgrades vs actual photo changes
    - Added Google Drive file ID extraction to identify same photos across different URL formats
    - Eliminated setTimeout delays in state transitions for atomic state updates
    - Removed unnecessary delays in inline editing state management (50ms, 75ms, 100ms delays)
    - Streamlined apply/cancel operations to use immediate state resets
  - **Files Modified**:
    - `components/PhotoRenderer.tsx` - Added URL upgrade detection and same-photo comparison
    - `components/screens/PhotoSelectionScreen.tsx` - Removed race condition setTimeout delays
  - **Impact**: Loading spinners no longer appear after editing 2nd photo or during slot navigation

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

- **Unnecessary Loading State After Photo Edit**: Improved loading states and fixed multiple photo display issue
  - **Root Cause**: Multiple loading triggers and potential state management issues causing all photos to show during editing
  - **Solution**:
    - Removed timestamp from PhotoRenderer key generation to prevent remounts on transform changes
    - Optimized PhotoRenderer to only reset loading state when URL actually changes (not on prop updates)
    - Replaced "Loading..." text with better photo placeholder in InlinePhotoEditor
    - Added comprehensive debugging to identify multiple photo rendering issues
  - **Files Modified**:
    - `components/InlinePhotoEditor.tsx` - Optimized key generation and improved loading placeholder
    - `components/PhotoRenderer.tsx` - Added URL change detection to prevent unnecessary loading resets
    - `components/PngTemplateVisual.tsx` - Enhanced debugging for slot editing state
  - **Impact**: Reduced loading states, better visual feedback, debugging tools to identify remaining issues

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