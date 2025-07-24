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
**CRITICAL - LOCALHOST 3000 ONLY**: This application MUST ONLY run on port 3000. NEVER use 3001, 3002, or any other port.

```bash
# Reset all ports and start fresh
npx kill-port 3000 && npx kill-port 3001 && npx kill-port 3002 && npm run dev
```

### Code Quality
```bash
npm run lint         # Check for ESLint issues
npm run lint:fix     # Auto-fix ESLint issues  
npm run format       # Format code with Prettier
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

## Environment Setup
```env
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your_google_client_id
NEXT_PUBLIC_GOOGLE_API_KEY=your_google_api_key
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_ALLOWED_EMAILS=user1@gmail.com,user2@company.com
```

## Quick Architecture Overview

**Core Concept**: Tablet-optimized photo studio app for arranging Google Drive photos into 4R print templates.

**Screen Flow**: drive-setup → folder-selection → package → template → photos → preview

**State Management**: Six modular Zustand stores (`authStore`, `driveStore`, `sessionStore`, `templateStore`, `uiStore`, `adminStore`)

**Backend**: Supabase PostgreSQL with Google OAuth sync

**Template Types**: Solo (1 photo), Collage (2x2), Photocard (edge-to-edge), Photo Strip (3x2)

**Admin Access**: `/admin/` with middleware protection. Set `ADMIN_EMAILS` env var or use Supabase SQL: `UPDATE users SET preferences = preferences || '{"role": "admin"}' WHERE email = 'your@email.com';`

For detailed documentation, see: `docs/ARCHITECTURE.md`, `docs/BUG-FIXES.md`, `docs/MANUAL-TEMPLATES.md`