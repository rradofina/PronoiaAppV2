# PronoiaApp V2 SaaS - Product Requirements Document

## Executive Summary
Complete rewrite of PronoiaApp as a multi-tenant SaaS platform for photo studios. Transform the current single-user Google Drive application into a scalable platform with organization management, visual template designer, and subscription billing.

**Approach**: Complete rewrite using modern stack - not a migration or refactor of existing code.

## Key Decisions

### Technical Stack
- **Framework**: Next.js 14+ with App Router (complete rewrite)
- **Auth**: Supabase Auth (email/password, magic link, optional Google OAuth)
- **Database**: Supabase PostgreSQL with Row Level Security
- **UI Components**: shadcn/ui with Tailwind CSS
- **Canvas Library**: Fabric.js or Konva.js for visual template designer
- **State Management**: Zustand stores (organization-scoped)

### Multi-tenancy Strategy
- **Routing**: Path-based `/org/:slug` for MVP (simpler than subdomains)
- **Data Isolation**: RLS policies with organization_id on all tables
- **Google Drive**: Each org connects own Drive account (OAuth per org)
- **Branding**: Customizable logo, colors, fonts per organization

### Billing & Plans (Placeholder Pricing)
- **Starter**: ₱500/month - 80 sessions/month
- **Professional**: ₱1,000/month - Unlimited sessions
- **Trial**: 14-day free trial
- **Payment**: Placeholder checkout (PayMaya integration post-MVP)

### MVP Scope
- ✅ Multi-tenant architecture
- ✅ Visual template designer with drag/drop
- ✅ Organization management (single owner initially)
- ✅ Per-org Google Drive integration
- ✅ Basic billing with usage tracking
- ❌ Team invitations (Phase 2)
- ❌ Custom domains (Phase 2)
- ❌ Client portal (Phase 2)

## Product Overview

### Problem Statement
Photo studios currently use manual processes or complex software for creating photo templates. PronoiaApp V1 works for single users but lacks multi-tenancy, visual editing, and business features needed for commercial use.

### Goals
1. **Complete Rewrite** as multi-tenant SaaS platform
2. **Visual Template Designer** - drag/drop interface with pixel precision
3. **Organization Management** - isolated workspaces with branding
4. **Modern UI/UX** - shadcn/ui components, tablet-optimized
5. **Scalable Architecture** - clean codebase readable by AI/developers
6. **Business Features** - billing, usage tracking, team management

### Non-Goals (MVP)
- Native mobile apps
- Multiple photo source providers (Dropbox, OneDrive)
- Team invitations and complex RBAC
- Custom domain automation
- Payment processing (placeholder only)
- Print fulfillment integration

## User Personas

### MVP (Single User per Org)
- **Studio Owner**: Creates organization, manages everything
  - Connects Google Drive
  - Creates/edits templates visually
  - Runs photo sessions
  - Manages billing

### Phase 2 (Team Features)
- **Organization Owner**: Billing and team management
- **Staff Photographer**: Runs sessions, uses templates
- **Template Designer**: Creates and manages templates
- **Client**: Views their photos (Phase 3)

## User Flows

### Onboarding Flow
1. User signs up with email/password
2. Creates organization with unique slug
3. Starts 14-day trial
4. Connects Google Drive (OAuth)
5. Configures branding (optional)
6. Creates first template using visual designer

### Studio Workflow
1. Create new session
2. Select client folder from Drive
3. Choose package/templates
4. Drag photos to template slots
5. Fine-tune positioning
6. Export to Drive or download

### Template Creation
1. Open visual template designer
2. Set print size and dimensions
3. Create photo slots using drag/drop
4. Adjust with pixel precision
5. Save template with metadata
6. Use in sessions immediately

## Functional Requirements

### 5.1 Multi-tenancy & Organization Management
- Create organization with unique slug (kebab-case)
- Organization settings and profile
- Branding configuration (logo, colors, fonts)
- Google Drive integration per org
- Usage tracking and limits

### 5.2 Authentication & Security
- Supabase Auth with multiple providers
- Email/password with verification
- Magic link authentication
- Optional Google OAuth
- Secure token storage for integrations
- Row Level Security on all data

### 5.3 Google Drive Integration (Per Organization)
- OAuth connection per organization
- Server-side token storage (encrypted)
- Folder browser for photo selection
- Template storage location
- Export destination configuration
- Automatic token refresh

### 5.4 Visual Template Designer (Core Feature)

#### Canvas Interface
- **Interactive Canvas** (Fabric.js/Konva.js):
  - Visual workspace showing template at actual print dimensions
  - Real-time rendering of photo slots as rectangles
  - Background grid overlay (toggleable)
  - Zoom controls: 25%, 50%, 100%, 200%, 400%, 800%
  - Pan using spacebar+drag or middle mouse
  - Mini-map for navigation on large templates

#### Photo Slot Manipulation
- **Creation**: Click and drag to create new photo slot
- **Selection**: Click to select, Ctrl+Click for multi-select, drag for box selection
- **Moving**: Drag selected slots, arrow keys for nudging (1px default, 10px with Shift)
- **Resizing**: 8-point handles on selection, maintain aspect ratio with Shift
- **Rotation**: Rotation handle above selection box
- **Alignment Tools**:
  - Align left/center/right/top/middle/bottom
  - Distribute horizontally/vertically
  - Match width/height across selection
- **Smart Guides**: Auto-show alignment lines when dragging near other slots
- **Snapping**:
  - Grid snap (5px, 10px, custom)
  - Edge snap to other slots
  - Center snap
  - Configurable snap threshold

#### Properties Panel
- **Transform Properties**:
  - X, Y position (pixel input with unit selector)
  - Width, Height (pixel/mm/inch with DPI conversion)
  - Rotation angle (degrees)
  - Lock aspect ratio toggle
- **Slot Properties**:
  - Slot name/ID
  - Z-order (bring forward/backward)
  - Lock/unlock slot
  - Visibility toggle

#### Toolbar
- **Tools**: Select, Create Rectangle, Create Circle, Pan, Zoom
- **Actions**: Duplicate, Delete, Group/Ungroup, Lock/Unlock
- **View**: Grid, Rulers, Guides, Snap settings
- **History**: Undo/Redo with keyboard shortcuts

#### Template Management
- **Save**: Auto-save every 30 seconds, manual save button
- **Versioning**: Create named versions, compare versions
- **Import**: Use PNG template as background reference
- **Export**: Download as JSON or image preview
- **Preview Mode**: Test with sample photos

### 5.5 Photo Selection & Session Management
- Create sessions with client information
- Browse and select Google Drive folders
- Grid view with virtualized scrolling
- Drag and drop to template slots
- Photo transformation controls
- Batch operations support

### 5.6 Export & Output
- Export individual templates
- Batch export all templates
- Google Drive upload with naming patterns
- Download as ZIP
- Resolution and quality settings
- Progress tracking

### 5.7 Billing & Subscription Management
- Subscription plans display
- Usage tracking (sessions per month)
- Trial countdown and expiry
- Upgrade prompts and CTAs
- Placeholder checkout flow
- Usage limit enforcement

### 5.8 Organization Branding
- Logo upload and display
- Primary/secondary color configuration
- Font selection (Google Fonts)
- Favicon customization
- Live preview before saving
- Default Pronoia branding fallback

## Technical Architecture

### Frontend Architecture
```
/app                    # Next.js App Router
  /(auth)              # Public auth routes
    /login
    /register
    /verify-email
  /(app)               # Protected app routes
    /[org]             # Organization context
      /dashboard
      /studio
        /sessions
        /templates
        /designer      # Visual template designer
      /settings
        /branding
        /integrations
        /billing

/components
  /ui                  # shadcn components
  /studio              # Studio-specific components
  /organization        # Org management components
  /shared              # Shared components

/lib
  /supabase            # Supabase client and types
  /services            # Business logic
  /stores              # Zustand stores
  /hooks               # Custom React hooks
  /utils               # Utility functions
```

### Database Schema

#### Core Tables
```sql
-- Organizations
organizations (
  id uuid primary key,
  name text not null,
  slug text unique not null,
  branding jsonb,
  settings jsonb,
  created_at timestamptz
)

-- Users & Membership
organization_users (
  org_id uuid references organizations(id),
  user_id uuid references auth.users(id),
  role text check (role in ('OWNER','ADMIN','STAFF')),
  primary key (org_id, user_id)
)

-- Templates
templates (
  id uuid primary key,
  organization_id uuid references organizations(id),
  name text not null,
  type text,
  dimensions jsonb,
  holes_data jsonb,  -- Array of photo slot objects
  thumbnail_url text,
  created_by uuid references auth.users(id),
  created_at timestamptz
)

-- Sessions
studio_sessions (
  id uuid primary key,
  organization_id uuid references organizations(id),
  client_name text,
  folder_id text,
  status text,
  created_by uuid references auth.users(id),
  created_at timestamptz
)

-- Integrations
organization_integrations (
  id uuid primary key,
  org_id uuid references organizations(id),
  type text check (type = 'GOOGLE_DRIVE'),
  config jsonb,
  secrets jsonb,  -- Encrypted tokens
  unique (org_id, type)
)

-- Subscriptions
organization_subscriptions (
  org_id uuid references organizations(id) primary key,
  plan_id uuid,
  status text,
  trial_ends_at timestamptz,
  current_period_end timestamptz
)
```

### API Endpoints

#### Organization Management
- `POST /api/orgs` - Create organization
- `GET /api/orgs/:slug` - Get organization details
- `PUT /api/orgs/:slug` - Update organization
- `PUT /api/orgs/:slug/branding` - Update branding

#### Template Management
- `GET /api/templates` - List templates
- `POST /api/templates` - Create template
- `PUT /api/templates/:id` - Update template
- `DELETE /api/templates/:id` - Delete template

#### Google Drive Integration
- `POST /api/integrations/google/connect` - Start OAuth flow
- `GET /api/integrations/google/callback` - OAuth callback
- `GET /api/drive/folders` - List folders
- `GET /api/drive/files` - List files
- `POST /api/drive/export` - Export to Drive

#### Billing
- `GET /api/billing/plans` - List available plans
- `GET /api/billing/usage` - Current usage
- `POST /api/billing/checkout` - Placeholder checkout

## Visual Template Designer - Technical Implementation

### Canvas Architecture
```typescript
// Core canvas component structure
interface TemplateDesigner {
  canvas: FabricCanvas | KonvaStage;
  tools: ToolManager;
  history: UndoRedoStack;
  properties: PropertiesPanel;
  layers: LayerManager;
}

// Photo slot representation
interface PhotoSlot {
  id: string;
  x: number;        // pixels from left
  y: number;        // pixels from top
  width: number;    // pixels
  height: number;   // pixels
  rotation: number; // degrees
  locked: boolean;
  visible: boolean;
  zIndex: number;
}
```

### Interaction Handlers
- **Mouse Events**: Click, drag, hover, wheel for zoom
- **Touch Events**: Touch, pinch, pan for tablets
- **Keyboard Shortcuts**:
  - `Delete`: Remove selected slots
  - `Ctrl+C/V`: Copy/paste slots
  - `Ctrl+D`: Duplicate selection
  - `Ctrl+Z/Y`: Undo/redo
  - `Ctrl+A`: Select all
  - `Space`: Pan mode
  - `Arrow Keys`: Nudge selection

### Performance Optimizations
- Virtual rendering for templates with 50+ slots
- Debounced auto-save (30 seconds)
- Cached template previews
- Optimistic UI updates
- WebGL acceleration when available

### Data Persistence
Templates save to `templates` table with:
- `holes_data`: Array of PhotoSlot objects
- `dimensions`: Template size and DPI
- `metadata`: Name, type, tags
- `version`: Incremental versioning
- `thumbnail`: Base64 preview image

## Implementation Strategy

### Complete Rewrite Approach
1. **New Codebase**: Start fresh with Next.js App Router
2. **Parallel Development**: Build new version alongside existing
3. **No Migration**: Export/import data tools for transition
4. **Modern Stack**: Latest versions of all dependencies

### Technology Choices
- **Next.js 14+**: App Router for better layouts and streaming
- **Supabase**: Backend-as-a-Service for auth, database, storage
- **shadcn/ui**: Modern, accessible, customizable components
- **Fabric.js**: Canvas manipulation library (mature, well-documented)
- **Tailwind CSS**: Utility-first styling
- **Zustand**: Lightweight state management

### Development Phases

#### Phase 1: Foundation (Week 1)
- Set up new Next.js project with TypeScript
- Configure Supabase with multi-tenant schema
- Implement authentication flows
- Basic organization creation

#### Phase 2: Core Features (Week 2)
- Visual template designer
- Google Drive integration per org
- Photo selection and editing
- Export functionality

#### Phase 3: Business Features (Week 3)
- Billing placeholders
- Usage tracking
- Organization settings
- Branding customization

#### Phase 4: Polish & Launch (Week 4)
- Performance optimization
- Testing and bug fixes
- Documentation
- Deployment setup

## Success Metrics

### MVP Launch Criteria
- [ ] Multi-tenant architecture with organization isolation
- [ ] Visual template designer with drag-and-drop interface
- [ ] Google Drive integration per organization
- [ ] Basic billing with usage tracking
- [ ] Organization branding (logo, colors)
- [ ] Clean, modular codebase
- [ ] Core shadcn/ui components integrated
- [ ] Responsive tablet-optimized UI

### Performance Targets
- Initial load: < 2.5 seconds
- Template designer: 60 FPS interactions
- Photo grid: Virtual scrolling for 1000+ images
- Auto-save: < 500ms latency

### Quality Standards
- TypeScript strict mode
- 80%+ component test coverage
- Accessibility: WCAG 2.1 AA compliant
- Mobile-first responsive design
- SEO optimized public pages

## Risk Mitigation

### Technical Risks
- **Canvas Performance**: Use virtualization and WebGL
- **Google Drive API Limits**: Implement caching and batching
- **Multi-tenant Data Leaks**: Strict RLS policies and testing
- **Browser Compatibility**: Progressive enhancement

### Business Risks
- **User Migration**: Provide data export/import tools
- **Feature Parity**: Phase rollout with user feedback
- **Pricing Sensitivity**: Start with placeholder billing

## Appendix

### Competitive Analysis
- Canva: Visual design, templates, collaboration
- PicMonkey: Photo editing, templates
- Fotor: Photo collage, batch processing
- Local photo studios: Manual processes, no automation

### Future Enhancements (Post-MVP)
- Team collaboration features
- AI-powered template suggestions
- Mobile app development
- Custom domain support
- Advanced analytics
- Print fulfillment integration
- Watermark overlays
- Client approval portal
- Multiple photo source providers