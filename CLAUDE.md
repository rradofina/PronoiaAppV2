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
**Important**: This application should only run on port 3000 to avoid conflicts.

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

### Environment Setup
Create `.env.local` with:
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
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
- **Database Tables**: `users`, `sessions`, `templates`, `photo_slots`, `generated_templates`, `custom_templates`, `template_categories`
- **Authentication Sync**: Google OAuth synced with Supabase user accounts
- **Admin Features**: User management, custom template creation, analytics dashboard
- **Data Persistence**: Session data, custom templates, and user preferences stored in Supabase

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

## Key Files and Responsibilities

### Core Application
- `pages/index.tsx` - Main application entry point and screen routing
- `pages/index-refactored.tsx` - Example of new modular store usage

### Screen Components  
- `components/screens/DriveSetupScreen.tsx` - Google Drive authentication
- `components/screens/PhotoSelectionScreen.tsx` - Photo grid and template assignment
- `components/screens/PackageSelectionScreen.tsx` - Package selection interface
- `components/screens/TemplateSelectionScreen.tsx` - Template type configuration

### Core Services
- `services/googleDriveService.ts` - Google Drive API integration with authentication and file operations
- `services/templateGenerationService.ts` - Canvas-based template generation and export
- `services/supabaseService.ts` - Database operations, user management, and session persistence

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