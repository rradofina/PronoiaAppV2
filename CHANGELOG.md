# Changelog

All notable changes to PronoiaApp V2 SaaS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-17 - Complete SaaS Rewrite

### Overview
Complete rewrite of PronoiaApp as a multi-tenant SaaS platform. This is not an upgrade from v1.x but a ground-up rebuild with modern architecture and business features.

### Added
- **Multi-tenant Architecture**
  - Organization-based data isolation with RLS policies
  - Path-based routing `/org/:slug` for organization context
  - Organization creation and management
  - Per-org settings and branding

- **Visual Template Designer**
  - Canvas-based drag-and-drop interface (Fabric.js)
  - Pixel-precise photo slot positioning
  - Real-time preview with sample photos
  - Auto-save functionality (30-second intervals)
  - Undo/redo support
  - Smart guides and snapping
  - Keyboard shortcuts for productivity

- **Supabase Integration**
  - Authentication with email/password and magic links
  - Optional Google OAuth sign-in
  - PostgreSQL database with Row Level Security
  - Encrypted token storage for integrations
  - Real-time subscriptions support

- **Per-Organization Google Drive**
  - OAuth connection per organization
  - Server-side token management
  - Automatic token refresh
  - Folder browser for photo selection
  - Export to organization's Drive

- **Billing & Subscriptions**
  - Subscription plans (Starter/Professional)
  - 14-day free trial
  - Usage tracking (sessions per month)
  - Placeholder checkout flow (PayMaya integration ready)

- **Organization Branding**
  - Custom logo upload
  - Brand colors configuration
  - Font selection (Google Fonts)
  - Favicon customization
  - Live preview before saving

- **Modern UI with shadcn/ui**
  - Accessible, customizable components
  - Responsive tablet-optimized design
  - Dark mode support
  - Consistent design system

### Changed
- **Framework**: Migrated from Pages Router to Next.js 14+ App Router
- **Authentication**: Replaced Google-only auth with Supabase Auth
- **Database**: Moved from single-tenant to multi-tenant schema
- **UI Components**: Adopted shadcn/ui instead of custom components
- **State Management**: Refactored to organization-scoped Zustand stores
- **Routing**: Implemented organization context routing
- **Template Storage**: Unified template system with visual editor

### Removed
- Legacy Google Drive authentication coupling
- Monolithic `PhotoSelectionScreen.tsx` (split into components)
- JSON-only template editing
- Single-user limitations
- Hard-coded branding
- Client-side token management

### Technical Stack
- **Frontend**: Next.js 14+ with App Router, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **UI Library**: shadcn/ui with Radix UI primitives
- **Canvas**: Fabric.js for template designer
- **State**: Zustand for state management
- **Deployment**: Vercel with ISR support

### Migration Notes
- This is a complete rewrite - no direct upgrade path from v1.x
- Data export/import tools will be provided for existing users
- Parallel deployment recommended during transition
- All existing features maintained with improvements

### Security Improvements
- Row Level Security on all database tables
- Encrypted storage for OAuth tokens
- Server-side token exchange
- Organization-level data isolation
- Secure API routes with authentication checks

### Performance Targets
- Initial load: < 2.5 seconds
- Template designer: 60 FPS interactions
- Photo grid: Virtual scrolling for 1000+ images
- Auto-save latency: < 500ms

---

## Previous Version (V1.x)

The V1.x changelog has been archived. V1 was a single-user application tied to Google Drive authentication. For V1 history, see `CHANGELOG_v1.md` (archived).

## Notes

- Version 2.0.0 represents a complete rewrite, not an incremental update
- All future updates will build upon the V2 SaaS architecture
- Semantic versioning will be strictly followed going forward