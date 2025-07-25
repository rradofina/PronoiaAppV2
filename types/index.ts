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

export interface TemplateSlot {
  id: string;
  templateId: string;
  templateName: string;
  templateType: TemplateType;
  printSize?: '4R' | '5R' | 'A4';
  slotIndex: number;
  photoId?: string;
  transform?: {
    scale: number;
    x: number;
    y: number;
  };
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