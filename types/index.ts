// Updated: Types for the app.

// Core types used throughout the application
export type Screen = 'drive-setup' | 'folder-selection' | 'package' | 'template' | 'template-setup' | 'photos' | 'preview' | 'complete' | 'png-template-management' | 'template-folder-selection' | 'manual-template-manager' | 'manual-package-manager';

export interface DriveFolder {
  id: string;
  name: string;
  createdTime: string;
  mimeType?: string;
  parents?: string[];
}

export interface GoogleAuth {
  isSignedIn: boolean;
  userEmail: string | null;
}

export interface GoogleUserInfo {
  id: string;
  sub?: string;
  email: string;
  name: string;
  picture?: string;
  given_name?: string;
  family_name?: string;
  locale?: string;
}

export interface SupabaseUser {
  id: string;
  email: string;
  name: string | null;
  google_id: string;
  avatar_url: string | null;
  preferences?: {
    role?: 'user' | 'admin';
    [key: string]: any;
  };
  created_at: string;
  updated_at: string;
}

export interface Package {
  id: string;
  name: string;
  templateCount: number;
  price: number;
  description?: string;
}

// Legacy container-relative transform (for backward compatibility)
export interface ContainerTransform {
  scale: number;
  x: number;
  y: number;
}

// New photo-centric transform (preferred format)
export interface PhotoTransform {
  photoScale: number;    // Scale relative to photo's "fit" size (1.0 = fit perfectly in hole)
  photoCenterX: number;  // Center point as fraction of photo width (0.0 = left edge, 1.0 = right edge)
  photoCenterY: number;  // Center point as fraction of photo height (0.0 = top edge, 1.0 = bottom edge)
  version: 'photo-centric'; // Version marker to distinguish from legacy transforms
}

// Transform type guards and utilities
export function isPhotoTransform(transform: ContainerTransform | PhotoTransform | undefined): transform is PhotoTransform {
  return transform !== undefined && 'version' in transform && transform.version === 'photo-centric';
}

export function isContainerTransform(transform: ContainerTransform | PhotoTransform | undefined): transform is ContainerTransform {
  return transform !== undefined && !('version' in transform);
}

// Calculate zoom-aware bounds for photo center coordinates
// At 1x zoom: allows 0 to 1 (entire photo visible)
// At 2x zoom: allows -0.5 to 1.5 (can access all parts of enlarged photo)
// At 4x zoom: allows -1.5 to 2.5 (can access all parts of heavily enlarged photo)
export function getPhotoTransformBounds(photoScale: number): { min: number; max: number } {
  const halfExtraRange = (photoScale - 1) / 2;
  return {
    min: 0 - halfExtraRange,
    max: 1 + halfExtraRange
  };
}

// Create a photo-centric transform with zoom-aware bounds
export function createPhotoTransform(photoScale: number, photoCenterX: number, photoCenterY: number): PhotoTransform {
  const clampedScale = Math.max(0.01, Math.min(10, photoScale)); // Clamp scale
  const bounds = getPhotoTransformBounds(clampedScale);
  
  return {
    photoScale: clampedScale,
    photoCenterX: Math.max(bounds.min, Math.min(bounds.max, photoCenterX)), // Zoom-aware clamp
    photoCenterY: Math.max(bounds.min, Math.min(bounds.max, photoCenterY)), // Zoom-aware clamp
    version: 'photo-centric'
  };
}

// Migration utilities for legacy transforms
export function migrateContainerToPhotoTransform(
  containerTransform: ContainerTransform,
  photoWidth: number,
  photoHeight: number,
  holeWidth: number,
  holeHeight: number
): PhotoTransform {
  try {
    // This is a best-effort migration - we can't perfectly convert without knowing the original context
    // But we can make reasonable assumptions
    
    // Calculate the "fit" scale
    const fitScaleX = holeWidth / photoWidth;
    const fitScaleY = holeHeight / photoHeight;
    const fitScale = Math.min(fitScaleX, fitScaleY);
    
    // Estimate photo scale relative to fit
    const photoScale = containerTransform.scale / fitScale;
    
    // Estimate center point based on translation
    // This is approximate since we don't know the original container dimensions
    const photoCenterX = 0.5 - (containerTransform.x / holeWidth);
    const photoCenterY = 0.5 - (containerTransform.y / holeHeight);
    
    console.log('📈 Migrating container transform to photo-centric:', {
      original: containerTransform,
      estimated: { photoScale, photoCenterX, photoCenterY },
      context: { photoWidth, photoHeight, holeWidth, holeHeight, fitScale }
    });
    
    return createPhotoTransform(photoScale, photoCenterX, photoCenterY);
  } catch (error) {
    console.error('🚨 Migration error - using default photo transform:', error);
    return createPhotoTransform(1, 0.5, 0.5);
  }
}

// Check if migration is needed for a template slot
export function needsMigration(slot: TemplateSlot): boolean {
  return slot.transform !== undefined && isContainerTransform(slot.transform);
}

// Migrate a single template slot
export function migrateTemplateSlot(
  slot: TemplateSlot,
  photoWidth: number,
  photoHeight: number,
  holeWidth: number,
  holeHeight: number
): TemplateSlot {
  if (!needsMigration(slot)) {
    return slot; // Already migrated or no transform
  }
  
  const migratedTransform = migrateContainerToPhotoTransform(
    slot.transform as ContainerTransform,
    photoWidth,
    photoHeight,
    holeWidth,
    holeHeight
  );
  
  return {
    ...slot,
    transform: migratedTransform
  };
}

export interface TemplateSlot {
  id: string;
  templateId: string;
  templateName: string;
  templateType: TemplateType;
  printSize?: '4R' | '5R' | 'A4';
  slotIndex: number;
  photoId?: string;
  transform?: ContainerTransform | PhotoTransform; // Support both formats
  label?: string;
}

// Legacy PhotoStudioPackage removed - now using manual packages

export interface Template {
  id: string;
  type: TemplateType;
  name: string;
  photoSlots: PhotoSlot[];
  dimensions: {
    width: number;
    height: number;
  };
  layout: TemplateLayout;
  createdAt: Date;
  updatedAt: Date;
}

export interface PhotoSlot {
  id: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  photo?: Photo;
  photoTransform?: {
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation?: number;
  };
  index: number;
  label?: string;
}

export interface Photo {
  id: string;
  url: string;
  thumbnailUrl: string;
  name: string;
  mimeType: string;
  size: number;
  googleDriveId: string;
  webContentLink: string;
  webViewLink: string;
  createdTime: string;
  modifiedTime: string;
  metadata?: {
    width?: number;
    height?: number;
    aspectRatio?: number;
  };
}

export type TemplateType = 'solo' | 'collage' | 'photocard' | 'photostrip';

export interface TemplateTypeInfo {
  id: TemplateType;
  name: string;
  description: string;
  icon: string;
  preview: string;
  slots: number;
}

export interface TemplateLayout {
  type: TemplateType;
  slots: {
    count: number;
    arrangement: 'single' | 'grid' | 'strip';
    spacing: number;
    padding: number;
  };
}

export interface Session {
  id: string;
  clientName: string;
  package_id: string; // Updated to use manual package UUID
  selectedTemplates: Template[];
  maxTemplates: number;
  usedTemplates: number;
  googleDriveFolderId: string;
  outputFolderId?: string;
  createdAt: Date;
  updatedAt: Date;
  isCompleted: boolean;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  webContentLink: string;
  webViewLink: string;
  thumbnailLink?: string;
  createdTime: string;
  modifiedTime: string;
  parents: string[];
}

// Alias for backward compatibility - use DriveFolder instead
export type GoogleDriveFolder = DriveFolder & {
  files?: GoogleDriveFile[];
  folders?: GoogleDriveFolder[];
}

export interface TemplateGenerationOptions {
  format: 'jpg' | 'png' | 'pdf';
  quality: number;
  dpi: number;
  dimensions: {
    width: number;
    height: number;
  };
  backgroundColor?: string;
  compression?: boolean;
}

export interface AppState {
  session: Session | null;
  photos: Photo[];
  templates: Template[];
  selectedTemplate: Template | null;
  isLoading: boolean;
  error: string | null;
  googleDriveConnected: boolean;
  currentStep: 'package' | 'template' | 'photos' | 'preview' | 'complete';
}

export interface TouchGesture {
  type: 'tap' | 'swipe' | 'pinch' | 'drag';
  position: {
    x: number;
    y: number;
  };
  direction?: 'up' | 'down' | 'left' | 'right';
  distance?: number;
  scale?: number;
}

export interface UIState {
  showPhotoSelector: boolean;
  showTemplatePreview: boolean;
  showProgressBar: boolean;
  selectedPhotoSlot: PhotoSlot | null;
  viewMode: 'grid' | 'list';
  sortBy: 'name' | 'date' | 'size';
  sortOrder: 'asc' | 'desc';
}

export interface GeneratedTemplate {
  id: string;
  templateId: string;
  templateType: TemplateType;
  fileName: string;
  fileUrl: string;
  googleDriveId: string;
  dimensions: {
    width: number;
    height: number;
  };
  generatedAt: Date;
  photos: Photo[];
}

export interface ExportSummary {
  sessionId: string;
  clientName: string;
  package_id: string; // Updated to use manual package UUID
  generatedTemplates: GeneratedTemplate[];
  totalPhotosUsed: number;
  uniquePhotosUsed: number;
  photoUsageMap: Record<string, number>;
  outputFolderId: string;
  exportedAt: Date;
}

export interface ErrorInfo {
  code: string;
  message: string;
  details?: any;
  timestamp: Date;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

// Custom Template System Types
export type PrintSize = '4R' | '5R' | 'A4';
export type PrintOrientation = 'portrait' | 'landscape';

export interface CustomPhotoSlot {
  id: string;
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  aspect_ratio?: string;
  photo_id?: string;
  transform?: {
    scale: number;
    offsetX: number;
    offsetY: number;
    rotation?: number;
  };
}

export interface CustomTemplateLayout {
  type: string;
  padding: number;
  spacing: number;
  arrangement: 'single' | 'grid' | 'strip' | 'custom';
  rows?: number;
  columns?: number;
}

export interface PrintDimensions {
  width: number;
  height: number;
  dpi: number;
  unit?: 'px' | 'in' | 'mm';
}

export interface CustomTemplate {
  id: string;
  name: string;
  description?: string;
  print_size: PrintSize;
  orientation: PrintOrientation;
  layout_data: CustomTemplateLayout;
  photo_slots: CustomPhotoSlot[];
  dimensions: PrintDimensions;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
  background_color?: string;
  created_by?: string;
  category?: string;
  tags?: string[];
  is_active: boolean;
  is_default: boolean;
  sort_order?: number;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  sort_order?: number;
  created_at: Date;
}

export interface PrintSizeConfig {
  name: PrintSize;
  label: string;
  dimensions: {
    width: number;
    height: number;
    dpi: number;
    inches: {
      width: number;
      height: number;
    };
  };
  description: string;
  is_custom_layouts: boolean; // true for 4R, false for 5R/A4
}

export interface TemplateCacheData {
  drive_file_id: string;
  name: string;
  print_size: string;
  template_type: string;
  holes: {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }[];
  png_url: string;
  dimensions: {
    width: number;
    height: number;
  };
  has_internal_branding: boolean;
} 

// Manual Template/Package System Types
export interface ManualTemplateHole {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ManualTemplateDimensions {
  width: number;
  height: number;
}

export interface ManualTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: TemplateType;
  print_size: PrintSize;
  drive_file_id: string;
  holes_data: ManualTemplateHole[];
  dimensions: ManualTemplateDimensions;
  thumbnail_url?: string;
  sample_image_url?: string; // Sample image showing template filled with photos
  base64_preview?: string; // Base64-encoded small preview for instant loading
  category_id?: string;
  created_by?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface PackageGroup {
  id: string;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Populated via joins
  packages?: ManualPackage[];
}

export interface ManualPackage {
  id: string;
  name: string;
  description?: string;
  thumbnail_url?: string;
  print_size: PrintSize;
  template_count: number;
  price?: number;
  photo_limit: number; // Maximum number of photos client can select
  is_unlimited_photos: boolean; // When true, ignores photo_limit and allows unlimited photos
  is_active: boolean;
  is_default: boolean;
  sort_order: number;
  group_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Populated via joins
  templates?: ManualTemplate[];
  group?: PackageGroup;
}

export interface PackageTemplate {
  id: string;
  package_id: string;
  template_id: string;
  order_index: number;
  created_at: string;
  // Populated via joins
  template?: ManualTemplate;
}

export interface ManualTemplateCategory {
  id: string;
  name: string;
  description?: string;
  color: string;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

// API Response types
export interface ManualPackageWithTemplates extends ManualPackage {
  package_templates: (PackageTemplate & { template: ManualTemplate })[];
}

export interface CreateManualTemplateRequest {
  name: string;
  description?: string;
  template_type: TemplateType;
  print_size: PrintSize;
  drive_file_id: string;
  holes_data: ManualTemplateHole[];
  dimensions: ManualTemplateDimensions;
  thumbnail_url?: string;
  sample_image_url?: string; // Sample image showing template filled with photos
  base64_preview?: string; // Base64-encoded small preview for instant loading
  category_id?: string;
}

export interface CreateManualPackageRequest {
  name: string;
  description?: string;
  thumbnail_url?: string;
  print_size: PrintSize;
  template_count: number;
  price?: number;
  photo_limit: number; // Maximum number of photos client can select
  is_unlimited_photos: boolean; // When true, ignores photo_limit and allows unlimited photos
  group_id?: string;
  template_ids: string[]; // Templates to include in package
}

export interface CreatePackageGroupRequest {
  name: string;
  description?: string;
  sort_order?: number;
}

// Service layer types
export interface ManualTemplateService {
  getAllTemplates(): Promise<ManualTemplate[]>;
  getTemplatesByPrintSize(printSize: PrintSize): Promise<ManualTemplate[]>;
  getTemplate(id: string): Promise<ManualTemplate | null>;
  createTemplate(template: CreateManualTemplateRequest): Promise<ManualTemplate>;
  updateTemplate(id: string, updates: Partial<ManualTemplate>): Promise<ManualTemplate>;
  deleteTemplate(id: string): Promise<void>;
  getActiveTemplates(): Promise<ManualTemplate[]>;
}

export interface ManualPackageService {
  getAllPackages(): Promise<ManualPackage[]>;
  getActivePackages(): Promise<ManualPackage[]>;
  getPackageWithTemplates(id: string): Promise<ManualPackageWithTemplates | null>;
  createPackage(packageData: CreateManualPackageRequest): Promise<ManualPackage>;
  updatePackage(id: string, updates: Partial<ManualPackage>): Promise<ManualPackage>;
  deletePackage(id: string): Promise<void>;
  getPackagesByPrintSize(printSize: PrintSize): Promise<ManualPackage[]>;
}

// Template Export System Types
export interface ExportedTemplateHole {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ExportedTemplateDimensions {
  width: number;
  height: number;
}

export interface ExportedTemplate {
  // Core Template Data
  id: string;
  name: string;
  templateType: TemplateType;
  printSize: PrintSize;
  
  // PNG File Data
  pngUrl?: string;
  driveFileId?: string;
  base64Data?: string; // For offline use
  
  // Configuration Data
  holes: ExportedTemplateHole[];
  dimensions: ExportedTemplateDimensions;
  
  // Metadata
  hasInternalBranding?: boolean;
  createdAt: Date;
  lastUpdated: Date;
  source: 'auto-detected' | 'manual';
  
  // Additional Manual Template Data (if applicable)
  description?: string;
  categoryId?: string;
  thumbnailUrl?: string;
  sampleImageUrl?: string;
  isActive?: boolean;
  
  // Export-specific metadata
  exportedAt: Date;
  exportVersion: string;
}

export interface TemplateExportMetadata {
  exportId: string;
  exportedAt: Date;
  exportVersion: string;
  totalTemplates: number;
  templateSources: ('auto-detected' | 'manual')[];
  filters?: {
    templateType?: TemplateType;
    printSize?: PrintSize;
    source?: 'auto-detected' | 'manual';
  };
  includesPngFiles: boolean;
  includesBase64Data: boolean;
}

export interface TemplateExportPackage {
  metadata: TemplateExportMetadata;
  templates: ExportedTemplate[];
  categories?: TemplateCategory[]; // If manual templates with categories
}

export interface TemplateImportResult {
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: Array<{
    templateId: string;
    templateName: string;
    error: string;
  }>;
  duplicates: Array<{
    templateId: string;
    templateName: string;
    action: 'skipped' | 'updated' | 'renamed';
  }>;
}

export interface TemplateExportOptions {
  format: 'json' | 'zip';
  includePngFiles: boolean;
  includeBase64Data: boolean;
  templateTypes?: TemplateType[];
  printSizes?: PrintSize[];
  sources?: ('auto-detected' | 'manual')[];
  activeOnly?: boolean;
  filters?: {
    templateType?: TemplateType;
    printSize?: PrintSize;
    source?: 'auto-detected' | 'manual';
  };
}

export interface TemplateExportService {
  exportSingleTemplate(id: string, options?: Partial<TemplateExportOptions>): Promise<Blob>;
  exportTemplatesByType(type: TemplateType, options?: Partial<TemplateExportOptions>): Promise<Blob>;
  exportTemplatesBySize(size: PrintSize, options?: Partial<TemplateExportOptions>): Promise<Blob>;
  exportAllTemplates(options?: Partial<TemplateExportOptions>): Promise<Blob>;
  exportToJSON(templates: ExportedTemplate[]): Promise<string>;
  importFromExport(file: File): Promise<TemplateImportResult>;
  validateExportFile(file: File): Promise<{ valid: boolean; errors: string[] }>;
}