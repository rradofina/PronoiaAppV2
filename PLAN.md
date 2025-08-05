# PronoiaApp Development Plan

## Project Vision
PronoiaApp is a tablet-optimized photo studio application designed to streamline the process of organizing Google Drive photos into professional print templates. The app guides clients through selecting photos, choosing packages, and customizing templates for physical prints or digital delivery.

## Current State
The application currently supports:
- Google Drive integration for photo access
- Package-based template systems with admin configuration
- Session-based template customization (client changes don't affect admin settings)
- Multiple print sizes (4R, 5R, A4) with various template types
- Photo editing with auto-snap positioning
- Template rasterization and export

## Upcoming Features & Roadmap

### Phase 1: Print Summary & Photo Management Screen (Next Implementation)
After clients fill their print templates, they need a summary screen that handles photo limits and delivery options.

#### 1.1 Print Summary Screen
- **Location**: New component `components/screens/PrintSummaryScreen.tsx`
- **Features**:
  - Display all filled templates with photo counts
  - Show package photo limit vs. photos selected
  - Visual preview of all prints to be produced
  - Total cost calculation based on package pricing

#### 1.2 Photo Limit Management
- **Photo Filtering Interface**:
  - When photos exceed package limit, show warning
  - Allow clients to remove photos from favorites
  - Drag-and-drop interface to prioritize photos
  - "Smart suggestion" to remove duplicates or similar photos
  - Counter showing: "24 of 20 photos selected - please remove 4"

#### 1.3 Soft Copy Option
- **Implementation Strategy**:
  - Add checkbox: "Get all photos as soft copies (digital files)"
  - When checked, reveal email input field
  - Store preference in session: `include_soft_copies: boolean`
  - Add `soft_copy_email: string` to session data
  
- **UI Design**:
  ```typescript
  interface SoftCopyOption {
    enabled: boolean;
    email: string;
    includeEdited: boolean; // Include edited versions
    includeOriginal: boolean; // Include original photos
    deliveryFormat: 'google-drive' | 'download-link' | 'email-attachment';
  }
  ```

#### 1.4 Database Schema Updates
```sql
-- Add to sessions table
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS soft_copy_requested BOOLEAN DEFAULT false;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS soft_copy_email TEXT;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS soft_copy_delivery_status TEXT DEFAULT 'pending';
```

### Phase 2: Email Integration & Digital Delivery

#### 2.1 Email Service Integration
- **Options to Implement**:
  - SendGrid integration for transactional emails
  - Resend.com for modern email API
  - AWS SES for cost-effective delivery
  
- **Email Templates**:
  - Order confirmation with print previews
  - Soft copy delivery with download links
  - Session completion receipt

#### 2.2 Digital Delivery System
- **Google Drive Integration**:
  - Create client-specific folder in studio's Drive
  - Copy selected photos to client folder
  - Share folder with client email
  - Send notification with access link

- **Alternative: Direct Download**:
  - Generate temporary download links (24-48 hour expiry)
  - ZIP compression for bulk downloads
  - Progress tracking for large files

### Phase 3: Package Enhancement Features

#### 3.1 Dynamic Package Limits
- **Student/Event Packages**: Already support unlimited photos via `is_unlimited_photos` flag
- **Tiered Packages**: Different limits for different photo types
- **Add-on System**: Purchase additional photos beyond package limit

#### 3.2 Package Comparison
- Show side-by-side package features
- Highlight savings and benefits
- Upgrade prompts when approaching limits

### Phase 4: Advanced Features (Future)

#### 4.1 AI-Powered Enhancements
- Auto-select best photos based on quality/composition
- Face detection for balanced group photos
- Smart cropping suggestions

#### 4.2 Social Sharing
- Generate shareable preview links
- Instagram-ready exports
- WhatsApp integration for quick sharing

#### 4.3 Payment Integration
- Stripe/PayPal for online payments
- Package upgrades during session
- Deposit/balance tracking

## Technical Architecture Decisions

### State Management for New Features
```typescript
// Extend sessionStore.ts
interface SessionStore {
  // Existing fields...
  
  // Phase 1 additions
  photoSelections: PhotoSelection[];
  photoLimit: number;
  isUnlimitedPhotos: boolean;
  softCopyRequested: boolean;
  softCopyEmail: string;
  
  // Actions
  toggleSoftCopy: (enabled: boolean) => void;
  setSoftCopyEmail: (email: string) => void;
  removePhotoSelection: (photoId: string) => void;
  reorderPhotoSelections: (photoIds: string[]) => void;
}
```

### Component Structure
```
components/
  screens/
    PrintSummaryScreen.tsx       # Main summary screen
    PhotoLimitManager.tsx        # Handle photo limit logic
  
  modals/
    SoftCopyOptionsModal.tsx     # Soft copy configuration
    PhotoPriorityModal.tsx       # Reorder/remove photos
    
  widgets/
    PhotoLimitCounter.tsx        # Visual limit indicator
    SoftCopyCheckbox.tsx         # Styled checkbox component
```

### API Endpoints (New)
```typescript
// pages/api/session/
POST   /api/session/soft-copy     # Request soft copies
GET    /api/session/summary       # Get print summary
PUT    /api/session/photos        # Update photo selections
POST   /api/session/complete      # Finalize session
```

## Implementation Priority

1. **Immediate (This Week)**:
   - Print Summary Screen with basic layout
   - Photo limit counter and warnings
   - Soft copy checkbox and email input

2. **Short Term (Next 2 Weeks)**:
   - Photo filtering/removal interface
   - Email integration setup
   - Soft copy delivery system

3. **Medium Term (Next Month)**:
   - Package comparison features
   - Advanced photo management
   - Payment integration planning

4. **Long Term (Next Quarter)**:
   - AI enhancements
   - Social sharing features
   - Mobile app considerations

## Success Metrics
- **User Flow Completion**: 90%+ users complete full session
- **Photo Limit Compliance**: Smooth handling of limit exceeded scenarios
- **Soft Copy Adoption**: Track % of users requesting digital copies
- **Session Duration**: Optimize for 15-20 minute sessions
- **Error Rates**: < 1% session failures

## Notes & Considerations
- Maintain tablet-first design philosophy
- Ensure offline resilience for poor connections
- Consider batch operations for performance
- Plan for international expansion (multi-language)
- Keep accessibility standards (WCAG 2.1 AA)

---

*This plan is a living document and will be updated as features are implemented and new requirements emerge.*