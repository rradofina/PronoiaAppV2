# Manual Template/Package System - PronoiaApp

## Overview

The Manual Template/Package System is a major enhancement that provides reliable, admin-controlled template management, replacing the problematic auto-detection system with precise manual configuration.

## Problem Solved

The original auto-detection system for PNG templates was unreliable:
- Complex template matching logic caused photocard templates to show for other types
- Inconsistent hole detection and positioning  
- No admin control over template availability or configuration
- Difficult to debug and maintain template issues

## Solution: Gradual Migration Architecture

### Hybrid System Approach
Implemented a **hybrid system** allowing gradual migration from auto-detection to manual configuration:

**Phase 1: Hybrid Coexistence**
- Manual templates take precedence over auto-detected ones
- Auto-detection continues working for templates not yet manually configured
- Zero breaking changes to existing functionality

**Phase 2: Complete Migration** (Future)
- Eventually disable auto-detection entirely
- Full admin control over all templates and packages
- Reliable, predictable template behavior

## Database Schema

### New Tables
**Migration File**: `lib/supabase/migrations/006_manual_template_system.sql`

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

### Key Features
- **Row Level Security (RLS)** policies for data protection
- **Unique constraints** on drive_file_id and package-template relationships
- **Audit trails** with created_at/updated_at timestamps
- **Indexing** for performance on active templates and print sizes

## Service Layer Architecture

### New Services

#### `services/manualTemplateService.ts`
- Full CRUD operations for manual templates
- Caching system (5-minute duration) for performance
- Bulk import from auto-detection system
- Search, filtering, and activation controls
- Statistics and template management

#### `services/manualPackageService.ts`
- Package CRUD operations with template associations
- Package-template relationship management (add/remove/reorder)
- Default package designation per print size
- Template counting and validation

#### `services/hybridTemplateService.ts`
- **Core Innovation**: Combines manual and auto-detected templates
- **Precedence Rule**: Manual templates override auto-detected ones with same drive_file_id
- **Unified Interface**: Single API for accessing all templates regardless of source
- **Migration Tools**: Analysis and recommendations for converting auto to manual

## Admin Interface System

### Navigation Flow
```
PNG Template Management → Manual Templates → Package Manager
```

### Manual Template Manager
**File**: `components/admin/ManualTemplateManagerScreen.tsx`

**Features:**
- Create/edit templates with precise hole positioning and dimensions
- JSON editors for holes_data and dimensions configuration
- Import functionality to convert auto-detected templates to manual
- Template activation/deactivation controls
- Bulk operations and template statistics

### Manual Package Manager  
**File**: `components/admin/ManualPackageManagerScreen.tsx`

**Features:**
- Create packages by selecting from available manual templates
- Print size organization (4R, 5R, A4) with filtering
- Package pricing, descriptions, and thumbnail support
- Default package designation per print size
- Template selection interface with checkbox management
- Package details modal showing associated templates

## Technical Implementation

### Hybrid Template Loading
```typescript
// Manual templates take precedence over auto-detected ones
const hybridTemplates = [...manualTemplates, ...filteredAutoTemplates];

// Filter out auto-detected templates that have manual overrides
const manualDriveFileIds = new Set(manualTemplates.map(t => t.drive_file_id));
const filteredAuto = autoTemplates.filter(autoTemplate => 
  !manualDriveFileIds.has(autoTemplate.drive_file_id)
);
```

### Template Data Structure
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

## Migration Strategy Benefits

1. **Zero Downtime**: Existing auto-detection continues working
2. **Gradual Transition**: Convert templates one-by-one as needed
3. **Admin Control**: Precise configuration of template behavior
4. **Reliability**: Eliminates complex template matching logic
5. **Maintainability**: Database-driven instead of algorithmic detection
6. **Scalability**: Easy to add new templates without code changes

## Development Workflow

### Creating Manual Templates
1. Navigate to PNG Templates → Manual Templates
2. Use "Import from Auto-Detection" to convert existing templates
3. Or create new templates with precise hole positions and dimensions
4. Edit template properties (name, description, type, print size)
5. Activate templates to make them available in the main application

### Managing Packages
1. Navigate to Manual Templates → Package Manager
2. Create packages by selecting templates for specific print sizes
3. Set package properties (name, description, pricing)
4. Designate default packages per print size
5. Reorder templates within packages as needed

### Integration Points
- Templates from `hybridTemplateService` are used throughout the main application
- Manual templates automatically override auto-detected ones with matching drive_file_id
- Package configuration affects template availability in client sessions
- Admin changes are immediately reflected in the main application (cache refresh)

## Hole Detection Algorithm

### Overview
The hole detection system uses computer vision techniques to automatically detect photo placeholder areas in PNG template files by scanning for **magenta-colored regions** (`#FF00FF`).

### Core Algorithm Components

#### 1. Magenta Color Detection System
```typescript
// Supported magenta colors with tolerance for compression artifacts
private static readonly PLACEHOLDER_COLORS = [
  [255, 0, 255], // #FF00FF - Pure magenta
  [185, 82, 159] // #b9529f - Photoshop CMYK-converted magenta
];
private static readonly COLOR_TOLERANCE = 15;
```

#### 2. Flood Fill Algorithm
Uses a **flood fill algorithm** to find connected placeholder regions:

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
    
    // Add 4-connected neighbors to stack
    stack.push(
      { x: x + 1, y }, { x: x - 1, y },
      { x, y: y + 1 }, { x, y: y - 1 }
    );
  }
  
  return bounds;
}
```

#### 3. Precise Boundary Detection
After flood fill finds rough bounds, performs **pixel-perfect boundary detection**:

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

### Data Structures

#### TemplateHole Interface
```typescript
export interface TemplateHole {
  id: string;           // "hole_1", "hole_2", etc.
  x: number;           // Left edge pixel coordinate
  y: number;           // Top edge pixel coordinate  
  width: number;       // Width in pixels
  height: number;      // Height in pixels
}
```

#### TemplateAnalysisResult Interface  
```typescript
export interface TemplateAnalysisResult {
  holes: TemplateHole[];                    // Detected photo areas
  dimensions: { width: number; height: number }; // Template dimensions
  hasInternalBranding: boolean;             // Whether text is inside photo areas
  templateType: 'solo' | 'collage' | 'photocard' | 'photostrip'; // Inferred type
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

### Usage in Manual Template Workflow

When creating manual templates, the hole detection system:
1. **Auto-detects holes** from PNG template files uploaded to Google Drive
2. **Displays hole count** in template preview cards with overlay badges
3. **Validates hole positioning** before saving to database
4. **Provides feedback** to admin users about detection results

This sophisticated hole detection system eliminates the need for manual coordinate entry and enables designers to create templates using familiar magenta placeholder regions in their design software.