// Updated: Types for the app.

import { templateConfigService } from '../services/templateConfigService';
import { googleDriveService } from '../services/googleDriveService';

// Helper function to get real photo dimensions from Google Drive API
async function getRealPhotoDimensions(photo: Photo): Promise<{ width: number; height: number }> {
  try {
    console.log('🔍 FETCHING REAL DIMENSIONS from Google Drive API...');
    const metadata = await googleDriveService.getPhotoMetadata(photo.googleDriveId);
    
    if (metadata && metadata.imageMediaMetadata) {
      const { width, height } = metadata.imageMediaMetadata;
      console.log('✅ GOOGLE DRIVE API SUCCESS:', { width, height });
      return { width: parseInt(width), height: parseInt(height) };
    } else {
      throw new Error('No imageMediaMetadata in API response');
    }
  } catch (error) {
    console.warn('❌ Google Drive API failed, trying image loading fallback:', error);
    
    // Fallback: Try to load image (will get thumbnail dimensions)
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        console.log('📷 IMAGE LOADING FALLBACK:', { width: img.naturalWidth, height: img.naturalHeight });
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = (imgError) => {
        reject(new Error(`Failed to load image: ${imgError}`));
      };
      img.src = photo.url;
    });
  }
}

// Core types used throughout the application
export type Screen = 'drive-setup' | 'folder-selection' | 'package' | 'template' | 'template-setup' | 'photos' | 'preview' | 'complete' | 'png-template-management' | 'template-folder-selection' | 'manual-template-manager' | 'manual-package-manager' | 'admin-settings';

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
// Allow free movement at all zoom levels for full user control
export function getPhotoTransformBounds(photoScale: number): { min: number; max: number } {
  // Allow effectively unlimited movement for all zoom levels
  // This gives users complete freedom to position photos as they wish
  return {
    min: -10,  // Effectively no limit
    max: 10    // Effectively no limit
  };
}

// Calculate smart scale with "2-sides only excess" logic for initial photo placement
export function calculateProperScale(
  photoWidth: number, 
  photoHeight: number, 
  containerWidth: number, 
  containerHeight: number, 
  fillSlot: boolean = true
): number {
  if (photoWidth === 0 || photoHeight === 0 || containerWidth === 0 || containerHeight === 0) {
    return 1.0; // Fallback scale
  }
  
  // Calculate scaling to fit/fill the slot - same logic as templateGenerationService
  const scaleX = containerWidth / photoWidth;
  const scaleY = containerHeight / photoHeight;
  
  if (fillSlot) {
    // Fill the entire area (crop if necessary) - COVER behavior
    return Math.max(scaleX, scaleY);
  } else {
    // Fit within the slot (letterbox if necessary) - CONTAIN behavior
    return Math.min(scaleX, scaleY);
  }
}

// Smart scaling for initial photo placement - shows WHOLE photo with NO gaps, excess on only 2 sides
// Returns adjustment factor on top of object-fit: 'contain' baseline
export function calculateSmartFillScale(
  photoWidth: number,
  photoHeight: number,
  containerWidth: number,
  containerHeight: number
): number {
  if (photoWidth === 0 || photoHeight === 0 || containerWidth === 0 || containerHeight === 0) {
    return 1.0; // Fallback scale
  }
  
  // Calculate aspect ratios to determine scaling strategy
  const photoAspectRatio = photoWidth / photoHeight;
  const containerAspectRatio = containerWidth / containerHeight;
  
  // Step 1: Calculate CSS object-fit: 'contain' baseline scale
  // This is how CSS would scale the photo to fit within container
  const containScale = Math.min(
    containerWidth / photoWidth,   // Scale to fit width
    containerHeight / photoHeight  // Scale to fit height
  );
  
  // Step 2: Calculate gap elimination scale 
  // This is the scale needed to eliminate all gaps
  let gapEliminationScale: number;
  let scalingStrategy: string;
  let excessDirection: string;
  
  if (photoAspectRatio < containerAspectRatio) {
    // Photo is taller than container (portrait in landscape container)
    // Need to scale to fit WIDTH completely to eliminate gaps
    gapEliminationScale = containerWidth / photoWidth;
    scalingStrategy = 'FIT_WIDTH';
    excessDirection = 'TOP/BOTTOM';
  } else {
    // Photo is wider than container (landscape in portrait container) 
    // Need to scale to fit HEIGHT completely to eliminate gaps
    gapEliminationScale = containerHeight / photoHeight;
    scalingStrategy = 'FIT_HEIGHT';
    excessDirection = 'LEFT/RIGHT';
  }
  
  // Step 3: Calculate adjustment factor
  // This is how much additional scaling we need on top of 'contain' baseline
  const adjustmentFactor = gapEliminationScale / containScale;
  
  console.log('🎯 Smart Fill Scale (CONTAIN BASELINE + ADJUSTMENT):', {
    photo: { width: photoWidth, height: photoHeight, aspectRatio: photoAspectRatio.toFixed(3) },
    container: { width: containerWidth, height: containerHeight, aspectRatio: containerAspectRatio.toFixed(3) },
    baseline: {
      containScale: containScale.toFixed(3),
      note: 'CSS object-fit: contain handles this automatically'
    },
    gapElimination: {
      strategy: scalingStrategy,
      gapEliminationScale: gapEliminationScale.toFixed(3),
      excessDirection,
      logic: photoAspectRatio < containerAspectRatio ? 'Photo taller → fit width' : 'Photo wider → fit height'
    },
    result: {
      adjustmentFactor: adjustmentFactor.toFixed(3),
      finalVisualScale: (containScale * adjustmentFactor).toFixed(3),
      note: 'CSS applies: contain baseline × adjustment factor'
    }
  });
  
  return adjustmentFactor;
}

// Legacy function for backwards compatibility - now uses proper scaling
export function calculateContainScale(photoAspectRatio: number, containerAspectRatio: number): number {
  // Convert aspect ratios to dimensions for proper calculation
  // Assume a standard container size for calculation
  const containerWidth = 400;
  const containerHeight = 400;
  const photoWidth = photoAspectRatio * 400;
  const photoHeight = 400;
  
  // Use COVER behavior (fill) as default for backwards compatibility
  return calculateProperScale(photoWidth, photoHeight, containerWidth, containerHeight, true);
}

// Legacy function for backwards compatibility
export function calculateCoverScale(photoAspectRatio: number, containerAspectRatio: number): number {
  return calculateContainScale(photoAspectRatio, containerAspectRatio);
}

// Create a photo-centric transform with smart initial scale for object-fit: contain
export function createPhotoTransformWithContain(
  photoAspectRatio: number, 
  containerAspectRatio: number, 
  photoCenterX: number = 0.5, 
  photoCenterY: number = 0.5
): PhotoTransform {
  const containScale = calculateContainScale(photoAspectRatio, containerAspectRatio);
  return createPhotoTransform(containScale, photoCenterX, photoCenterY);
}

// Legacy function for backwards compatibility
export function createPhotoTransformWithCover(
  photoAspectRatio: number, 
  containerAspectRatio: number, 
  photoCenterX: number = 0.5, 
  photoCenterY: number = 0.5
): PhotoTransform {
  return createPhotoTransformWithContain(photoAspectRatio, containerAspectRatio, photoCenterX, photoCenterY);
}

// Helper to get photo aspect ratio from Photo object
export function getPhotoAspectRatio(photo: Photo): number {
  // Try to get from metadata first
  if (photo.metadata?.aspectRatio) {
    return photo.metadata.aspectRatio;
  }
  
  // Try to calculate from width/height
  if (photo.metadata?.width && photo.metadata?.height) {
    return photo.metadata.width / photo.metadata.height;
  }
  
  // Default assumption for photos (most photos are 4:3 or 3:2)
  return 4 / 3;
}

// Helper to get hole dimensions from TemplateSlot
export function getHoleDimensions(slot: TemplateSlot): { width: number; height: number } | null {
  try {
    // Get PNG templates from global window object (same way as components do)
    const pngTemplates = (window as any).pngTemplates || [];
    
    console.log('🔍 RAW DATABASE DATA DEBUG:', {
      totalPngTemplates: pngTemplates.length,
      lookingFor: { templateType: slot.templateType, printSize: slot.printSize, slotIndex: slot.slotIndex },
      availableTemplates: pngTemplates.map((t: any) => ({ 
        template_type: t.template_type, 
        print_size: t.print_size,
        holes: t.holes?.length || 0 
      }))
    });
    
    // Find the template that matches this slot (templateType now contains the unique template ID)
    const pngTemplate = pngTemplates.find((t: any) => {
      return t.id.toString() === slot.templateType;
    });
    
    if (!pngTemplate || !pngTemplate.holes) {
      console.warn('🔍 No PNG template found for slot:', { 
        templateType: slot.templateType, 
        printSize: slot.printSize,
        availableTypes: pngTemplates.map((t: any) => t.template_type),
        availableSizes: pngTemplates.map((t: any) => t.print_size)
      });
      return null;
    }
    
    console.log('🕳️ FOUND TEMPLATE WITH HOLES:', {
      templateType: pngTemplate.template_type,
      printSize: pngTemplate.print_size,
      totalHoles: pngTemplate.holes.length,
      requestedIndex: slot.slotIndex,
      allHoles: pngTemplate.holes.map((h: any, i: number) => ({
        index: i,
        dimensions: { width: h.width, height: h.height },
        position: { x: h.x, y: h.y }
      }))
    });
    
    // Get the hole data for this slot index
    const hole = pngTemplate.holes[slot.slotIndex];
    if (!hole) {
      console.warn('🔍 No hole found at index:', {
        slotIndex: slot.slotIndex,
        availableIndices: pngTemplate.holes.map((_: any, i: number) => i),
        totalHoles: pngTemplate.holes.length
      });
      return null;
    }
    
    console.log('✅ HOLE DIMENSIONS EXTRACTED:', {
      slotIndex: slot.slotIndex,
      holeDimensions: { width: hole.width, height: hole.height },
      rawHoleData: hole
    });
    
    return { width: hole.width, height: hole.height };
  } catch (error) {
    console.warn('🔍 Error getting hole dimensions:', error);
    return null;
  }
}

// Smart photo transform creation with aspect ratio detection
export function createSmartPhotoTransform(
  photo: Photo,
  containerAspectRatio: number = 1.0, // Default to square container
  photoCenterX: number = 0.5,
  photoCenterY: number = 0.5
): PhotoTransform {
  const photoAspectRatio = getPhotoAspectRatio(photo);
  return createPhotoTransformWithContain(photoAspectRatio, containerAspectRatio, photoCenterX, photoCenterY);
}

// Smart photo transform creation - SINGLE PROCESS, NO FALLBACKS
export async function createSmartPhotoTransformFromSlot(
  photo: Photo,
  slot: TemplateSlot,
  photoCenterX: number = 0.5,
  photoCenterY: number = 0.5
): Promise<PhotoTransform> {
  console.log('🚀 FUNCTION CALLED: createSmartPhotoTransformFromSlot', {
    photoId: photo.id,
    slotId: slot.id,
    templateType: slot.templateType,
    slotIndex: slot.slotIndex
  });
  
  // Get photo dimensions - try to detect if missing from metadata
  let photoWidth = photo.metadata?.width || 0;
  let photoHeight = photo.metadata?.height || 0;
  
  // If metadata is missing, get real dimensions from Google Drive API
  if (!photoWidth || !photoHeight) {
    try {
      console.log('🔍 MISSING METADATA - Getting real dimensions from Google Drive API...');
      const dimensions = await getRealPhotoDimensions(photo);
      photoWidth = dimensions.width;
      photoHeight = dimensions.height;
      console.log('✅ REAL DIMENSIONS RETRIEVED:', { width: photoWidth, height: photoHeight });
    } catch (error) {
      console.warn('❌ Failed to get real dimensions, using defaults:', error);
      photoWidth = 1600;  // Default to common photo size
      photoHeight = 1200; // Default to 4:3 aspect ratio
    }
  }
  
  console.log('📏 PHOTO DIMENSIONS DEBUG:', {
    photoId: photo.id,
    photoName: photo.name,
    rawMetadata: photo.metadata,
    hasWidth: !!photo.metadata?.width,
    hasHeight: !!photo.metadata?.height,
    rawWidth: photo.metadata?.width,
    rawHeight: photo.metadata?.height,
    usedWidth: photoWidth,
    usedHeight: photoHeight,
    usingDefaults: !photo.metadata?.width || !photo.metadata?.height,
    defaultsApplied: {
      width: photoWidth === 1600 ? 'DEFAULT' : 'FROM_METADATA',
      height: photoHeight === 1200 ? 'DEFAULT' : 'FROM_METADATA'
    }
  });
  
  // Get hole dimensions with detailed debugging
  const rawHoleDimensions = getHoleDimensions(slot);
  const holeDimensions = rawHoleDimensions || { width: 400, height: 400 }; // Default to square
  
  console.log('🕳️ HOLE DIMENSIONS DEBUG:', {
    slotInfo: { 
      id: slot.id, 
      templateType: slot.templateType, 
      slotIndex: slot.slotIndex,
      printSize: slot.printSize 
    },
    rawHoleDimensions,
    hasRawDimensions: !!rawHoleDimensions,
    finalHoleDimensions: holeDimensions,
    usingDefaults: !rawHoleDimensions,
    defaultsApplied: {
      width: holeDimensions.width === 400 ? 'DEFAULT' : 'FROM_DATABASE',
      height: holeDimensions.height === 400 ? 'DEFAULT' : 'FROM_DATABASE'
    }
  });
  
  // ALWAYS use smart scaling - no branches, no fallbacks
  const smartScale = calculateSmartFillScale(
    photoWidth,
    photoHeight,
    holeDimensions.width,
    holeDimensions.height
  );
  
  const finalTransform = createPhotoTransform(smartScale, photoCenterX, photoCenterY);
  
  console.log('✅ FINAL TRANSFORM CREATED:', {
    smartScale,
    finalTransform,
    expectedResult: {
      scaledWidth: Math.round(photoWidth * smartScale),
      scaledHeight: Math.round(photoHeight * smartScale),
      shouldFillCompletely: true
    }
  });
  
  return finalTransform;
}

// Create a photo-centric transform without restrictive clamping
export function createPhotoTransform(photoScale: number, photoCenterX: number, photoCenterY: number): PhotoTransform {
  const clampedScale = Math.max(0.01, Math.min(10, photoScale)); // Only clamp scale to reasonable limits
  
  const transform: PhotoTransform = {
    photoScale: clampedScale,
    photoCenterX: photoCenterX, // No clamping - allow free movement
    photoCenterY: photoCenterY, // No clamping - allow free movement
    version: 'photo-centric' as const
  };
  
  console.log('🔧 createPhotoTransform:', {
    input: { photoScale, photoCenterX, photoCenterY },
    clamped: { clampedScale, wasScaleClamped: clampedScale !== photoScale },
    finalTransform: transform
  });
  
  return transform;
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
  printSize?: PrintSize; // Dynamic print sizes from database
  slotIndex: number;
  photoId?: string;
  transform?: ContainerTransform | PhotoTransform; // Support both formats
  label?: string;
  isAdditional?: boolean; // Flag to identify templates added via "Add Prints" button
}

// Legacy PhotoStudioPackage removed - now using manual packages

export interface Template {
  id: string;
  type: TemplateType;
  name: string;
  printSize: PrintSize; // Added print size to Template interface
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

export type TemplateType = string; // Dynamic template types from database

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
export type PrintSize = string; // Dynamic print sizes from database
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

export interface PrintSizeConfig {
  id: string;
  print_size: string;
  width_inches: number;
  height_inches: number;
  default_dpi: number;
  default_width_pixels?: number;
  default_height_pixels?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
  updated_by?: string;
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
  // Custom physical dimensions (overrides print_size defaults)
  custom_width_inches?: number;
  custom_height_inches?: number;
  custom_dpi?: number;
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
  custom_width_inches?: number;
  custom_height_inches?: number;
  custom_dpi?: number;
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
  getAvailableTemplateTypes(): Promise<string[]>;
  getUniqueTemplateTypes(printSize?: PrintSize): Promise<string[]>;
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
  replaceTemplateAtPosition(packageId: string, position: number, newTemplateId: string): Promise<void>;
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