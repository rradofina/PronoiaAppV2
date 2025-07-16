// Updated: Types for the app.

// Core types used throughout the application
export type Screen = 'drive-setup' | 'folder-selection' | 'package' | 'template' | 'photos' | 'preview' | 'complete';

export interface DriveFolder {
  id: string;
  name: string;
  createdTime: string;
}

export interface GoogleAuth {
  isSignedIn: boolean;
  userEmail: string | null;
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

export interface GoogleDriveFolder {
  id: string;
  name: string;
  files: GoogleDriveFile[];
  folders: GoogleDriveFolder[];
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