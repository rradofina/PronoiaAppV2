# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
npm run dev          # Start development server on localhost:3000
npm run build        # Create production build
npm run start        # Start production server
npm run type-check   # TypeScript validation without build
```

### Port Management
**CRITICAL - LOCALHOST 3000 ONLY**: This application MUST ONLY run on port 3000. NEVER use 3001, 3002, or any other port. The user has explicitly required port 3000 only.

**Reset all ports and start fresh:**
```bash
# Kill all processes on ports 3000-3002
npx kill-port 3000
npx kill-port 3001
npx kill-port 3002

# Start development server (will use port 3000)
npm run dev
```

**Check active ports:**
```bash
# Windows
netstat -ano | findstr :3000

# Kill specific process ID
taskkill /F /PID <process_id>
```

### Code Quality
```bash
npm run lint         # Check for ESLint issues
npm run lint:fix     # Auto-fix ESLint issues  
npm run format       # Format code with Prettier
npm run format:check # Check formatting without changes
```

## CRITICAL BUG FIX: Placeholder/Hole Positioning Issue

### Problem
Photo placeholders in PNG templates were appearing **square instead of rectangular** and **misaligned** with the actual holes in the PNG template background. This was a fundamental issue affecting the core template editing functionality.

### Root Cause Analysis
1. **Percentage positioning was incorrect** due to `object-contain` creating letterboxing
2. **Template container sizing** was causing aspect ratio distortion  
3. **Hole detection algorithm** was working correctly, but **CSS rendering** was wrong

### Solution Applied
**File: `components/FullscreenTemplateEditor.tsx`**

**BEFORE (Broken):**
```tsx
// Used viewport-based sizing that caused stretching
<div className="relative w-full h-full max-w-[90vw] max-h-[85vh]">
  <img className="w-full h-full object-contain" />
```

**AFTER (Fixed):**
```tsx
// Fixed container sizing with exact aspect ratio
<div className="relative" 
     style={{ 
       aspectRatio: `${pngTemplate.dimensions.width}/${pngTemplate.dimensions.height}`,
       width: '800px',
       height: 'auto'
     }}>
  <img className="w-full h-full" />
```

**Key Changes:**
1. **Fixed width container (800px)** instead of viewport-based sizing
2. **Auto height** with `aspectRatio` CSS property for precise scaling
3. **Removed `object-contain`** to eliminate letterboxing
4. **Percentage positioning now works correctly** because image fills container exactly

### Technical Details
- **Percentage positioning formula**: `left: ${(hole.x / template.width) * 100}%`
- **No letterboxing**: Image fills container completely without distortion
- **Zoom-safe**: Placeholders maintain alignment at all browser zoom levels
- **Aspect ratio preserved**: Template displays at correct proportions

### Verification
- ✅ Placeholders are properly rectangular (not square)
- ✅ Perfect alignment with PNG template holes
- ✅ Consistent behavior across all zoom levels
- ✅ No stretching or distortion

### Files Modified
- `components/FullscreenTemplateEditor.tsx` - Container sizing and positioning
- `services/templateDetectionService.ts` - Enhanced hole detection precision

### Environment Setup
Create `.env.local` with:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Email Access Control (optional - overrides hardcoded list)
NEXT_PUBLIC_ALLOWED_EMAILS=user1@gmail.com,user2@company.com,user3@domain.org
```

## Architecture Overview

### Core Concept
PronoiaApp is a **tablet-optimized photo studio management application** that allows clients to select photos from Google Drive and arrange them into professional 4R print templates. The app uses a **multi-screen workflow** with **responsive layouts** that adapt between tablet (vertical templates) and desktop (horizontal sidebar) orientations.

### State Management Architecture
The application recently underwent a **major refactoring from monolithic to modular state management**:

**Legacy**: Single `useAppStore.ts` (634 lines) - still exists for backward compatibility
**Current**: Six specialized Zustand stores with clear separation of concerns:

- `authStore.ts` - Google authentication state and Supabase user management
- `driveStore.ts` - Google Drive integration, folder navigation, and photo management  
- `sessionStore.ts` - Client sessions, package selection, and workflow state
- `templateStore.ts` - Template creation, photo assignment, and template management
- `uiStore.ts` - UI states, loading indicators, and user interactions
- `adminStore.ts` - Admin dashboard, user management, and custom template creation

### Backend Integration Architecture
**Supabase Backend**: PostgreSQL database with real-time capabilities
- **Database Tables**: `users`, `sessions`, `templates`, `photo_slots`, `generated_templates`, `custom_templates`, `template_categories`, `manual_templates`, `manual_packages`, `package_templates`, `manual_template_categories`
- **Authentication Sync**: Google OAuth synced with Supabase user accounts
- **Admin Features**: User management, custom template creation, manual template/package management, analytics dashboard
- **Data Persistence**: Session data, custom templates, manual template configurations, and user preferences stored in Supabase

### Screen Flow Architecture
The app follows a **linear multi-screen workflow** controlled by `currentScreen` state:

**Main Application Flow:**
1. **drive-setup** - Google Drive authentication and main folder selection
2. **folder-selection** - Client folder selection from main sessions folder
3. **package** - Package selection (A=1, B=2, C=5, D=10 templates)  
4. **template** - Template type selection and count configuration
5. **photos** - Photo assignment to template slots
6. **preview/complete** - Review and export

**Admin Dashboard Flow:**
- **Admin Authentication** - Middleware protection via `middleware/adminAuth.ts`
- **User Management** - View and manage registered users
- **Custom Template Creation** - Admin-only template designer
- **Manual Template Management** - Create and manage templates with precise configuration
- **Package Management** - Configure template packages for different print sizes
- **Session Analytics** - Track usage and performance metrics

### Template System Architecture
Templates are based on **4R photo dimensions** (1200x1800px, 300 DPI) with four types:
- **Solo**: Single photo with white border (60px padding)
- **Collage**: 2x2 grid with spacing (20px gap, 40px padding)
- **Photocard**: Edge-to-edge, no borders (0px padding)
- **Photo Strip**: 6 photos in 3x2 arrangement (15px spacing, 30px padding)

Each template consists of:
- **TemplateSlot[]**: Individual photo slots with position and photo assignment
- **TemplateVisual**: React component that renders template preview
- **Canvas generation**: High-quality output via `templateGenerationService.ts`

### Responsive Layout System
The app uses **orientation-aware responsive design**:

**Mobile/Tablet (< 1024px)**:
- Vertical layout with templates at bottom
- Fixed 320px template section height
- Horizontal scrolling templates
- Compact header with integrated navigation

**Desktop (≥ 1024px)**:
- Horizontal layout with sidebar templates
- 320px right sidebar for templates
- Vertical scrolling templates
- Separate header and bottom navigation

### Google Drive Integration Architecture
**Authentication**: OAuth 2.0 flow with token persistence and refresh
**Folder Structure**: Main sessions folder → Client folders → Photos
**Photo Loading**: Fallback URL strategy with thumbnail optimization
**Canvas Output**: Generated templates saved back to Google Drive

Key service: `googleDriveService.ts` handles all Drive API interactions with proper error handling and retry logic.

## CRITICAL FIX: Photo Loading CORS Issue

### Problem
Photos in PhotoSelectionScreen showed filenames but no images due to CORS blocking: `net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep`

### Root Cause
`next.config.js` had `Cross-Origin-Embedder-Policy: require-corp` which blocked Google Drive thumbnail URLs.

### Solution (NEVER REVERT)
**File: `next.config.js`**
```javascript
{
  key: 'Cross-Origin-Embedder-Policy',
  value: 'unsafe-none', // ← CRITICAL: Must be 'unsafe-none', NOT 'require-corp'
}
```

**Also added comprehensive Google domains:**
```javascript
domains: [
  'drive.google.com', 
  'lh1.googleusercontent.com', 'lh2.googleusercontent.com', // ... lh1-lh9
  'www.googleapis.com'
],
remotePatterns: [
  { protocol: 'https', hostname: '**.googleusercontent.com' },
  { protocol: 'https', hostname: 'drive.google.com' },
  { protocol: 'https', hostname: 'www.googleapis.com', pathname: '/drive/**' }
]
```

**Result:** Photos load instantly - filenames AND images display correctly.

**WARNING:** If CORS policy is changed back to `require-corp`, photos will break again!

## CRITICAL FIX: PNG Template Images Not Displaying in Template Bar

### Problem
PNG template backgrounds (with studio logos) were not showing in the template bar - only empty gray placeholders were visible.

### Root Cause Analysis
1. **Wrong property name**: PngTemplateVisual was looking for `pngTemplate.pngUrl` but hybrid templates store the URL in different properties
2. **Incorrect URL format**: Google Drive sharing URLs need specific formatting to work as image sources
3. **Property mapping**: Hybrid templates use `drive_file_id` (full Google Drive URL) instead of direct image URLs

### Solution (NEVER REVERT)
**File: `components/PngTemplateVisual.tsx`**

**BEFORE (Broken):**
```typescript
<img src={pngTemplate.pngUrl} />  // ← pngUrl was always undefined
```

**AFTER (Fixed):**
```typescript
// Extract file ID from Google Drive sharing URL and use googleusercontent.com
const fileId = pngTemplate.drive_file_id?.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
const pngUrl = pngTemplate.pngUrl || 
               pngTemplate.thumbnail_url || 
               pngTemplate.base64_preview ||
               (fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : null);

<img src={pngUrl} />
```

### Technical Details
- **Input**: `https://drive.google.com/file/d/14HdljMAb-qEXmVkweDK8JczAc8P4LQvU/view?usp=sharing`
- **Extracted File ID**: `14HdljMAb-qEXmVkweDK8JczAc8P4LQvU`  
- **Working URL**: `https://lh3.googleusercontent.com/d/14HdljMAb-qEXmVkweDK8JczAc8P4LQvU`

### Why This Format Works
- `lh3.googleusercontent.com` bypasses CORS restrictions
- Direct Google Drive `/uc?id=` URLs were being blocked
- This format works with our existing CORS configuration

**Result:** PNG templates with studio logos now display correctly in template bar!

**WARNING:** If URL format is changed back to `/uc?id=` or direct Drive links, PNG templates will disappear again!

## PHOTO TRANSFORM SYSTEM: How Cropping/Framing Works

### Current Understanding
The photo transform system has 3 layers that need to work together:

1. **FullscreenTemplateEditor** (Large Canvas)
   - Uses `react-zoom-pan-pinch` library
   - User pans/zooms photo to desired framing
   - Saves transforms as: `{ scale: 1.5, x: -100, y: 50 }` 
   - These values are relative to the LARGE editor canvas

2. **Template Bar Preview** (Small Thumbnails)
   - Shows small template previews (~280px width)
   - Currently uses `object-cover` which auto-scales to fill container
   - **PROBLEM**: Transform values from large canvas don't work on small previews

3. **Final Output Generation** (Print Resolution)
   - Generates high-resolution prints (1200x1800px for 4R)
   - Should use same transform values for consistent framing

### The Transform Challenge
```
Large Editor: 800px container → transform: { scale: 1.5, x: -100, y: 50 }
Small Preview: 200px container → Same values don't work!
```

**Root Issue**: Transform values are **absolute pixel values** but containers are **different sizes**

### Solution Strategy
Need to convert transforms **relative to container size**:

```typescript
// Convert absolute transforms to percentage-based
const relativeTransform = {
  scale: transform.scale, // Scale stays the same
  x: (transform.x / originalContainerWidth) * 100,  // Convert to %
  y: (transform.y / originalContainerHeight) * 100  // Convert to %
}
```

### Why This Will Work
- **Same scale factor** across all sizes
- **Percentage-based positioning** adapts to any container
- **Consistent framing** from editor → preview → final output

**Next Step**: Implement relative transform conversion in PngTemplateVisual

## Key Files and Responsibilities

### Core Application
- `pages/index.tsx` - Main application entry point and screen routing
- `pages/index-refactored.tsx` - Example of new modular store usage

### Screen Components  
- `components/screens/DriveSetupScreen.tsx` - Google Drive authentication
- `components/screens/PhotoSelectionScreen.tsx` - Photo grid and template assignment
- `components/screens/PackageSelectionScreen.tsx` - Package selection interface
- `components/screens/TemplateSelectionScreen.tsx` - Template type configuration

### Admin Components
- `components/admin/ManualTemplateManagerScreen.tsx` - Manual template creation and management interface
- `components/admin/ManualPackageManagerScreen.tsx` - Package configuration and template association interface

### Core Services
- `services/googleDriveService.ts` - Google Drive API integration with authentication and file operations
- `services/templateGenerationService.ts` - Canvas-based template generation and export
- `services/supabaseService.ts` - Database operations, user management, and session persistence
- `services/loggerService.ts` - Centralized logging service with structured logging and category-based filtering
- `services/manualTemplateService.ts` - Manual template CRUD operations and management
- `services/manualPackageService.ts` - Package management with template associations
- `services/hybridTemplateService.ts` - Unified template access combining manual and auto-detected templates

### State Management
- `stores/useAppStore.ts` - Legacy monolithic store (preserved for compatibility)
- `stores/authStore.ts` - Google authentication state and Supabase user sync
- `stores/driveStore.ts` - Drive folders and photo management
- `stores/sessionStore.ts` - Client sessions, packages, and Supabase persistence
- `stores/templateStore.ts` - Template and photo slot management
- `stores/uiStore.ts` - UI state and loading indicators
- `stores/adminStore.ts` - Admin dashboard and user management

### Configuration
- `utils/constants.ts` - Package definitions, template layouts, Google Drive config
- `types/index.ts` - TypeScript interfaces for all application entities
- `lib/supabase/client.ts` - Supabase client configuration
- `lib/supabase/types.ts` - Generated database types from Supabase
- `middleware/adminAuth.ts` - Admin route protection middleware

## Development Notes

### Tablet Optimization Priority
This app is **primarily designed for Android tablets in landscape orientation**. When making UI changes:
- Test responsive breakpoints at tablet sizes (768px-1024px)
- Ensure touch targets meet 44px minimum size
- Verify template visibility and scrolling behavior on constrained heights
- Consider both portrait and landscape orientations

### Google Drive Integration Patterns
- Always handle authentication state restoration on app load
- Implement fallback URL strategies for photo loading
- Use thumbnail URLs for grid views, full resolution for templates
- Handle rate limiting and API quota gracefully

### State Management Migration
When working with state:
- **New features**: Use modular stores (`authStore`, `driveStore`, etc.)
- **Legacy compatibility**: Original `useAppStore` still functional
- **Migration pattern**: Replace store hooks gradually, test thoroughly

### Template Visual Component
`TemplateVisual` is a memoized component that renders template previews:
- Handles four template types with different layouts
- Responds to slot clicks for photo assignment
- Adapts sizing based on container (mobile vs desktop)
- Uses inline styles for precise positioning

### Error Handling Strategy
- Use `ErrorBoundary` component for React error catching
- Implement retry mechanisms for API failures
- Provide fallback UIs for missing photos or failed loads
- Log errors to `uiStore` event system for debugging

### Supabase Integration Patterns
- **Dual Persistence**: Local storage fallback when Supabase unavailable
- **User Sync**: Google OAuth automatically creates/updates Supabase users
- **Session Management**: Both local and database session storage
- **Admin Features**: Database-backed user management and analytics
- **Custom Templates**: Admin-created templates stored in Supabase with metadata

### Admin Dashboard Access
- **Route**: `/admin/` with middleware protection
- **Authentication**: Separate admin authentication system
- **Features**: User management, template creation, session analytics
- **Database**: Full CRUD operations on all data entities

### Admin Setup for Production/Vercel

**Prerequisites**: User must sign in with Google first to create account in database.

**Method 1: Environment Variables (Recommended for Production)**
```bash
# In Vercel Environment Variables or .env.local
ADMIN_EMAILS=your-email@gmail.com,admin2@company.com
```
- Automatically grants admin role to specified emails
- Most secure for production deployments
- No manual setup required after sign-in

**Method 2: API Setup Route (One-time use)**
```bash
# POST request to your Vercel app
curl -X POST https://your-app.vercel.app/api/admin/setup \
  -H "Content-Type: application/json" \
  -d '{"email": "your-email@gmail.com", "setupKey": "setup-admin-2024"}'
```
- Remove or secure this endpoint after use
- Requires ADMIN_SETUP_KEY environment variable

**Method 3: Supabase SQL Editor**
```sql
-- Run in Supabase Dashboard > SQL Editor
UPDATE users 
SET preferences = COALESCE(preferences, '{}'::jsonb) || '{"role": "admin"}'::jsonb
WHERE email = 'your-email@gmail.com';
```
- Direct database access method
- See `scripts/admin-setup.sql` for complete script

### Template Builder System
- **Template Builder**: `/admin/templates/builder` - Visual template designer
- **Template Management**: `/admin/templates/` - View, edit, duplicate, delete templates
- **Features**: 
  - Canvas-based visual editor with drag & drop photo slots
  - Support for 4R, 5R, and A4 print sizes
  - Grid snapping and zoom controls
  - Template properties (name, description, category, tags)
  - Real-time preview and precise positioning
- **Workflow**: Create custom photo layouts → Save to database → Available in main app

## MAJOR ENHANCEMENT: Manual Template/Package System

### Problem Solved
The original auto-detection system for PNG templates was **unreliable and problematic**:
- Complex template matching logic caused photocard templates to show for other types
- Inconsistent hole detection and positioning
- No admin control over template availability or configuration
- Difficult to debug and maintain template issues

### Solution: Gradual Migration Architecture
Implemented a **hybrid system** that allows gradual migration from auto-detection to precise manual configuration:

**Phase 1: Hybrid Coexistence**
- Manual templates take precedence over auto-detected ones
- Auto-detection continues working for templates not yet manually configured
- Zero breaking changes to existing functionality

**Phase 2: Complete Migration** (Future)
- Eventually disable auto-detection entirely
- Full admin control over all templates and packages
- Reliable, predictable template behavior

### Database Schema Enhancement
**Migration File**: `lib/supabase/migrations/006_manual_template_system.sql`

**New Tables Added:**
```sql
-- Core manual template configuration
manual_templates (
  id, name, description, template_type, print_size,
  drive_file_id, holes_data, dimensions, thumbnail_url,
  created_by, is_active, sort_order, created_at, updated_at
)

-- Admin-configured packages
manual_packages (
  id, name, description, thumbnail_url, print_size,
  template_count, price, is_active, is_default, sort_order,
  created_by, created_at, updated_at
)

-- Package-template relationships
package_templates (
  id, package_id, template_id, order_index, created_at
)

-- Template organization
manual_template_categories (
  id, name, description, color, icon, sort_order, is_active, created_at
)
```

**Key Features:**
- **Row Level Security (RLS)** policies for data protection
- **Unique constraints** on drive_file_id and package-template relationships
- **Audit trails** with created_at/updated_at timestamps
- **Indexing** for performance on active templates and print sizes

### Service Layer Architecture
**New Services Added:**

**`services/manualTemplateService.ts`**
- Full CRUD operations for manual templates
- Caching system (5-minute duration) for performance
- Bulk import from auto-detection system
- Search, filtering, and activation controls
- Statistics and template management

**`services/manualPackageService.ts`**
- Package CRUD operations with template associations
- Package-template relationship management (add/remove/reorder)
- Default package designation per print size
- Template counting and validation

**`services/hybridTemplateService.ts`**
- **Core Innovation**: Combines manual and auto-detected templates
- **Precedence Rule**: Manual templates override auto-detected ones with same drive_file_id
- **Unified Interface**: Single API for accessing all templates regardless of source
- **Migration Tools**: Analysis and recommendations for converting auto to manual

### Admin Interface System
**Navigation Flow:**
```
PNG Template Management → Manual Templates → Package Manager
```

**`components/admin/ManualTemplateManagerScreen.tsx`**
- Create/edit templates with precise hole positioning and dimensions
- JSON editors for holes_data and dimensions configuration
- Import functionality to convert auto-detected templates to manual
- Template activation/deactivation controls
- Bulk operations and template statistics

**`components/admin/ManualPackageManagerScreen.tsx`**  
- Create packages by selecting from available manual templates
- Print size organization (4R, 5R, A4) with filtering
- Package pricing, descriptions, and thumbnail support
- Default package designation per print size
- Template selection interface with checkbox management
- Package details modal showing associated templates

### Technical Implementation Details

**Hybrid Template Loading:**
```typescript
// Manual templates take precedence over auto-detected ones
const hybridTemplates = [...manualTemplates, ...filteredAutoTemplates];

// Filter out auto-detected templates that have manual overrides
const manualDriveFileIds = new Set(manualTemplates.map(t => t.drive_file_id));
const filteredAuto = autoTemplates.filter(autoTemplate => 
  !manualDriveFileIds.has(autoTemplate.drive_file_id)
);
```

**Template Data Structure:**
```typescript
interface ManualTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: TemplateType; // 'solo' | 'collage' | 'photocard' | 'photostrip'
  print_size: PrintSize; // '4R' | '5R' | 'A4'
  drive_file_id: string; // Links to Google Drive PNG template
  holes_data: ManualTemplateHole[]; // Precise hole positions
  dimensions: { width: number; height: number };
  thumbnail_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Migration Strategy Benefits
1. **Zero Downtime**: Existing auto-detection continues working
2. **Gradual Transition**: Convert templates one-by-one as needed
3. **Admin Control**: Precise configuration of template behavior
4. **Reliability**: Eliminates complex template matching logic
5. **Maintainability**: Database-driven instead of algorithmic detection
6. **Scalability**: Easy to add new templates without code changes

### Development Workflow
**Creating Manual Templates:**
1. Navigate to PNG Templates → Manual Templates
2. Use "Import from Auto-Detection" to convert existing templates
3. Or create new templates with precise hole positions and dimensions
4. Edit template properties (name, description, type, print size)
5. Activate templates to make them available in the main application

**Managing Packages:**
1. Navigate to Manual Templates → Package Manager
2. Create packages by selecting templates for specific print sizes
3. Set package properties (name, description, pricing)
4. Designate default packages per print size
5. Reorder templates within packages as needed

**Integration Points:**
- Templates from `hybridTemplateService` are used throughout the main application
- Manual templates automatically override auto-detected ones with matching drive_file_id
- Package configuration affects template availability in client sessions
- Admin changes are immediately reflected in the main application (cache refresh)

## CRITICAL BUG FIX: Photo Cropping in FullscreenTemplateEditor

### The Problem
When photos with different aspect ratios (square, landscape) were placed in vertical template slots, the system was **automatically cropping parts of photos** to force them to match the slot's aspect ratio. This resulted in:
- Square photos showing only heads (bodies cropped off)
- Landscape photos having sides cut off
- Users never seeing the complete photo content
- Loss of important image details

### The Root Cause
The core issue was **forcing photos to fill slot dimensions exactly** using CSS properties:
- `objectFit: 'cover'` - Automatically cropped to fill container
- `width: '100%', height: '100%'` - Forced aspect ratio matching
- `minWidth/minHeight: '100%'` - Same cropping behavior
- TransformWrapper was constraining usable area to photo aspect ratio instead of slot dimensions

### The Breakthrough Solution
**File: `components/FullscreenTemplateEditor.tsx`**

**BEFORE (Broken - Cropped Photos):**
```tsx
// This approach CROPPED photos to match slot aspect ratio
<img style={{ 
  width: '100%',
  height: '100%', 
  objectFit: 'cover'  // ← CULPRIT: Automatically cropped photos
}}/>

<TransformWrapper initialScale={1.2}>
  <TransformComponent
    wrapperStyle={{ width: '100%', height: '100%' }}  // ← Forced dimensions
    contentStyle={{ width: '100%', height: '100%' }}
  />
</TransformWrapper>
```

**AFTER (Fixed - Preserves Complete Photos):**
```tsx
// This approach preserves ENTIRE photo content
<img style={{ 
  maxWidth: 'none',     // ← No width constraints
  maxHeight: 'none',    // ← No height constraints
  width: 'auto',        // ← Natural photo dimensions
  height: 'auto',       // ← Natural photo dimensions
  display: 'block'
}}/>

<TransformWrapper initialScale={0.5}>  // ← Start zoomed out
  <TransformComponent>  // ← No forced wrapper/content styles
</TransformWrapper>
```

### How The Solution Works
1. **Photo Keeps Natural Dimensions**: Image displays at its original aspect ratio
2. **Slot = Viewport Window**: The slot container (with `overflow: hidden`) acts as a clipping window
3. **No Automatic Cropping**: CSS doesn't force aspect ratio changes
4. **User Control**: Users see the COMPLETE photo first (initialScale={0.5}), then zoom/pan to choose what's visible
5. **Zero Data Loss**: Every pixel of the original photo is preserved and accessible

### Technical Implementation Details
```tsx
// The slot container provides clipping boundaries
<div style={{
  left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
  top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`, 
  width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
  height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`,
  overflow: 'hidden'  // ← Creates viewport window effect
}}>
  <TransformWrapper initialScale={0.5}>  // ← Show full photo initially
    <TransformComponent>
      <img style={{ 
        maxWidth: 'none',
        maxHeight: 'none', 
        width: 'auto',
        height: 'auto'
      }}/>
    </TransformComponent>
  </TransformWrapper>
</div>
```

### Results Achieved
- ✅ **Square photos in vertical slots**: Full square visible → users zoom/position as needed
- ✅ **Landscape photos in vertical slots**: Full landscape visible → users zoom/position as needed  
- ✅ **Vertical photos in vertical slots**: Works perfectly as expected
- ✅ **No image content lost**: Complete preservation of all photo details
- ✅ **User control**: Manual positioning instead of automatic cropping
- ✅ **Professional workflow**: Users can see entire photo before deciding crop

### The Mental Model
Think of it as:
- **Old approach**: "Force photo to fit the frame" (destructive cropping)
- **New approach**: "Show entire photo through a window" (non-destructive viewport)

The slot acts like looking through a **window** into a larger **canvas** where the complete photo exists. Users can move and scale the canvas to choose what appears in the window, but nothing is ever cropped away permanently.

### Files Modified
- `components/FullscreenTemplateEditor.tsx:223-250` - Removed forced dimensions and constraining styles
- Core change: Natural photo dimensions + viewport clipping instead of aspect ratio forcing

### Debugging Notes
Used color-coding during debugging:
- RED = Slot container (viewport window)
- BLUE = Constraining wrapper (removed as unnecessary)
- MAGENTA = Photo element  
- GREEN = Other slots

This visual debugging helped identify that TransformWrapper was constraining interaction area to photo aspect ratio instead of using full slot dimensions.

## Hole Detection Algorithm in Manual Template System

### Overview
The hole detection system uses **computer vision techniques** to automatically detect photo placeholder areas in PNG template files by scanning for **magenta-colored regions** (`#FF00FF`). This sophisticated algorithm enables automatic conversion of designer-created PNG templates into interactive photo templates without manual coordinate entry.

### Core Algorithm Components

#### 1. **Magenta Color Detection System**
**File**: `services/templateDetectionService.ts:15-20`

```typescript
// Supported magenta colors with tolerance for compression artifacts
private static readonly PLACEHOLDER_COLORS = [
  [255, 0, 255], // #FF00FF - Pure magenta
  [185, 82, 159] // #b9529f - Photoshop CMYK-converted magenta
];
private static readonly COLOR_TOLERANCE = 15;
```

The system detects two types of magenta colors:
- **Pure RGB magenta** (`#FF00FF`) - standard digital magenta used in design software
- **CMYK-converted magenta** (`#b9529f`) - handles Photoshop color space conversions
- **Color tolerance of ±15** - accounts for JPEG compression artifacts and slight color variations

#### 2. **Image Processing Pipeline**
**File**: `services/templateDetectionService.ts:45-65`

The main detection process follows this workflow:

```typescript
async analyzeTemplateByFileId(fileId: string): Promise<TemplateAnalysisResult> {
  // 1. Download PNG from Google Drive as blob
  const blobUrl = await this.createBlobUrlFromFileId(fileId);
  
  // 2. Load image into HTML Canvas for pixel manipulation
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = img.width;
  canvas.height = img.height;
  ctx.drawImage(img, 0, 0);
  
  // 3. Extract raw pixel data (RGBA array)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  
  // 4. Detect placeholder regions using flood fill algorithm
  const holes = this.detectPlaceholderRegions(imageData);
}
```

#### 3. **Flood Fill Algorithm for Region Detection**
**File**: `services/templateDetectionService.ts:120-150`

The core hole detection uses a **flood fill algorithm** to find connected placeholder regions:

```typescript
private floodFillBounds(imageData: ImageData, startX: number, startY: number, visited: Set<string>): Rectangle {
  const stack: Point[] = [{ x: startX, y: startY }];
  const bounds = { minX: startX, minY: startY, maxX: startX, maxY: startY };

  while (stack.length > 0) {
    const { x, y } = stack.pop()!;
    
    if (visited.has(`${x},${y}`) || !this.isPlaceholderPixel(data, x, y, width)) {
      continue;
    }
    
    visited.add(`${x},${y}`);
    
    // Update bounding rectangle
    bounds.minX = Math.min(bounds.minX, x);
    bounds.maxX = Math.max(bounds.maxX, x);
    bounds.minY = Math.min(bounds.minY, y);
    bounds.maxY = Math.max(bounds.maxY, y);
    
    // Add 4-connected neighbors to stack (up, down, left, right)
    stack.push(
      { x: x + 1, y }, { x: x - 1, y },
      { x, y: y + 1 }, { x, y: y - 1 }
    );
  }
  
  return bounds;
}
```

**How It Works:**
1. **Stack-based traversal**: Uses a stack to explore connected placeholder pixels
2. **4-connected neighborhood**: Checks up, down, left, right pixels
3. **Visited tracking**: Prevents infinite loops and duplicate processing
4. **Bounding box calculation**: Tracks min/max coordinates to define hole rectangle

#### 4. **Precise Boundary Detection**
**File**: `services/templateDetectionService.ts:180-205`

After flood fill finds rough bounds, the system performs **pixel-perfect boundary detection**:

```typescript
private getPreciseHoleBounds(imageData: ImageData, roughBounds: Rectangle) {
  let minX = roughBounds.maxX, maxX = roughBounds.minX;
  let minY = roughBounds.maxY, maxY = roughBounds.minY;
  
  // Scan EVERY pixel in rough bounds for exact placeholder edges
  for (let y = roughBounds.minY; y <= roughBounds.maxY; y++) {
    for (let x = roughBounds.minX; x <= roughBounds.maxX; x++) {
      if (this.isPlaceholderPixel(data, x, y, width)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }
  
  return {
    x: minX, y: minY,
    width: maxX - minX + 1,
    height: maxY - minY + 1
  };
}
```

**Purpose**: Eliminates edge cases where flood fill might miss edge pixels or include non-magenta pixels in bounds.

#### 5. **Photocard Layout Detection**
**File**: `services/templateDetectionService.ts:250-280`

The system includes special logic for **edge-to-edge photocard layouts**:

```typescript
private isPhotocardLayout(imageData: ImageData): boolean {
  // Sample edge pixels to detect placeholder areas touching borders
  const edgePixelsToCheck = [
    // Top edge, bottom edge, left edge, right edge samples
  ];
  
  // If >20% of edge samples are placeholder areas, likely a photocard
  const edgePlaceholderRatio = edgePlaceholderPixels / edgePixelsToCheck.length;
  return edgePlaceholderRatio > 0.2 && totalPlaceholderPixels > 100;
}
```

For photocard layouts, it uses **grid-based detection** instead of flood fill:

```typescript
private detectPhotocardHoles(imageData: ImageData): TemplateHole[] {
  const gridConfigs = [
    {rows: 2, cols: 2}, // 2x2 grid
    {rows: 2, cols: 3}, // 2x3 grid  
    {rows: 3, cols: 2}, // 3x2 grid
    // Additional grid configurations
  ];
  
  // Test each grid configuration and pick best match
  // Create holes based on calculated grid cells
}
```

#### 6. **Cross-Region Splitting Algorithm**
**File**: `services/templateDetectionService.ts:320-350`

The algorithm can detect and split cross-shaped magenta regions into separate rectangular holes:

```typescript
private splitCrossRegion(bounds: Rectangle, imageData: ImageData) {
  // Scans for separate magenta areas within a complex shape
  // Returns multiple holes if cross-pattern detected
  // Handles complex layouts where holes appear connected but should be separate
}
```

### Data Structures

#### **TemplateHole Interface**
```typescript
export interface TemplateHole {
  id: string;           // "hole_1", "hole_2", etc.
  x: number;           // Left edge pixel coordinate
  y: number;           // Top edge pixel coordinate  
  width: number;       // Width in pixels
  height: number;      // Height in pixels
}
```

#### **TemplateAnalysisResult Interface**  
```typescript
export interface TemplateAnalysisResult {
  holes: TemplateHole[];                    // Detected photo areas
  dimensions: { width: number; height: number }; // Template dimensions
  hasInternalBranding: boolean;             // Whether text is inside photo areas
  templateType: 'solo' | 'collage' | 'photocard' | 'photostrip'; // Inferred type
}
```

### Advanced Features

#### **Template Type Inference**
**File**: `services/templateDetectionService.ts:400-430`

```typescript
private determineTemplateType(holes: TemplateHole[], filename?: string) {
  // 1. First try filename keywords (solo, collage, photocard, strip)
  // 2. Fallback to hole count: 1=solo, 4=collage/photocard, 6=photostrip
  // 3. Use aspect ratio to distinguish collage vs photocard for 4-hole layouts
}
```

#### **Validation System**
**File**: `services/templateDetectionService.ts:450-470`

```typescript
validateTemplate(result: TemplateAnalysisResult) {
  // Check minimum hole size (50px minimum)
  // Detect overlapping holes (invalid layouts)
  // Ensure at least one hole detected
  // Validate hole positioning within template bounds
}
```

### Performance Optimizations

1. **Minimum hole size filtering** - Ignores regions smaller than 50px to eliminate noise
2. **Sampling for photocard detection** - Tests every 10th pixel for performance on large images
3. **Caching system** - Results stored in Supabase `template_cache` table to avoid reprocessing
4. **Early termination** - Skips transparent pixels (alpha < 128) to improve scan speed
5. **Memory management** - Properly disposes of canvas elements and blob URLs

### Integration with Template System

The detected holes are used throughout the application:

1. **Template Creation** (`services/manualTemplateService.ts`) - Holes become `TemplateSlot` objects for photo assignment
2. **Visual Rendering** (`components/PngTemplateVisual.tsx`) - Positions photos using hole coordinates  
3. **Canvas Generation** (`services/templateGenerationService.ts`) - Uses holes for final output positioning
4. **Template Editor** (`components/FullscreenTemplateEditor.tsx`) - Interactive photo placement using hole boundaries

### Error Handling and Edge Cases

1. **Invalid magenta detection** - Filters out noise and artifacts
2. **Complex shapes** - Handles non-rectangular magenta regions by finding bounding boxes
3. **Overlapping regions** - Validates and warns about invalid layouts
4. **Empty templates** - Handles templates with no detectable holes gracefully
5. **Large images** - Optimized processing for high-resolution templates

### Usage in Manual Template Workflow

**File**: `components/admin/ManualTemplateManagerScreen.tsx`

When creating manual templates, the hole detection system:
1. **Auto-detects holes** from PNG template files uploaded to Google Drive
2. **Displays hole count** in template preview cards with overlay badges
3. **Validates hole positioning** before saving to database
4. **Provides feedback** to admin users about detection results

This sophisticated hole detection system eliminates the need for manual coordinate entry and enables designers to create templates using familiar magenta placeholder regions in their design software.