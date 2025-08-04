import { TemplateType, TemplateLayout } from '../types';

// Legacy packages removed - now using manual package management system

// REMOVED: Template dimensions are now loaded from database
// No hardcoded dimensions - everything comes from manual_templates table

// REMOVED: Template layouts are now calculated from database holes_data
// No hardcoded layouts - everything comes from manual_templates table

// REMOVED: Template descriptions are now loaded from database
// No hardcoded descriptions - everything comes from manual_templates table

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

// REMOVED: Photo slot calculations are now pure database-driven
// Use templateConfigService.getPhotoSlots() instead
// This function is deprecated and should not be used
export const calculatePhotoSlots = () => {
  throw new Error('calculatePhotoSlots is deprecated. Use templateConfigService.getPhotoSlots() instead.');
};

// Validation functions
// Package validation moved to manual package service

export const validateTemplateType = (templateType: string): templateType is TemplateType => {
  // Template types are now dynamic - any non-empty string is valid
  return typeof templateType === 'string' && templateType.trim().length > 0;
};

// REMOVED: Template type validation is now handled by templateConfigService
// Use templateConfigService.getTemplateTypeConfig() to check if a template type exists

export const validateImageFile = (file: File): boolean => {
  return SUPPORTED_IMAGE_TYPES.indexOf(file.type) !== -1;
};

export const validateImageUrl = (url: string): boolean => {
  const extension = url.split('.').pop()?.toLowerCase();
  return extension ? SUPPORTED_IMAGE_EXTENSIONS.indexOf(`.${extension}`) !== -1 : false;
};

// Print size display ordering (configurable, not hardcoded in components)
export const PRINT_SIZE_ORDER = ['4R', '5R', 'A4'] as const;

// REMOVED: Print size configurations are now loaded from database
// Use templateConfigService.getAvailablePrintSizes() to get dynamic print sizes
// No hardcoded print size configurations - everything comes from manual_templates table

// REMOVED: No legacy template types - everything must come from database
// Use templateConfigService.getTemplateTypes() directly

// Legacy template cycling removed - now using configured package templates

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
  
  // REMOVED: Layout presets are now database-driven
  // Use templateConfigService.getPhotoSlots() to get actual template layouts from database
  // No hardcoded layout presets - everything comes from manual_templates holes_data
  
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