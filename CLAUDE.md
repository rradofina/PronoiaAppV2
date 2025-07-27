# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

### Development
```bash
npm run dev              # Start development server on localhost:3000
npm run build            # Create production build
npm run start            # Start production server
npm run type-check       # TypeScript validation without build
```

### Port Management
**CRITICAL - LOCALHOST 3000 ONLY**: This application MUST ONLY run on port 3000. NEVER use 3001, 3002, or any other port.

```bash
# Reset all ports and start fresh
npx kill-port 3000 && npx kill-port 3001 && npx kill-port 3002 && npm run dev
```

### Code Quality
```bash
npm run lint             # Check for ESLint issues
npm run lint:fix         # Auto-fix ESLint issues  
npm run format           # Format code with Prettier
npm run format:check     # Check formatting without changes
```

### Testing and Build Validation
```bash
npm run type-check       # Verify TypeScript types
npm run build            # Test production build works
```

## CRITICAL BUG FIXES (NEVER REVERT)

### 1. Template Hole Positioning
**Problem**: Photo placeholders were square and misaligned with PNG template holes.
**Fix**: `components/FullscreenTemplateEditor.tsx` - Fixed container sizing with exact aspect ratio (800px width, auto height) and removed `object-contain` to eliminate letterboxing.

### 2. Photo Loading CORS Issue  
**Problem**: Photos showed filenames but no images due to CORS blocking.
**Fix**: `next.config.js` - Set `Cross-Origin-Embedder-Policy: 'unsafe-none'` (NOT 'require-corp').

### 3. PNG Templates Not Displaying
**Problem**: PNG template backgrounds weren't showing in template bar.
**Fix**: `components/PngTemplateVisual.tsx` - Extract file ID from Google Drive URLs and use `lh3.googleusercontent.com/d/${fileId}` format.

### 4. Photo Cropping in Editor
**Problem**: Photos were automatically cropped to match slot aspect ratios.
**Fix**: `components/FullscreenTemplateEditor.tsx` - Use natural photo dimensions (`width: 'auto', height: 'auto'`) with `initialScale={0.5}` to show complete photos first.

## Development Guidelines

### Tablet Optimization Priority
This app is **primarily designed for Android tablets in landscape orientation**:
- Test responsive breakpoints at tablet sizes (768px-1024px)
- Ensure touch targets meet 44px minimum size requirements
- Verify template visibility and scrolling behavior on constrained heights
- Consider both portrait and landscape orientations

### State Management Patterns
- **New features**: Use modular stores (`authStore`, `driveStore`, etc.)
- **Legacy compatibility**: Original `useAppStore` still functional
- **Migration pattern**: Replace store hooks gradually, test thoroughly

### Google Drive Integration
- Always handle authentication state restoration on app load
- Implement fallback URL strategies for photo loading failures
- Use thumbnail URLs for grid views, full resolution for templates
- Handle rate limiting and API quota gracefully

## Environment Setup
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_ALLOWED_EMAILS=user1@gmail.com,user2@company.com
ADMIN_EMAILS=admin@company.com
```

## Project Architecture

### Core Concept
Tablet-optimized photo studio app for arranging Google Drive photos into 4R print templates.

### Application Flow
**Screen Sequence**: drive-setup → folder-selection → package → template → photos → preview

### State Management
Six specialized Zustand stores with clear separation of concerns:
- **`authStore.ts`** - Google authentication and Supabase user management
- **`driveStore.ts`** - Google Drive integration and photo management  
- **`sessionStore.ts`** - Client sessions and workflow state
- **`templateStore.ts`** - Template creation and photo assignment
- **`uiStore.ts`** - UI states and loading indicators
- **`adminStore.ts`** - Admin dashboard and template management

**Legacy**: `useAppStore.ts` - Original monolithic store (preserved for compatibility)

### Backend Integration
**Database**: Supabase PostgreSQL with real-time capabilities
- Authentication sync with Google OAuth
- Session persistence and custom template storage
- Admin features and user management

### Template System
**Print Format**: 4R size (1200x1800px, 300 DPI)
- **Solo**: Single photo with white border
- **Collage**: 2x2 grid layout
- **Photocard**: Edge-to-edge, no borders  
- **Photo Strip**: 6 photos in 3x2 arrangement

### Key Services
- **`googleDriveService.ts`** - Drive API integration with authentication
- **`templateGenerationService.ts`** - Canvas-based template generation
- **`supabaseService.ts`** - Database operations and user management
- **`manualTemplateService.ts`** - Custom template CRUD operations
- **`hybridTemplateService.ts`** - Unified template access

### Admin Dashboard
**Access**: `/admin/` with middleware protection
**Setup**: Set `ADMIN_EMAILS` env var or use Supabase SQL:
```sql
UPDATE users SET preferences = preferences || '{"role": "admin"}' WHERE email = 'your@email.com';
```

### Documentation
- `docs/ARCHITECTURE.md` - Detailed system architecture
- `docs/BUG-FIXES.md` - Critical bug fixes and solutions
- `docs/MANUAL-TEMPLATES.md` - Template management system