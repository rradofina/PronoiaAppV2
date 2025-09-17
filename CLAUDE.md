# CLAUDE.md - PronoiaApp V2 SaaS

This file provides guidance to Claude Code (claude.ai/code) when working on the PronoiaApp V2 SaaS rewrite.

## Project Overview

PronoiaApp V2 is a complete rewrite as a multi-tenant SaaS platform for photo studios. We're building from scratch with:
- Next.js 14+ App Router
- Supabase (Auth, Database, Storage)
- shadcn/ui components
- Visual template designer
- Per-organization Google Drive integration

**Important**: This is a COMPLETE REWRITE, not a refactor of existing code.

## MCP Server Configuration

### Windows Compatibility Requirements
**IMPORTANT**: On Windows, all npx-based MCP servers require the `cmd /c` wrapper to function properly. The auto-generated configurations from `npx shadcn@latest mcp init` will not work on Windows without modification.

### Complete Working Configuration (.mcp.json)
```json
{
  "mcpServers": {
    "shadcn": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "shadcn@latest", "mcp"]
    },
    "supabase": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "${SUPABASE_ACCESS_TOKEN}",
        "SUPABASE_PROJECT_REF": "${SUPABASE_PROJECT_REF}"
      }
    },
    "context7": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "@context7/mcp-server@latest"]
    }
  }
}
```

### Environment Variables (.env.local)
Store sensitive MCP credentials in environment variables:
```env
# Supabase Configuration for MCP Server
SUPABASE_ACCESS_TOKEN=your_actual_token
SUPABASE_PROJECT_REF=your_project_ref
```

### Platform-Specific Notes
- **Windows**: Always use `"command": "cmd"` with `"args": ["/c", "npx", ...]`
- **macOS/Linux**: Can use `"command": "npx"` directly with `"args": ["package", "mcp"]`
- **Troubleshooting**: If MCP servers don't appear, verify Windows compatibility and restart Claude Code

### Initial Setup Commands
```bash
# Initialize shadcn MCP (generates Unix-style config)
npx shadcn@latest mcp init --client claude

# Fix Windows compatibility manually in .mcp.json
# Replace "command": "npx" with "command": "cmd"
# Add "/c" as first argument: ["npx", ...] becomes ["/c", "npx", ...]
```

## Development Commands

### Initial Setup
```bash
# Create new Next.js project
npx create-next-app@latest pronoia-v2 --typescript --tailwind --app

# Install shadcn/ui
npx shadcn@latest init

# Install core dependencies
npm install @supabase/supabase-js zustand fabric react-hotkeys-hook
npm install @radix-ui/react-icons class-variance-authority clsx tailwind-merge
```

### Development
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run start            # Start production server
npm run type-check       # Run TypeScript validation
```

### Database Setup (via Supabase MCP)
Use the Supabase MCP commands to:
1. Create tables with RLS policies
2. Set up authentication providers
3. Configure storage buckets
4. Generate TypeScript types

### Documentation Lookup (via context7 MCP)
Use the context7 MCP for fetching up-to-date documentation:
1. **Library documentation** - Get latest docs for any framework/library
2. **Code examples** - Retrieve real-world usage patterns
3. **Best practices** - Access current recommended approaches

**Key use cases for PronoiaApp V2:**
- Next.js App Router patterns and server actions
- Supabase authentication flows and RLS patterns
- Fabric.js canvas manipulation techniques
- shadcn/ui component usage and customization
- TypeScript patterns for multi-tenant architectures

**Usage pattern:**
```typescript
// First resolve library name to Context7 ID
context7.resolve-library-id("next.js")
// Then fetch documentation with specific topic
context7.get-library-docs("/vercel/next.js", { topic: "server actions" })
```

### Project Management (via GitHub MCP)
Use the GitHub MCP for development workflow automation:
1. **Pull Request Management** - Create, review, and merge PRs
2. **Issue Tracking** - Create and manage development tasks
3. **Code Reviews** - Request and submit reviews
4. **Release Management** - Tag releases and manage deployment

**Essential workflows for PronoiaApp V2:**
- Database migration PRs with automated testing
- Feature development with proper issue tracking
- Code review automation for quality assurance
- Release coordination with proper versioning

**Usage patterns:**
```bash
# Create feature branch and PR for database changes
github.create_branch("feature/add-templates-table")
github.create_pull_request({
  title: "Add templates table with RLS policies",
  body: "Implements multi-tenant template storage with organization isolation"
})

# Create issues for development tasks
github.create_issue({
  title: "Implement visual template designer",
  labels: ["feature", "high-priority"],
  assignee: "current-user"
})

# Request code reviews
github.request_copilot_review(pullNumber)
```

## Integrated MCP Workflows

### Complete Feature Development Workflow
**Research → Build → Deploy → Track** - Use all MCPs together for efficient development:

```bash
# 1. Research best practices (context7 MCP)
context7.resolve-library-id("fabric.js")
context7.get-library-docs("/fabricjs/fabric.js", { topic: "canvas manipulation" })

# 2. Install required components (shadcn MCP)
shadcn.add_components(["dialog", "form", "button"])

# 3. Create database changes (Supabase MCP)
supabase.apply_migration("add_template_designer_tables", sql_query)

# 4. Create PR for review (GitHub MCP)
github.create_pull_request({
  title: "Implement canvas-based template designer",
  body: "Adds visual designer with Fabric.js integration"
})
```

### Database-First Development Pattern
**Schema → Types → PR → Review** - Streamlined database changes:

```bash
# 1. Apply migration with proper naming
supabase.apply_migration("add_organization_branding", `
  ALTER TABLE organizations ADD COLUMN branding jsonb DEFAULT '{}';
  -- Add RLS policies for branding access
`)

# 2. Generate updated TypeScript types
supabase.generate_typescript_types()

# 3. Create feature branch and PR
github.create_branch("feature/organization-branding")
github.create_pull_request({
  title: "Add organization branding support",
  body: "- Adds branding JSONB column\n- Updates TypeScript types\n- Maintains RLS isolation"
})

# 4. Request automated review
github.request_copilot_review(pullNumber)
```

### Component-Driven Development
**Docs → Components → Integration → Testing** - UI-first approach:

```bash
# 1. Research component patterns
context7.get-library-docs("/shadcn/ui", { topic: "form components" })

# 2. Install needed components
shadcn.add_components(["form", "input", "select", "textarea"])

# 3. Create development issue
github.create_issue({
  title: "Build organization settings form",
  labels: ["ui", "settings"],
  body: "Implement branding configuration form with validation"
})
```

### Release & Deployment Workflow
**Test → Document → Release → Deploy** - Production readiness:

```bash
# 1. Ensure database is clean
supabase.get_advisors("security") # Check for RLS issues
supabase.get_advisors("performance") # Check for optimization opportunities

# 2. Create release PR
github.create_pull_request({
  title: "Release v2.1.0 - Organization Branding",
  body: "Production-ready branding system with security audit"
})

# 3. Tag release after merge
github.create_release({
  tag_name: "v2.1.0",
  name: "Organization Branding Release"
})
```

### MCP Best Practices

#### When to Use Each MCP:
- **context7**: Before implementing any new feature or using unfamiliar libraries
- **shadcn**: When adding new UI components or updating existing ones
- **Supabase**: For all database operations, especially DDL changes
- **GitHub**: For all code changes, reviews, and project management

#### Error Handling:
- Always verify Supabase operations with `get_advisors` before proceeding
- Use GitHub MCP to create issues for any blockers encountered
- Leverage context7 for troubleshooting complex library integration issues

#### Workflow Optimization:
- **Batch Operations**: Group related MCP calls together for efficiency
- **Documentation First**: Use context7 to research before implementing
- **Security First**: Run Supabase advisors after any schema changes
- **Review Everything**: Use GitHub MCP for all code changes, even small ones

## Project Structure

```
/app                    # Next.js App Router
  /(auth)              # Public auth routes
    /login
    /register
    /verify-email
  /(app)               # Protected routes
    /[org]             # Organization context
      /dashboard
      /studio
        /sessions
        /templates
        /designer      # Visual template designer
      /settings

/components
  /ui                  # shadcn components
  /studio              # Studio components
  /organization        # Org management
  /shared              # Shared components

/lib
  /supabase            # Supabase client
  /services            # Business logic
  /stores              # Zustand stores
  /hooks               # Custom hooks
  /utils               # Utilities
```

## Core Features to Implement

### 1. Multi-tenant Architecture
- Organization-based data isolation
- RLS policies on all tables
- Path-based routing: `/org/:slug`

### 2. Visual Template Designer
- Canvas-based editor (Fabric.js)
- Drag/drop photo slot creation
- Pixel-precise positioning
- Real-time preview
- Auto-save functionality

### 3. Per-Org Google Drive
- OAuth per organization
- Server-side token storage
- Encrypted refresh tokens
- Automatic token renewal

### 4. shadcn/ui Components
Essential components to install:
```bash
npx shadcn@latest add button card dialog sheet tabs
npx shadcn@latest add form input select textarea
npx shadcn@latest add table data-table
npx shadcn@latest add navigation-menu sidebar
npx shadcn@latest add toast alert badge
```

## Database Schema (Core Tables)

```sql
-- Organizations
CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  branding jsonb DEFAULT '{}',
  settings jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

-- Templates
CREATE TABLE templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES organizations(id),
  name text NOT NULL,
  type text,
  dimensions jsonb,
  holes_data jsonb,  -- Array of photo slots
  thumbnail_url text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates ENABLE ROW LEVEL SECURITY;
```

## Implementation Priorities

### Week 1: Foundation
1. Set up Next.js with App Router
2. Configure Supabase authentication
3. Create multi-tenant database schema
4. Implement organization creation flow

### Week 2: Core Features
1. Build visual template designer
2. Implement Google Drive integration
3. Create studio workflow
4. Add photo manipulation

### Week 3: Business Features
1. Add billing placeholders
2. Implement usage tracking
3. Create organization settings
4. Add branding customization

### Week 4: Polish
1. Performance optimization
2. Testing and bug fixes
3. Documentation
4. Deployment preparation

## Key Design Decisions

### State Management
Use Zustand stores with organization context:
```typescript
interface OrgStore {
  currentOrg: Organization | null;
  setOrg: (org: Organization) => void;
  clearOrg: () => void;
}
```

### Canvas Library
Fabric.js for template designer:
- Mature and well-documented
- Good React integration
- Extensive manipulation tools
- Touch support for tablets

### Routing Strategy
Path-based for MVP: `/org/:slug/...`
- Simpler than subdomain routing
- Easier local development
- Can migrate to subdomains later

## Performance Guidelines

### Template Designer
- Target 60 FPS for interactions
- Virtual rendering for 50+ slots
- Debounced auto-save (30s)
- WebGL acceleration when available

### Photo Grid
- Virtual scrolling for 1000+ images
- Progressive image loading
- Thumbnail caching
- Lazy loading

## Security Considerations

### Row Level Security
All tables must have RLS policies:
```sql
CREATE POLICY "Users can view own org data"
ON templates FOR SELECT
USING (organization_id IN (
  SELECT org_id FROM organization_users
  WHERE user_id = auth.uid()
));
```

### Token Storage
- Google Drive refresh tokens encrypted
- Server-side token exchange only
- Short-lived access tokens to client

## Testing Strategy

### Unit Tests
- Template calculations
- Transform utilities
- Business logic services

### Integration Tests
- Authentication flows
- Multi-tenant isolation
- API endpoints

### E2E Tests (Playwright)
- Organization creation
- Template designer
- Studio workflow
- Export process

## Deployment

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google OAuth
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Application
NEXT_PUBLIC_APP_URL=
```

### Vercel Deployment
- Configure environment variables
- Set up preview deployments
- Enable ISR for marketing pages
- Configure domain routing

## Common Patterns

### API Route Structure
```typescript
// app/api/[org]/templates/route.ts
export async function GET(
  request: Request,
  { params }: { params: { org: string } }
) {
  // Verify org access
  // Fetch templates
  // Return response
}
```

### Protected Pages
```typescript
// app/(app)/[org]/layout.tsx
export default async function OrgLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: { org: string };
}) {
  // Verify authentication
  // Load organization
  // Provide context
  return children;
}
```

## Migration Notes

Since this is a complete rewrite:
1. Build new system in parallel
2. No direct migration of old code
3. Provide data export/import tools
4. Phase rollout to users

## Support & Resources

- [Supabase Docs](https://supabase.com/docs)
- [shadcn/ui Docs](https://ui.shadcn.com)
- [Fabric.js Docs](http://fabricjs.com/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- **context7 MCP** - Dynamic documentation lookup for any library/framework

## Notes for AI/Developers

1. **Always use TypeScript strict mode**
2. **Follow shadcn/ui patterns for consistency**
3. **Implement RLS policies for all new tables**
4. **Use server actions for mutations**
5. **Keep components small and focused**
6. **Document complex business logic**
7. **Test multi-tenant isolation thoroughly**
8. **🚨 CRITICAL: NO WORKAROUNDS OR BAND-AID SOLUTIONS 🚨**
   - This is a professional SaaS application - we settle for PERFECTION, not less
   - If ANY system, service, component, or feature doesn't work perfectly, STOP and ask for help
   - Never implement temporary fixes, hacks, or "good enough" solutions
   - Never skip proper setup, configuration, or best practices
   - Always solve the root cause, not the symptoms
   - No compromises on code quality, architecture, security, or user experience
   - When in doubt, ask the user for assistance rather than proceeding with imperfect solutions