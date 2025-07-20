// Updated: Types for the app.

// Core types used throughout the application
export type Screen = 'drive-setup' | 'folder-selection' | 'package' | 'template' | 'photos' | 'preview' | 'complete';

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

export interface PhotoStudioPackage {
  id: 'A' | 'B' | 'C' | 'D';
  name: string;
  templateCount: number;
  price?: number;
  description?: string;
}

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
  packageType: PhotoStudioPackage['id'];
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
  packageType: PhotoStudioPackage['id'];
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