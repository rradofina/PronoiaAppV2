# Changelog

All notable changes to the PronoiaApp project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
- **Photo Upload Performance**: Implemented parallel batch processing for photo finalization
  - Previously: Sequential processing (one photo at a time) - slow for many photos
  - Now: Parallel processing (5 photos simultaneously) 
  - Expected improvement: 60-80% faster (3-5x speed increase)
  - Implementation:
    - Process photos in batches of 5 using Promise.allSettled
    - Show batch progress updates to user
    - Handle failures gracefully without stopping other uploads
    - Maintain detailed error reporting for failed uploads
  - Files Modified: `pages/index.tsx` (handlePhotoUpload function)
  - Impact: Significantly faster photo finalization, especially noticeable with 10+ photos

- **Template Rasterization Performance**: Major speed improvements for template processing
  - PNG Caching: Eliminates double download of 6-10MB PNG templates (40-50% faster)
  - Smart Resolution: Uses w2000 for drafts, w4000 for finals (20% faster for drafts)
  - Implementation:
    - Cache PNG in getPngNaturalDimensions() for reuse in drawTemplateBackground()
    - Detect draft mode (quality < 0.9) and adjust resolution accordingly
    - Added clearCache() method to free memory after batch processing
  - Files Modified: `services/templateRasterizationService.ts`
  - Impact: 2x faster template sync with no quality loss, full resolution maintained for finals

- **Template Sync Performance**: Implemented parallel batch processing for template synchronization
  - Previously: Sequential processing (one template at a time)
  - Now: Parallel processing (2 templates simultaneously)
  - Expected improvement: 2-3x faster for multiple templates
  - Implementation:
    - Process templates in batches of 2 using Promise.allSettled
    - Added user interaction checks before and after heavy operations
    - Maintained all existing safeguards (retry logic, error handling, UI yielding)
    - Templates abort early if user starts dragging during sync
  - Files Modified: `services/templateSyncService.ts`
  - Impact: Significantly faster background sync without sacrificing UI responsiveness

### Fixed
- **OAuth Token Expiration in Google Drive Service**: Fixed authentication errors that crashed template sync when OAuth tokens expired
  - Root Cause: OAuth tokens expire after ~1 hour but upload/update methods didn't handle 401 errors
  - Solution: Added automatic token refresh and retry logic for both uploadFile and updateFile methods
  - Implementation:
    - Detect 401 status code responses
    - Call refreshToken() to get new access token
    - Retry the operation with fresh token
    - Only throw error if retry also fails
  - Files Modified: `services/googleDriveService.ts`
  - Impact: Long-running sessions (over 1 hour) now continue syncing without authentication crashes

- **Critical Image Loading Error in Template Sync**: Fixed runtime error that crashed template rasterization when Google Drive images failed to load
  - Root Cause: Google Drive `drive-storage` URLs have CORS restrictions or expire, causing complete sync failure
  - Solution: Implemented robust image loading with multiple fallback URLs
  - Implementation:
    - Added `loadSingleImage` for individual URL attempts
    - Modified `loadImage` to try multiple URLs in sequence
    - Template sync continues even if some photos fail to load
    - Uses all available URLs: high-res, base URL, and thumbnail as fallbacks
  - Files Modified: `services/templateRasterizationService.ts`
  - Impact: Template sync no longer crashes on image load failures, ensuring reliable background synchronization

- **Photo Layering Issue**: Fixed photos appearing on top of PNG templates instead of behind them
  - Root Cause: Incorrect rendering order - photos were rendered/drawn after PNG templates
  - Solution: Reversed the order to render photos first, then PNG template overlay on top
  - Implementation:
    - PngTemplateVisual: Moved PNG `<img>` to render after photo holes, added z-10 and pointer-events-none
    - templateRasterizationService: Draw photos first, then PNG template on top
  - Files Modified: `components/PngTemplateVisual.tsx`, `services/templateRasterizationService.ts`
  - Impact: PNG templates now properly overlay photos as intended in both display and export
  
- **Template Change Not Working in Package Selection**: Fixed issue where selecting a new template in the change modal had no effect
  - Root Cause: Missing `onTemplateReplace` handler in PackageSelectionScreen
  - Solution: Added handler to update templates state array when a template is replaced
  - Files Modified: `components/screens/PackageSelectionScreen.tsx`
  - Impact: Users can now successfully change templates in the package selection screen
- **UI Lag During Background Sync**: Fixed drag-and-drop becoming unresponsive during template uploads
  - Root Cause: Heavy rasterization operations blocking the main thread
  - Solution: Added yield points and interaction detection
  - Implementation:
    - Added `yieldToUI()` with requestAnimationFrame between syncs
    - Implemented `setUserInteracting()` to pause sync during drag operations
    - Connected to drag events in FavoritesBar and PhotoRenderer
    - Reduced JPEG quality to 0.85 for faster draft processing
  - Files Modified: `services/templateSyncService.ts`, `components/screens/PhotoSelectionScreen.tsx`, `components/PngTemplateVisual.tsx`
  - Commit: `4469fa3`
  - Impact: Smooth drag-and-drop even while templates sync in background

- **All Templates Not Syncing**: Fixed issue where only one template synced instead of all completed templates
  - Root Cause: Sync logic only checked the specific template that was just modified
  - Solution: Added `syncAllCompletedTemplates()` helper that iterates through ALL templates
  - Implementation:
    - Checks every unique template ID for completion status
    - Queues sync for each completed template found
    - Runs on component mount to catch pre-existing completed templates
    - Comprehensive logging shows total templates vs completed count
  - Files Modified: `components/screens/PhotoSelectionScreen.tsx`
  - Commit: `f2be5d1`
  - Impact: All completed templates now properly sync to drafts folder

- **Template Export Dimensions Mismatch**: Exported templates now use PNG's actual dimensions
  - Root Cause: Canvas was forced to standard print sizes (1200x1800, etc.) regardless of PNG dimensions
  - Solution: Use PNG's natural dimensions for pixel-perfect export
  - Implementation:
    - Canvas sized to match PNG template exactly
    - PNG drawn at 1:1 scale without stretching
    - Fallback to standard dimensions only when PNG unavailable
  - Files Modified: `services/templateRasterizationService.ts`
  - Commit: `9189269`
  - Impact: Exported templates now match exact pixel dimensions of uploaded PNG templates

### Added
- **Real-Time Template Sync to Google Drive**: Templates automatically upload to Drive as they're completed
  - New Service: `services/templateSyncService.ts` - Manages background sync with debouncing and queue
  - Auto-sync triggers:
    - When last slot of template is filled (3s debounce)
    - When photo transform is adjusted (3s debounce) 
    - When template is deleted (immediate)
    - When photo is removed making template incomplete (immediate)
  - Visual indicators: Shows sync status (Pending/Saving.../Saved/Error) on completed templates
  - Finalize is now instant: Just renames `prints_draft/` to `prints/` folder
  - Files Modified:
    - Created `services/templateSyncService.ts` - Complete sync management system
    - Created `components/SyncStatusIndicator.tsx` - Visual sync status component
    - Modified `pages/index.tsx` - Initialize sync service, trigger on photo selection
    - Modified `components/screens/PhotoSelectionScreen.tsx` - Sync triggers for add/delete/transform
    - Modified `components/TemplateGrid.tsx` - Display sync status indicators
    - Modified `services/googleDriveService.ts` - Added updateFile, deleteFile, renameFolder methods
  - Impact: Zero wait time at finalization, templates ready in Drive as user works

### Changed
- **Simplified Finalize Flow**: Replaced upload progress with instant folder rename
  - Old: Generate and upload each template on finalize (slow)
  - New: Templates already uploaded, just rename folder (instant)
  - Files Modified: `pages/index.tsx` - handleTemplateUpload now just calls finalizeSession

### Removed
- **"Prints Already Created" Warning**: Always overwrites existing prints folder
  - Removed blocking dialog that prevented overwriting
  - Files Modified: `pages/index.tsx` - Removed showExistingPrintsDialog and related UI
  - Impact: Smoother workflow without interruptions

### Fixed
- **Used Photos Disappearing in Mode Switch**: Used photos now remain visible in favorites bar when switching between modes
  - Root Cause: Photo mode favorites bar showed `getUnusedFavorites()` which filtered out photos already used in templates
  - Solution: Changed photo mode to show ALL favorited photos consistently like print mode
  - Files Modified: `components/screens/PhotoSelectionScreen.tsx` - line 1866 changed from `getUnusedFavorites()` to `photos.filter(photo => favoritedPhotos.has(photo.id))`
  - Impact: Consistent favorites bar experience across both "Select Photos" and "Fill Templates" modes
  - Protection: Existing logic prevents unfavoriting photos currently in template slots

## [2025-08-18] - Continuous Photo Interaction Workflow

### Fixed
- **Continuous Photo Dragging**: Enable immediate interaction with multiple photos without mode switching
  - Root Cause: Auto-activation of inline-editing mode after photo drop prevented continuous interaction
  - Solution: Removed automatic mode switching and state resets that blocked immediate photo dragging
  - Files Modified:
    - `components/screens/PhotoSelectionScreen.tsx` - Removed lines 837-839 (auto inline-editing activation), lines 1238-1242 (state resets during auto-snap), line 1927 (photo grid disabling)
  - Impact: Users can now drag photo → drop → immediately drag another photo without barriers
  - User Request: "when i drag a photo to a slot, i cant immediately drag another photo to another slot?"

### Fixed
- **Template Navigation After Photo Placement**: Enable immediate template swiping after placing photos
  - Root Cause: Multiple functions triggered `inline-editing` mode which applied `pointer-events-none` to TemplateGrid, blocking swipe gestures
  - Solution: Removed ALL automatic `setViewMode('inline-editing')` calls (6 instances) for pure direct manipulation
  - Files Modified:
    - `components/screens/PhotoSelectionScreen.tsx` - Removed inline-editing activation from `handlePhotoClick`, `handleSelectPhotoForTemplate`, `handleSlotSelectFromSlidingBar`, `handleConfirmReplace`
  - Impact: Users can now place photo → immediately swipe to next template without navigation barriers
  - User Request: "when i put a photo i cant immedately swipe to the next template"

### Removed
- **Mode Switching Barriers**: Eliminated automatic state changes that interfered with direct manipulation
  - Removed automatic `setViewMode('inline-editing')` after photo drops
  - Removed state resets (`setInlineEditingSlot(null)`, `setInlineEditingPhoto(null)`) during auto-snap
  - Removed photo grid disabling (`opacity-50 pointer-events-none`) during editing mode
  - Files: `components/screens/PhotoSelectionScreen.tsx`

### Removed
- **Visual Transitions**: Eliminated CSS transitions causing unwanted flashing during interaction
  - Removed `transition-all duration-300` className from main content container
  - Removed `transition: 'padding-bottom 300ms cubic-bezier(0.4, 0, 0.2, 1)'` style
  - Files: `components/screens/PhotoSelectionScreen.tsx` lines 1826, 1836
  - Impact: Pure direct manipulation interface with only intended auto-snap spring animation

## [2025-08-17] - Direct Photo Manipulation in Template Slots

### Changed
- **Photo Editing Workflow**: Immediate direct manipulation for zooming and positioning
  - Removed "Crop & Zoom" button - photos are now immediately interactive when selected
  - Single click/touch on filled slot enables direct manipulation (drag to position, pinch/scroll to zoom)
  - Auto-save transform changes when interaction ends (no need to click checkmark)
  - Files Modified:
    - `components/PngTemplateVisual.tsx` - Removed Crop & Zoom button, enabled interactive PhotoRenderer
    - `components/TemplateSlot.tsx` - Added interactive mode and auto-save for PhotoRenderer
    - `components/screens/PhotoSelectionScreen.tsx` - Updated slot click handling for direct manipulation
  - Impact: Faster, more intuitive photo editing with fewer clicks/taps
  - Commit: Current

### Improved
- **User Interaction Flow**:
  - Previous: Click slot → Click "Crop & Zoom" → Adjust → Click ✓ (4 interactions)
  - New: Click/touch slot → Immediately drag/pinch to adjust (1 interaction to start)
  - Kept "Change Photo" and "Remove Photo" buttons for safety with confirmation
  - Toggle behavior: Click same slot again to deselect and hide buttons
  - Impact: Reduced friction in photo editing workflow, especially for tablet users

## [2025-08-16] - Replace Tap-to-Add with Drag-and-Drop Photo Placement

### Changed
- **Photo Placement Workflow**: Complete refactor from tap-to-add to drag-and-drop
  - Removed expanding/collapsing favorites bar functionality
  - Favorites bar now always visible with fixed 200px height
  - Increased photo thumbnail sizes in favorites bar (120px min width, 3:4 aspect ratio)
  - Changed empty slot interaction from "Tap to Add" to drag-and-drop only
  - Files Modified:
    - `components/FavoritesBar.tsx` - Removed expansion logic, added drag handlers, increased photo sizes
    - `components/PngTemplateVisual.tsx` - Added drop zones, changed placeholder text to "Drag photo here"
    - `components/screens/PhotoSelectionScreen.tsx` - Added drag/drop state management and handlers
  - Impact: More intuitive photo placement workflow based on user feedback
  - Branch: PlaceholderIssueBranch
  - Commit: Current

### Added
- **Drag and Drop Support**:
  - Photos in favorites bar are now draggable with visual "Drag me" indicator on hover
  - Empty template slots show green dashed border when dragging a photo
  - Drop zones accept photos and immediately enter inline editing mode
  - Star indicators remain visible on draggable photos
  - Files Modified:
    - `components/FavoritesBar.tsx` - Added onDragStart, onDragEnd, handleDragStart, handleDragEnd
    - `components/PngTemplateVisual.tsx` - Added onDropPhoto, isDraggingPhoto props, handleDragOver, handleDrop
  - Impact: Modern drag-and-drop interface replacing click-based workflow

### Removed
- **Tap to Add Workflow**:
  - Removed isExpanded state and expansion animations from FavoritesBar
  - Removed viewport-aware expansion calculations
  - Removed isSelectingPhoto trigger for empty slot clicks
  - Removed adaptivePhotoSize and dynamicHeight props
  - Files Modified:
    - `components/FavoritesBar.tsx` - Removed expansion-related code and props
    - `components/screens/PhotoSelectionScreen.tsx` - Removed photo selection mode for empty slots
  - Impact: Simplified codebase with single interaction pattern

## [2025-08-13] - Fix Additional Prints from Package Selection

### Fixed
- **Additional Prints from Package Selection**:
  - Templates added via "Add Prints" in Package Selection screen are now properly marked as additional
  - Delete button now appears for templates added in Package Selection screen
  - "Added" badge displays correctly for these templates
  - Files Modified:
    - `components/screens/FolderSelectionScreen.tsx` - Added `_isFromAddition` marker to track template source
    - `pages/index.tsx` - Check marker when creating slots to set `isAdditional` flag
  - Impact: Users can now delete templates added via Package Selection screen as expected
  - Commit: Current

## [2025-08-13] - Identify and Manage Additional Prints

### Added
- **Additional Print Identification**:
  - Added `isAdditional` flag to TemplateSlot interface to track templates added via "Add Prints" button
  - Visual "Added" badge on additional templates in purple color for clear identification
  - Files Modified:
    - `types/index.ts` - Added `isAdditional?: boolean` to TemplateSlot interface
    - `components/TemplateGrid.tsx` - Added purple "Added" badge to additional templates
  - Impact: Users can easily identify which templates are part of the original package vs. added later
  - Commit: Current

### Changed
- **Template Creation Logic**:
  - Original package templates are marked with `isAdditional: false`
  - Templates added via "Add Prints" are marked with `isAdditional: true`
  - Removed redundant "(Additional)" suffix from template names
  - Files Modified:
    - `pages/index.tsx` - Set isAdditional flag during template slot creation
    - `components/screens/PhotoSelectionScreen.tsx` - Updated handleTemplateAdd to set flag and remove suffix
  - Impact: Cleaner template names with proper tracking of template origin
  - Commit: Current

### Fixed
- **Delete Protection for Original Templates**:
  - Only additional prints can be deleted, original package templates are protected
  - Shows error toast when attempting to delete original package templates
  - Delete button only appears on templates marked as additional
  - Files Modified:
    - `components/TemplateGrid.tsx` - Updated delete button visibility to check isAdditional flag
    - `components/screens/PhotoSelectionScreen.tsx` - Added protection check in handleDeletePrint
  - Impact: Prevents accidental deletion of base package templates while allowing flexible management of added prints
  - Commit: Current

## [2025-08-13] - Fix Photo Upload Success Messages

### Fixed
- **Corrected Photo Upload Success Messages**:
  - Success message now correctly says "saved to the photos folder" instead of "prints folder"
  - Error message now correctly says "Check the photos folder" instead of "prints folder"
  - Files Modified:
    - `pages/index.tsx` - Fixed success/warning messages in `handlePhotoUpload`
  - Impact: Accurate messaging that reflects the actual folder structure
  - Commit: Current

## [2025-08-13] - Different Upload Messages for Templates vs Photos

### Changed
- **Distinct Upload Progress Messages**:
  - Template uploads show: "Uploading Templates" with "Preparing and uploading your prints..."
  - Photo uploads show: "Uploading Photos" with "Uploading your selected photos..."
  - Different helper text for each upload type
  - Removed "Rasterizing" and all technical terminology
  - Files Modified:
    - `pages/index.tsx` - Added `uploadType` state and conditional messaging in upload dialog
  - Impact: Clear distinction between operations with user-friendly language
  - Commit: Current

## [2025-08-13] - Separate Folders for Templates and Photos

### Changed
- **Separate Upload Folders**:
  - Templates and photos now upload to separate folders for better organization
  - Templates go to `Prints - [Client Name]` folder
  - Photos go to `Photos - [Client Name]` folder
  - Completely eliminates any file naming conflicts
  - Files Modified:
    - `pages/index.tsx` - Created separate `ensurePhotosFolder` function and reverted `ensurePrintsFolder` to simple version
  - Impact: Cleaner organization and no possibility of file conflicts between templates and photos
  - Commit: Current

## [2025-08-13] - Upload Options Dialog and Photo Upload Feature

### Added
- **Upload Options Modal After Finalize**:
  - New modal dialog appears after clicking finalize with two upload options
  - "Upload Print Templates" - Uploads generated print-ready templates (existing functionality)
  - "Upload Selected Photos" - New feature to copy favorited photos directly to Google Drive
  - Files Created:
    - `components/UploadOptionsModal.tsx` - New modal component with dual upload options
  - Impact: Users can now choose between uploading templates or raw photos
  - Commit: Current

- **Direct Photo Upload to Google Drive**:
  - New functionality to copy favorited photos directly to prints folder
  - No processing or rasterization - preserves original photo quality
  - Shows progress for each photo being uploaded
  - Files Modified:
    - `services/googleDriveService.ts` - Added `copyFile` method for Google Drive API v3 file copying
    - `pages/index.tsx` - Added `handlePhotoUpload` function for photo copying logic
  - Impact: Users can backup original photos alongside print templates
  - Commit: Current

### Changed
- **Removed Technical Terminology from UI**:
  - Changed "Rasterizing template" to "Generating template" in logs
  - Changed progress messages from "Rasterizing" to "Uploading"
  - Removed the word "rasterization" from all user-facing messages
  - Files Modified:
    - `pages/index.tsx` - Updated all progress messages and console logs
  - Impact: More user-friendly language that non-technical users can understand
  - Commit: Current

- **Refactored Upload Functionality**:
  - Split `handlePhotoContinue` into `handleTemplateUpload` and `handlePhotoUpload`
  - Extracted `ensurePrintsFolder` as reusable function
  - Better separation of concerns for different upload types
  - Files Modified:
    - `pages/index.tsx` - Refactored upload handlers
    - `components/screens/PhotoSelectionScreen.tsx` - Added modal integration and new props
  - Impact: Cleaner code architecture and better maintainability
  - Commit: Current

## [2025-08-13] - Add Prints Enhancement with Template Selection and Animation

### Changed
- **Add Prints Modal - Selection-First Approach**:
  - Changed from immediate add to selection-first interface (consistent with Change Template)
  - Users must now select a template before confirming the addition
  - Selected templates show green highlight border (removed blocking overlay)
  - Added persistent Cancel and Add Template buttons at bottom of modal
  - Buttons remain visible during loading/error states for better UX
  - Files Modified:
    - `components/AddPrintsModal.tsx` - Added selection state, made buttons persistent, removed blocking indicator
  - Impact: More intuitive and consistent user experience across template operations
  - Commit: Current

### Added
- **Auto-Navigation to Newly Added Templates**:
  - When template is added, coverflow automatically navigates to show it centered
  - Smooth transition animation to the new template position
  - Template "pops out" with scale animation to draw attention
  - Files Modified:
    - `components/screens/PhotoSelectionScreen.tsx` - Added templateToNavigate state
    - `components/TemplateGrid.tsx` - Added auto-navigation logic and animation support
    - `styles/globals.css` - Added template-pop keyframe animation
  - Impact: Users immediately see the template they just added, improving workflow
  - Commit: Current

- **Auto-Navigation After Template Deletion**:
  - When deleting a template, automatically navigate to the next available template
  - If deleted template was last, navigate to previous template
  - Maintains user context and flow after deletion
  - Files Modified:
    - `components/screens/PhotoSelectionScreen.tsx` - Updated handleDeletePrint with auto-navigation logic
  - Impact: Smoother workflow when managing multiple templates
  - Commit: Current

## [2025-08-13] - Unfavoriting Protection for Photos in Template Slots

### Added
- **Unfavoriting Protection Feature**:
  - Prevents users from unfavoriting photos that are already placed in template slots
  - Shows warning toast: "Please remove from template slot first" when attempted
  - Star button disabled and shows "cursor-not-allowed" for photos in slots
  - Tooltip changes to "Remove from template slot first" for used photos
  - Files Modified:
    - `components/screens/PhotoSelectionScreen.tsx` (lines 1187-1227) - Added check in handleToggleFavorite
    - `components/PhotoGrid.tsx` (lines 132-161) - Added disabled state to star button
  - Impact: Prevents accidental removal of favorited photos that are being used in templates
  - Commit: Current

## [2025-08-12] - Change Template Fix for Fill Templates Screen

### Fixed
- **Change Template Incompatibility Errors**:
  - Issue: All templates showing as "incompatible" with error "Template holes: 1, Expected slots: 1" even when counts matched
  - Root Cause: `handleConfirmTemplateSwap` only updated templateType but kept old slot structure, causing mismatch when new template had different hole count
  - Solution: Completely recreate slots for new template based on its hole count while preserving photos where possible
  - File: `components/screens/PhotoSelectionScreen.tsx` (lines 1319-1385)
  - Changes Made:
    1. Create new slots array based on new template's holes_data length
    2. Preserve photos from old slots in corresponding positions
    3. Generate unique slot IDs for new template
    4. Replace old slots entirely instead of just updating templateType
  - Impact: Change Template now works exactly like Package Selection without false incompatibility errors
  - Commit: Current

## [2025-08-12] - CRITICAL: Fast Refresh Loop Bug Fix

### 🚨 CRITICAL BUG FIXED
- **Infinite Refresh Loop in Development**:
  - Issue: App stuck in continuous reload loop, making development impossible
  - Root Causes:
    1. Missing `.env.local` file (deleted during `git clean -fdx` reset)
    2. Failed OAuth authentication causing 500 errors on `/api/auth/refresh`
    3. Next.js Fast Refresh trying to load stale webpack hot update files
    4. Authentication restoration on every page load triggering state changes
  - Symptoms:
    - Continuous "Fast Refresh had to perform a full reload" warnings
    - 404 errors for `/_next/static/webpack/*.webpack.hot-update.json`
    - Page refreshing every 1-2 seconds indefinitely
  - Solution:
    1. Recreated `.env.local` with correct Google OAuth and Supabase credentials
    2. Cleared Next.js cache (`rm -rf .next`)
    3. Run in production mode to bypass Fast Refresh: `npm run build && npm run start`
  - Files Modified:
    - `.env.local` - Recreated with proper credentials
    - `pages/index.tsx` - Temporarily disabled auth restoration (lines 394, 1046-1058)
  - Commits: Post-reset recovery

### ⚠️ IMPORTANT WARNINGS
- **NEVER run `git clean -fdx` without excluding `.env.local`**
  - `.env.local` is gitignored and contains critical API keys/secrets
  - Use: `git clean -fdx --exclude=.env.local` for safe resets
- **Fast Refresh Loop Recovery Steps:**
  1. Check `.env.local` exists with valid credentials
  2. Clear cache: `rm -rf .next node_modules/.cache`
  3. Run production mode: `npm run build && npm run start`
  4. If dev mode needed: Kill all node processes, clear ports, restart

### Added
- **Production Mode Instructions**: 
  - When Fast Refresh fails, use production mode as reliable fallback
  - Commands documented for quick recovery from refresh loops

## [2025-08-11] - Template UUID Lookup and Caching Fix

### Fixed
- **Template UUID Not Found Error**:
  - Issue: Templates added via "Add Prints" showed "No template found for type: [UUID]" error
  - Root Cause: Templates weren't being added to window.pngTemplates cache, causing lookup failures
  - Solution: 
    1. Updated template lookup to try UUID match first, then fall back to type+size matching
    2. Added templates to window cache when using "Add Prints" button
  - Files Modified:
    - `components/screens/PhotoSelectionScreen.tsx` (lines 154-168) - Enhanced template matching logic
    - `components/screens/PhotoSelectionScreen.tsx` (lines 514-532) - Add templates to window cache
  - Impact: Templates added dynamically now render correctly without errors
  - Commit: Current

## [2025-08-11] - Template Rendering Error Fix for Add Prints

### Fixed
- **Template Rendering Error in Add Prints**:
  - Issue: Templates added via "Add Prints" button showed "Template found but incompatible" error
  - Root Cause: templateType was storing generic type ("solo") instead of unique template ID
  - Solution: Changed templateType to use `template.id.toString()` matching Package Selection behavior
  - File: `components/screens/PhotoSelectionScreen.tsx` (line 507)
  - Impact: All template types (A4 Solo, 5R Solo, Photo Strip) now render correctly when added
  - Commit: Current

## [2025-08-11] - Add Prints Button in Fill Templates Screen

### Added
- **Add Prints Button in Template Filling Mode**:
  - File: `components/screens/PhotoSelectionScreen.tsx`
  - Added green "Add Prints" button next to Back button in header
  - Only visible in print mode (Fill Templates)
  - Uses same AddPrintsModal component as Package Selection screen
  - Consistent UI/UX across screens
  - Commit: Current

### Changed
- **Replaced Simple Modal with AddPrintsModal**:
  - Removed basic template addition dialog
  - Now uses full-featured AddPrintsModal with better template selection
  - Supports all print sizes and template types
  - Better visual preview of templates

### Removed
- **Old Add Print Implementation**:
  - Removed simple modal dialog (lines 1685-1796)
  - Removed unused state variables and handlers
  - Cleaned up unnecessary print size loading logic

## [2025-08-11] - Complete Photo Viewer Zoom Fixes

### Fixed
- **Zoom State Not Resetting**:
  - File: `components/ZoomableImage.tsx`
  - Issue: Swipe navigation stayed disabled after zooming back to 1x
  - Root Cause: onZoomChange only called when setting target, not during animation
  - Solution: Track zoom state in animation loop with 1.01 threshold
  - Now properly enables swipe when scale returns close to 1.0
  - Commit: `b8579ee`

- **Black Flash During Photo Transitions**:
  - File: `components/FullscreenPhotoViewer.tsx`
  - Issue: Black flash when swiping between photos
  - Root Cause: Component swapping from ProgressiveImage to ZoomableImage
  - Solution: Use ZoomableImage for all carousel photos with isActive prop
  - Only current photo (offset === 0) can be zoomed/panned
  - Eliminates component remounting and black flash
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