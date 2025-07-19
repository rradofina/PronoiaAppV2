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

// Print Size Configurations for Template Builder
export const PRINT_SIZES: Record<string, any> = {
  '4R': {
    name: '4R' as const,
    label: '4R (4×6")',
    dimensions: {
      width: 1200,
      height: 1800,
      dpi: 300,
      inches: {
        width: 4,
        height: 6,
      },
    },
    description: 'Standard 4×6 inch photo print with custom layout support',
    is_custom_layouts: true,
  },
  '5R': {
    name: '5R' as const,
    label: '5R (5×7")',
    dimensions: {
      width: 1500,
      height: 2100,
      dpi: 300,
      inches: {
        width: 5,
        height: 7,
      },
    },
    description: 'Standard 5×7 inch photo print, full-size only',
    is_custom_layouts: false,
  },
  'A4': {
    name: 'A4' as const,
    label: 'A4 (8.3×11.7")',
    dimensions: {
      width: 2480,
      height: 3508,
      dpi: 300,
      inches: {
        width: 8.27,
        height: 11.69,
      },
    },
    description: 'Standard A4 paper size, full-size only',
    is_custom_layouts: false,
  },
};

export const TEMPLATE_TYPES = [
  { id: 'solo', name: 'Solo Print', slots: 1, allowedSizes: ['4R', '5R', 'A4'] },
  { id: 'collage', name: 'Collage Print', slots: 4, allowedSizes: ['4R'] },
  { id: 'photocard', name: 'Photocard Print', slots: 4, allowedSizes: ['4R'] },
  { id: 'photostrip', name: 'Photo Strip Print', slots: 6, allowedSizes: ['4R'] },
];

export const DEFAULT_TEMPLATE_CYCLE = ['solo', 'collage', 'photostrip', 'photocard'];

// Template Builder Constants
export const TEMPLATE_BUILDER = {
  // Canvas settings
  CANVAS: {
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 3,
    DEFAULT_ZOOM: 1,
    ZOOM_STEP: 0.1,
    SNAP_THRESHOLD: 10, // pixels
    GRID_SIZE: 20, // pixels
  },
  
  // Photo slot constraints
  PHOTO_SLOT: {
    MIN_WIDTH: 50,
    MIN_HEIGHT: 50,
    MAX_WIDTH: 3508, // A4 width
    MAX_HEIGHT: 3508, // A4 height
    DEFAULT_WIDTH: 300,
    DEFAULT_HEIGHT: 400,
    BORDER_WIDTH: 2,
    HANDLE_SIZE: 12,
  },
  
  // Drag and drop
  DRAG_DROP: {
    SNAP_DISTANCE: 15,
    GHOST_OPACITY: 0.5,
    DRAG_THRESHOLD: 5, // minimum pixels before drag starts
    AUTO_SCROLL_SPEED: 10,
    AUTO_SCROLL_MARGIN: 50,
  },
  
  // Layout presets
  LAYOUT_PRESETS: {
    '4R': {
      'Solo Portrait': {
        type: 'solo',
        slots: [{
          x: 60, y: 60, width: 1080, height: 1680, aspect_ratio: 'free'
        }]
      },
      'Classic Collage': {
        type: 'collage',
        slots: [
          { x: 40, y: 40, width: 530, height: 870, aspect_ratio: '2:3' },
          { x: 630, y: 40, width: 530, height: 870, aspect_ratio: '2:3' },
          { x: 40, y: 950, width: 530, height: 870, aspect_ratio: '2:3' },
          { x: 630, y: 950, width: 530, height: 870, aspect_ratio: '2:3' }
        ]
      },
      'Photo Strip': {
        type: 'photostrip',
        slots: [
          { x: 30, y: 30, width: 570, height: 280, aspect_ratio: '2:1' },
          { x: 630, y: 30, width: 570, height: 280, aspect_ratio: '2:1' },
          { x: 30, y: 325, width: 570, height: 280, aspect_ratio: '2:1' },
          { x: 630, y: 325, width: 570, height: 280, aspect_ratio: '2:1' },
          { x: 30, y: 620, width: 570, height: 280, aspect_ratio: '2:1' },
          { x: 630, y: 620, width: 570, height: 280, aspect_ratio: '2:1' }
        ]
      }
    },
    '5R': {
      'Full Portrait': {
        type: 'simple',
        slots: [{ x: 0, y: 0, width: 1500, height: 2100, aspect_ratio: '5:7' }]
      },
      'Full Landscape': {
        type: 'simple',
        slots: [{ x: 0, y: 0, width: 2100, height: 1500, aspect_ratio: '7:5' }]
      }
    },
    'A4': {
      'Full Portrait': {
        type: 'simple',
        slots: [{ x: 0, y: 0, width: 2480, height: 3508, aspect_ratio: '210:297' }]
      },
      'Full Landscape': {
        type: 'simple',
        slots: [{ x: 0, y: 0, width: 3508, height: 2480, aspect_ratio: '297:210' }]
      }
    }
  },
  
  // Common aspect ratios for photo slots
  ASPECT_RATIOS: [
    { label: 'Free', value: 'free' },
    { label: 'Square (1:1)', value: '1:1' },
    { label: 'Portrait (2:3)', value: '2:3' },
    { label: 'Landscape (3:2)', value: '3:2' },
    { label: 'Landscape (2:1)', value: '2:1' },
    { label: '5R (5:7)', value: '5:7' },
    { label: 'A4 (210:297)', value: '210:297' },
  ],
  
  // Colors for template builder UI
  COLORS: {
    CANVAS_BACKGROUND: '#f8f9fa',
    GRID_COLOR: '#e9ecef',
    SLOT_BORDER: '#007bff',
    SLOT_BORDER_SELECTED: '#dc3545',
    SLOT_FILL: 'rgba(0, 123, 255, 0.1)',
    SLOT_FILL_SELECTED: 'rgba(220, 53, 69, 0.1)',
    HANDLE_COLOR: '#ffffff',
    HANDLE_BORDER: '#007bff',
    SNAP_GUIDE: '#28a745',
  }
};

// Admin role permissions
export const ADMIN_PERMISSIONS = {
  TEMPLATE_BUILDER: ['create', 'read', 'update', 'delete'],
  TEMPLATE_CATEGORIES: ['create', 'read', 'update', 'delete'],
  USER_MANAGEMENT: ['read', 'update'],
  ANALYTICS: ['read'],
  SYSTEM_SETTINGS: ['read', 'update'],
};

// Template validation rules
export const TEMPLATE_VALIDATION = {
  MIN_SLOTS: 1,
  MAX_SLOTS: 20,
  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 50,
  MAX_DESCRIPTION_LENGTH: 200,
  ALLOWED_BACKGROUND_COLORS: [
    '#FFFFFF', '#F8F9FA', '#E9ECEF', '#DEE2E6', '#CED4DA',
    '#ADB5BD', '#6C757D', '#495057', '#343A40', '#212529'
  ],
}; 