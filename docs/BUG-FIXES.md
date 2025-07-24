# Critical Bug Fixes - PronoiaApp

This document contains detailed information about critical bugs and their fixes. **DO NOT REVERT THESE FIXES**.

## 1. Photo Loading CORS Issue

### Problem
Photos in PhotoSelectionScreen showed filenames but no images due to CORS blocking: `net::ERR_BLOCKED_BY_RESPONSE.NotSameOriginAfterDefaultedToSameOriginByCoep`

### Solution
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

## 2. PNG Template Images Not Displaying

### Problem
PNG template backgrounds (with studio logos) were not showing in the template bar - only empty gray placeholders were visible.

### Solution
**File: `components/PngTemplateVisual.tsx`**

Extract file ID from Google Drive sharing URL and use googleusercontent.com format:

```typescript
const fileId = pngTemplate.drive_file_id?.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
const pngUrl = pngTemplate.pngUrl || 
               pngTemplate.thumbnail_url || 
               pngTemplate.base64_preview ||
               (fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : null);
```

**URL Transformation:**
- Input: `https://drive.google.com/file/d/14HdljMAb-qEXmVkweDK8JczAc8P4LQvU/view?usp=sharing`
- Working URL: `https://lh3.googleusercontent.com/d/14HdljMAb-qEXmVkweDK8JczAc8P4LQvU`

## 3. Photo Cropping in FullscreenTemplateEditor

### Problem
Photos with different aspect ratios were automatically cropped to match slot dimensions, losing image content.

### Solution
**File: `components/FullscreenTemplateEditor.tsx`**

**BEFORE (Broken):**
```tsx
<img style={{ 
  width: '100%',
  height: '100%', 
  objectFit: 'cover'  // ← Automatically cropped photos
}}/>
```

**AFTER (Fixed):**
```tsx
<img style={{ 
  maxWidth: 'none',
  maxHeight: 'none',
  width: 'auto',
  height: 'auto',
  display: 'block'
}}/>

<TransformWrapper initialScale={0.5}>  // ← Start zoomed out to show full photo
```

### How It Works
- Photo keeps natural dimensions
- Slot container acts as viewport window with `overflow: hidden`
- Users see complete photo first, then zoom/pan to choose visible area
- No automatic cropping - all photo content preserved

## 4. Template Hole Positioning Issue

### Problem
Photo placeholders appeared square instead of rectangular and were misaligned with PNG template holes.

### Solution
**File: `components/FullscreenTemplateEditor.tsx`**

**BEFORE (Broken):**
```tsx
<div className="relative w-full h-full max-w-[90vw] max-h-[85vh]">
  <img className="w-full h-full object-contain" />
```

**AFTER (Fixed):**
```tsx
<div className="relative" 
     style={{ 
       aspectRatio: `${pngTemplate.dimensions.width}/${pngTemplate.dimensions.height}`,
       width: '800px',
       height: 'auto'
     }}>
  <img className="w-full h-full" />
```

### Key Changes
1. Fixed width container (800px) instead of viewport-based sizing
2. Auto height with `aspectRatio` CSS property for precise scaling
3. Removed `object-contain` to eliminate letterboxing
4. Percentage positioning now works correctly because image fills container exactly

## Photo Transform System Challenge

### Current Issue
Transform values from large editor canvas don't work on small template previews because they're absolute pixel values but containers are different sizes.

### Solution Strategy
Convert transforms to percentage-based:

```typescript
const relativeTransform = {
  scale: transform.scale, // Scale stays the same
  x: (transform.x / originalContainerWidth) * 100,  // Convert to %
  y: (transform.y / originalContainerHeight) * 100  // Convert to %
}
```

This ensures consistent framing from editor → preview → final output.