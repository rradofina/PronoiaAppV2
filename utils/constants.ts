import { PhotoStudioPackage, TemplateType, TemplateLayout } from '../types';

// Package definitions
export const PACKAGES: PhotoStudioPackage[] = [
  {
    id: 'A',
    name: 'Package A',
    templateCount: 1,
    description: 'Perfect for single template selection',
  },
  {
    id: 'B',
    name: 'Package B',
    templateCount: 2,
    description: 'Great for couples or small collections',
  },
  {
    id: 'C',
    name: 'Package C',
    templateCount: 5,
    description: 'Ideal for families and groups',
  },
  {
    id: 'D',
    name: 'Package D',
    templateCount: 10,
    description: 'Complete studio experience',
  },
];

// Template dimensions (4R size: 4x6 inches at 300 DPI)
export const TEMPLATE_DIMENSIONS = {
  width: 1200,
  height: 1800,
  dpi: 300,
  aspectRatio: 2 / 3,
};

// Template layouts configuration
export const TEMPLATE_LAYOUTS: Record<TemplateType, TemplateLayout> = {
  solo: {
    type: 'solo',
    slots: {
      count: 1,
      arrangement: 'single',
      spacing: 0,
      padding: 60,
    },
  },
  collage: {
    type: 'collage',
    slots: {
      count: 4,
      arrangement: 'grid',
      spacing: 20,
      padding: 40,
    },
  },
  photocard: {
    type: 'photocard',
    slots: {
      count: 1,
      arrangement: 'single',
      spacing: 0,
      padding: 0,
    },
  },
  photostrip: {
    type: 'photostrip',
    slots: {
      count: 6,
      arrangement: 'strip',
      spacing: 15,
      padding: 30,
    },
  },
};

// Template type descriptions
export const TEMPLATE_DESCRIPTIONS: Record<TemplateType, string> = {
  solo: 'Single photo with white border/matting',
  collage: '4 photos in a grid layout with spacing',
  photocard: 'Full bleed photo with no margins',
  photostrip: '6 photos arranged in a vertical strip',
};

// Google Drive configuration
export const GOOGLE_DRIVE_CONFIG = {
  scopes: [
    'https://www.googleapis.com/auth/drive',
  ],
  discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
  clientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY || '',
};

// File type configurations
export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/tiff',
];

export const SUPPORTED_IMAGE_EXTENSIONS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.heic',
  '.tiff',
];

// UI Constants
export const UI_CONSTANTS = {
  TOUCH_TARGET_SIZE: 44, // Minimum touch target size in pixels
  THUMBNAIL_SIZES: {
    small: 120,
    medium: 200,
    large: 300,
  },
  ANIMATION_DURATION: {
    fast: 150,
    normal: 300,
    slow: 500,
  },
  BREAKPOINTS: {
    tablet: 768,
    tabletLandscape: 1024,
    desktop: 1280,
  },
  GRID_GAPS: {
    small: 8,
    medium: 16,
    large: 24,
  },
};

// Export settings
export const EXPORT_SETTINGS = {
  quality: 0.95,
  format: 'image/jpeg' as const,
  backgroundColor: '#ffffff',
  compression: true,
  outputPrefix: 'Template_',
  folderNamePrefix: 'Output_',
  dateFormat: 'YYYY-MM-DD_HHmmss',
};

// Error messages
export const ERROR_MESSAGES = {
  GOOGLE_DRIVE_AUTH_FAILED: 'Failed to authenticate with Google Drive',
  GOOGLE_DRIVE_FOLDER_NOT_FOUND: 'Google Drive folder not found',
  GOOGLE_DRIVE_ACCESS_DENIED: 'Access denied to Google Drive folder',
  PHOTO_LOAD_FAILED: 'Failed to load photo',
  TEMPLATE_GENERATION_FAILED: 'Failed to generate template',
  INVALID_PACKAGE_SELECTION: 'Invalid package selection',
  TEMPLATE_LIMIT_EXCEEDED: 'Template limit exceeded for selected package',
  PHOTO_SLOT_INVALID: 'Invalid photo slot selection',
  EXPORT_FAILED: 'Failed to export templates',
  NETWORK_ERROR: 'Network error occurred',
  STORAGE_ERROR: 'Storage error occurred',
  PERMISSION_ERROR: 'Permission error occurred',
  INVALID_FILE_TYPE: 'Invalid file type selected',
  FILE_TOO_LARGE: 'File size exceeds maximum limit',
  SESSION_EXPIRED: 'Session has expired',
  UNKNOWN_ERROR: 'An unknown error occurred',
};

// Success messages
export const SUCCESS_MESSAGES = {
  GOOGLE_DRIVE_CONNECTED: 'Successfully connected to Google Drive',
  TEMPLATE_CREATED: 'Template created successfully',
  PHOTO_SELECTED: 'Photo selected successfully',
  TEMPLATES_EXPORTED: 'Templates exported successfully',
  SESSION_SAVED: 'Session saved successfully',
  SESSION_RESTORED: 'Session restored successfully',
};

// Local storage keys
export const STORAGE_KEYS = {
  SESSION: 'photo_studio_session',
  USER_PREFERENCES: 'photo_studio_preferences',
  GOOGLE_DRIVE_TOKEN: 'google_drive_token',
  MAIN_SESSIONS_FOLDER: 'main_sessions_folder',
  RECENT_FOLDERS: 'recent_folders',
  TEMPLATE_CACHE: 'template_cache',
};

// Default values
export const DEFAULTS = {
  THUMBNAIL_SIZE: UI_CONSTANTS.THUMBNAIL_SIZES.medium,
  VIEW_MODE: 'grid' as const,
  SORT_BY: 'name' as const,
  SORT_ORDER: 'asc' as const,
  TEMPLATE_QUALITY: 0.95,
  EXPORT_FORMAT: 'jpg' as const,
  CACHE_DURATION: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
};

// Template slot calculations
export const calculatePhotoSlots = (templateType: TemplateType) => {
  const layout = TEMPLATE_LAYOUTS[templateType];
  const { width, height } = TEMPLATE_DIMENSIONS;
  const { padding, spacing } = layout.slots;
  
  switch (templateType) {
    case 'solo':
      return [
        {
          x: padding,
          y: padding,
          width: width - 2 * padding,
          height: height - 2 * padding,
        },
      ];
    
    case 'collage':
      const collageCellWidth = (width - 2 * padding - spacing) / 2;
      const collageCellHeight = (height - 2 * padding - spacing) / 2;
      return [
        { x: padding, y: padding, width: collageCellWidth, height: collageCellHeight },
        { x: padding + collageCellWidth + spacing, y: padding, width: collageCellWidth, height: collageCellHeight },
        { x: padding, y: padding + collageCellHeight + spacing, width: collageCellWidth, height: collageCellHeight },
        { x: padding + collageCellWidth + spacing, y: padding + collageCellHeight + spacing, width: collageCellWidth, height: collageCellHeight },
      ];
    
    case 'photocard':
      return [
        {
          x: 0,
          y: 0,
          width: width,
          height: height,
        },
      ];
    
    case 'photostrip':
      const stripCellHeight = (height - 2 * padding - 5 * spacing) / 6;
      const stripCellWidth = width - 2 * padding;
      return Array.from({ length: 6 }, (_, i) => ({
        x: padding,
        y: padding + i * (stripCellHeight + spacing),
        width: stripCellWidth,
        height: stripCellHeight,
      }));
    
    default:
      return [];
  }
};

// Validation functions
export const validatePackageSelection = (packageId: string): boolean => {
  return PACKAGES.some(pkg => pkg.id === packageId);
};

export const validateTemplateType = (templateType: string): templateType is TemplateType => {
  return ['solo', 'collage', 'photocard', 'photostrip'].indexOf(templateType) !== -1;
};

export const validateImageFile = (file: File): boolean => {
  return SUPPORTED_IMAGE_TYPES.indexOf(file.type) !== -1;
};

export const validateImageUrl = (url: string): boolean => {
  const extension = url.split('.').pop()?.toLowerCase();
  return extension ? SUPPORTED_IMAGE_EXTENSIONS.indexOf(`.${extension}`) !== -1 : false;
};

export const PRINT_SIZES = {
  '4R': { width: 1200, height: 1800, dpi: 300, name: '4R (4x6")' },
  '5R': { width: 1500, height: 2100, dpi: 300, name: '5R (5x7")' },
  'A4': { width: 2480, height: 3508, dpi: 300, name: 'A4 (8.3x11.7")' },
};

export const TEMPLATE_TYPES = [
  { id: 'solo', name: 'Solo Print', slots: 1, allowedSizes: ['4R', '5R', 'A4'] },
  { id: 'collage', name: 'Collage Print', slots: 4, allowedSizes: ['4R'] },
  { id: 'photocard', name: 'Photocard Print', slots: 4, allowedSizes: ['4R'] },
  { id: 'photostrip', name: 'Photo Strip Print', slots: 6, allowedSizes: ['4R'] },
];

export const DEFAULT_TEMPLATE_CYCLE = ['solo', 'collage', 'photostrip', 'photocard']; 