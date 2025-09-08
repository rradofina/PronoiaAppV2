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

### 5. Auto-Snap Movement Direction Bug (CRITICAL - Commits: cc16e75, 3b8eb45)
**Problem**: Auto-snap was moving photos in opposite directions, making gaps larger instead of closing them.
**Root Cause**: Movement logic was backwards - gap on left moved photo left (away from edge) instead of right (toward edge).

**Complete Fix Implementation**:

**Files Modified**: `components/PhotoRenderer.tsx`, `components/InlinePhotoEditor.tsx`

**Key Changes Made**:
1. **Fixed Movement Directions** (cc16e75):
   ```javascript
   // WRONG (old code):
   if (significantGaps.left) {
     horizontalMovement = -gaps.left / containerRect.width; // moved further left
   }
   
   // CORRECT (fixed code):
   if (significantGaps.left) {
     horizontalMovement = gaps.left / containerRect.width; // moves right to close gap
   }
   ```

2. **Removed Recent Interaction Blocking**:
   - **Problem**: 3-second interaction timeout prevented auto-snap from working when users clicked checkmark after positioning
   - **Fix**: Removed `hasRecentUserInteraction()` blocking in finalization - auto-snap now works regardless of recent interaction

3. **Removed Gap Detection Threshold**:
   - **Problem**: 5px threshold ignored small gaps that should trigger movement
   - **Fix**: Set `GAP_THRESHOLD = 0` to detect ANY gap amount (user specification: "move by exact gap amounts")

4. **Added Post-Snap Gap Validation** (3b8eb45):
   - **Problem**: Photos appearing to have 2 gaps but actually too small for container, creating worse positioning after movement
   - **Solution**: Added `detectPostSnapGaps()` function with 5px allowance threshold
   - **Logic**: If movement would create 3+ gaps after snapping → override to reset-to-default instead

**User Specification Implementation**:
- **4+ sides with gaps** → Reset to default view (center, scale 1.0)
- **3 sides with gaps** → Reset to default view  
- **2 sides with gaps** → Move by exact pixel amounts (e.g., left 20px + top 10px = move right 20px + down 10px)
- **1 side with gaps** → Move by exact pixel amount (e.g., top 20px = move down 20px)
- **Post-snap validation** → If movement creates 3+ gaps, reset to default instead

**Critical Functions Added/Modified**:
- `detectGaps()` - DOM-based gap measurement with 0px threshold
- `calculateGapBasedMovement()` - Pixel-to-percentage movement calculation with post-snap validation
- `detectPostSnapGaps()` - Simulates gaps after movement with 5px allowance
- `finalizePositioning()` - Comprehensive finalization with logging
- Enhanced debug UI with gap visualization and post-snap override warnings

**Testing Commands**:
```bash
# Test auto-snap functionality
npm run dev
# 1. Position photo with gaps
# 2. Click checkmark (✓) button  
# 3. Verify correct movement direction
# 4. Check console logs for validation process
```

**NEVER REVERT**: This fix resolves fundamental movement direction bug and prevents edge case poor positioning. Both commits (cc16e75, 3b8eb45) must remain intact.

### 6. Photo Rasterization Positioning Shift (PARKED - IN INVESTIGATION)
**Problem**: Downloaded/rasterized photos have slight upward shift compared to editor preview display.
**Root Cause**: Mathematical differences between CSS percentage-based transforms (`PhotoRenderer.convertPhotoToCSS()`) and canvas pixel-based positioning calculations (`templateRasterizationService.drawPhotoWithTransform()`).

**Investigation Findings**:
- **Amplification Effect**: Shift is more noticeable on zoomed photos (3x zoom = 3x more visible shift)
- **Not Precision**: Issue isn't decimal places but fundamentally different calculation algorithms
- **CSS vs Canvas**: CSS uses hardware-accelerated matrix transforms; canvas uses manual pixel math
- **Transform Order**: CSS applies transforms as single matrix operation; canvas applies step-by-step

**Planned Solution**:
1. **Reverse Engineer CSS**: Use `getBoundingClientRect()` to capture actual CSS-rendered photo positions
2. **Compare Systems**: Log both CSS and canvas positioning calculations side-by-side
3. **Find Delta**: Calculate empirical correction factor to eliminate discrepancy
4. **Apply Fix**: Adjust canvas positioning in `templateRasterizationService.ts` to match CSS exactly

**Files to Modify**:
- `services/templateRasterizationService.ts` - Canvas positioning calculations (lines 287-302)
- `components/PhotoRenderer.tsx` - Add temporary diagnostic logging for comparison

**Key Code Areas**:
```javascript
// CSS System (PhotoRenderer.tsx:58-63)
const translateX = (0.5 - photoTransform.photoCenterX) * 100;
transform: `translate(${translateX}%, ${translateY}%) scale(${photoScale})`

// Canvas System (templateRasterizationService.ts:287-302)  
const translateXPixels = (translateXPercent / 100) * renderedWidth;
const finalX = translatedCenterX - (finalWidth / 2);
ctx.drawImage(img, finalX, finalY, finalWidth, finalHeight);
```

**Status**: PARKED - Resume after completing other priority tasks that may affect this positioning system.

### 7. Supabase MCP Connection Configuration for Claude CLI (FIXED - 2025-09-07)
**Problem**: Supabase MCP server wouldn't connect despite correct package installation and credentials in Claude CLI.
**Root Cause**: Malformed command configuration in Claude CLI - the `/c` parameter was being parsed as `C:/` causing command execution failure.

**Complete Fix Implementation**:
1. **Problem Identification**: Claude CLI's `claude mcp add` command incorrectly parsed `cmd /c` arguments, resulting in malformed configurations like `cmd C:/ npx...` instead of `cmd /c npx...`.

2. **Solution**: Use project-level `.mcp.json` configuration file instead of CLI commands for complex MCP server setups.

3. **Correct Configuration** (`.mcp.json` in project root):
```json
{
  "mcpServers": {
    "supabase": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your_token",
        "SUPABASE_PROJECT_REF": "your_ref"
      }
    }
  }
}
```

4. **Project-scoped Server Approval**: Claude CLI requires explicit approval for project-scoped servers:
   - Use `claude mcp reset-project-choices` to reset approval state
   - Restart Claude CLI to trigger approval prompts
   - Approve the project-scoped Supabase server when prompted

**Resolution Steps**:
- Removed broken local MCP configuration using `claude mcp remove supabase -s local`
- Created proper `.mcp.json` file in project root with correct command/args structure
- Reset project choices to trigger approval workflow
- Documented that Claude CLI != Claude Desktop (different configuration systems)

**Key Differences**:
- **Claude CLI**: Uses `.mcp.json` files and `C:\Users\[USER]\.claude.json`
- **Claude Desktop**: Uses `%APPDATA%\Claude\claude_desktop_config.json`

**NEVER REVERT**: This fix resolves fundamental Claude CLI command parsing issue. Restart Claude CLI after configuration changes.

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

## MCP Server Configuration

**CRITICAL**: This project uses **Claude CLI**, NOT Claude Desktop. The configuration is completely different.

### For Claude CLI (This Project)

**1. Install MCP Server Package**:
```bash
npm install -g @supabase/mcp-server-supabase
```

**2. Project Configuration** - Create `.mcp.json` in project root:
```json
{
  "mcpServers": {
    "supabase": {
      "type": "stdio",
      "command": "cmd",
      "args": ["/c", "npx", "@supabase/mcp-server-supabase@latest"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your_supabase_access_token",
        "SUPABASE_PROJECT_REF": "your_supabase_project_ref"
      }
    }
  }
}
```

**3. Approve Project-Scoped Server**:
```bash
# Reset approval state if needed
claude mcp reset-project-choices

# Restart Claude CLI (exit and start again)
/exit
claude

# When prompted, approve the Supabase server
```

**4. Verify Configuration**:
```bash
claude mcp list
# Should show: supabase: ✓ Connected
```

### For Claude Desktop (Alternative Setup)

**Configuration Location**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["@supabase/mcp-server-supabase"],
      "env": {
        "SUPABASE_ACCESS_TOKEN": "your_token",
        "SUPABASE_PROJECT_REF": "your_ref"
      }
    }
  }
}
```

### Key Differences:
- **Claude CLI**: Uses `.mcp.json` in project + requires approval workflow
- **Claude Desktop**: Uses Windows AppData config + no approval needed
- **Command Format**: CLI requires `cmd /c` wrapper on Windows
- **Scope**: CLI supports project-scoped vs user-scoped servers

**Troubleshooting Claude CLI**:
- **Server not appearing**: Check if project approval is needed (`claude mcp reset-project-choices`)
- **Command parsing errors**: Use `.mcp.json` file instead of CLI commands for complex setups
- **Connection fails**: Restart Claude CLI completely after config changes
- **Permission denied**: Approve project-scoped servers when prompted

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
- `CHANGELOG.md` - Project change history and release notes
- `PLAN.md` - Product roadmap and upcoming features

## Change Documentation Guidelines

### REQUIRED: Document ALL Changes in CHANGELOG.md
When making ANY changes to the codebase, you MUST update `CHANGELOG.md` with:

1. **Clear categorization**:
   - **Added**: New features, components, or functionality
   - **Changed**: Modifications to existing features
   - **Fixed**: Bug fixes and issue resolutions
   - **Removed**: Deleted features or deprecated code
   - **Security**: Security-related changes

2. **Include specific details**:
   - File paths and component names affected
   - Brief description of the change and why
   - Commit hash for reference
   - Breaking changes or migration notes

3. **Use clear, descriptive language**:
   - Explain WHAT changed and WHY
   - Include impact on users or functionality
   - Reference related issues or requirements

### Example Changelog Entry Format:
```markdown
## [YYYY-MM-DD] - Feature/Fix Name

### Added
- **Feature Name**: Description of what was added
  - File: `path/to/file.tsx` - specific changes made
  - Impact: how this affects users/functionality
  - Commit: `abc1234`

### Fixed
- **Bug Name**: Description of issue that was fixed
  - Root Cause: explanation of the problem
  - Solution: how it was resolved
  - Files Modified: `component1.tsx`, `service2.ts`
  - Commit: `def5678`
```

### Changelog Maintenance Rules:
- Update IMMEDIATELY when making changes (don't batch)
- Always add new entries at the top (reverse chronological)
- Include version/date headers for major releases
- Cross-reference with git commits for traceability
- Maintain consistency with existing format and style

## Brand Guidelines

### Official Color Palette

**Primary Color:**
- `#CC3E26` - **Main Brand Red** (vibrant coral-red, energetic)
  - Use for: Primary CTAs, active states, brand elements, navigation highlights
  - Replaces: `bg-blue-600`, `text-blue-600`, `border-blue-600`

**Secondary Colors:**
- `#FAF6DB` - **Cream** (warm off-white for soft backgrounds)
  - Use for: Card backgrounds, light containers, subtle overlays
  - Replaces: `bg-gray-50`, `bg-white` (selectively)

- `#F4E911` - **Bright Yellow** (attention-grabbing highlights)
  - Use for: Key CTAs, success states, important badges, warnings
  - Replaces: `bg-green-600` for positive actions, selective accent usage

- `#d4cdc4` - **Light Gray-Beige** (neutral base elements)
  - Use for: Borders, inactive states, subtle backgrounds
  - Replaces: `bg-gray-200`, `border-gray-300`

- `#d5a12a` - **Gold/Amber** (warm accent color)
  - Use for: Secondary buttons, hover states, premium features
  - Complements main brand red for hierarchy

- `#787132` - **Olive Green** (earthy depth for secondary actions)
  - Use for: Secondary navigation, inactive buttons, muted text
  - Replaces: Some `text-gray-600` instances

- `#9b4e22` - **Brown/Rust** (grounding color for structure)
  - Use for: Borders, dividers, footer elements, text hierarchy
  - Replaces: `border-gray-400`, some `text-gray-700`

### Current vs Target Color Usage

**Current State:**
- Heavy reliance on blue-600 (`#2563eb`) and gray scale
- Limited color variety and warmth
- Generic, tech-focused appearance

**Target State:**
- Warm, approachable earth-tone palette
- Vibrant red (#CC3E26) as primary brand color
- Cream (#FAF6DB) for softer, welcoming backgrounds
- Strategic yellow (#F4E911) for key actions and highlights

### Implementation Priority

**High Priority Replacements:**
1. **All `bg-blue-600`** → `bg-[#CC3E26]` (primary buttons, active states)
2. **All `text-blue-600`** → `text-[#CC3E26]` (links, brand text)
3. **All `bg-gray-50`** → `bg-[#FAF6DB]` (card backgrounds, page backgrounds)
4. **All `border-blue-500`** → `border-[#CC3E26]` (focus states, active borders)

**Medium Priority:**
- `bg-green-600` → `bg-[#F4E911]` (success buttons, positive actions)
- `bg-gray-200` → `bg-[#d4cdc4]` (inactive elements)
- `text-gray-600` → `text-[#787132]` (secondary text, muted elements)

**Low Priority:**
- Fine-tune text hierarchy with brown/rust (#9b4e22)
- Add gold/amber (#d5a12a) for premium features and hover states

### Accessibility Notes

**Contrast Ratios (preliminary):**
- Red (#CC3E26) on Cream (#FAF6DB): Good contrast for text
- Yellow (#F4E911) on Red (#CC3E26): High contrast for CTAs
- Olive (#787132) on Cream (#FAF6DB): Adequate for secondary text
- Brown (#9b4e22) on Cream (#FAF6DB): Good for borders and structure

**Testing Required:**
- Verify all color combinations meet WCAG 2.1 AA standards
- Test with color blindness simulators
- Ensure sufficient contrast for mobile/tablet viewing

### Tailwind CSS Integration

**Custom Color Configuration (Future):**
```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'brand': {
          'primary': '#CC3E26',    // Main red
          'cream': '#FAF6DB',      // Secondary cream
          'yellow': '#F4E911',     // Bright yellow
          'beige': '#d4cdc4',      // Light gray-beige
          'gold': '#d5a12a',       // Gold/amber
          'olive': '#787132',      // Olive green
          'rust': '#9b4e22',       // Brown/rust
        }
      }
    }
  }
}
```

**CSS Variables (Alternative):**
```css
:root {
  --color-brand-primary: #CC3E26;
  --color-brand-cream: #FAF6DB;
  --color-brand-yellow: #F4E911;
  --color-brand-beige: #d4cdc4;
  --color-brand-gold: #d5a12a;
  --color-brand-olive: #787132;
  --color-brand-rust: #9b4e22;
}
```

### Design Philosophy

**Brand Personality:**
- **Warm & Approachable**: Earth tones create welcoming atmosphere
- **Professional & Reliable**: Structured color hierarchy
- **Creative & Vibrant**: Strategic use of bright accents
- **Photo-Focused**: Colors complement rather than compete with photos

**Visual Hierarchy:**
1. **Primary Action**: Red (#CC3E26) - immediate attention
2. **Secondary Action**: Gold/Amber (#d5a12a) - supportive actions
3. **Success/Positive**: Yellow (#F4E911) - completion, success
4. **Neutral/Background**: Cream (#FAF6DB) - content focus
5. **Muted/Inactive**: Olive/Brown (#787132, #9b4e22) - de-emphasized elements

**Implementation Guidelines:**
- Use red sparingly for maximum impact
- Cream backgrounds reduce eye strain for photo editing
- Yellow for critical actions only (save, export, confirm)
- Earth tones provide visual rest and professional appearance
- Maintain current spacing and typography - focus on color transformation