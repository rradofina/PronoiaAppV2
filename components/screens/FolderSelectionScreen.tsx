import { GoogleAuth, DriveFolder, Package, PackageGroup, ManualPackage, ManualTemplate, Photo } from '../../types';
import HeaderNavigation from '../HeaderNavigation';
import { useState, useEffect, useCallback, useReducer } from 'react';
import { manualPackageService } from '../../services/manualPackageService';
import { packageGroupService } from '../../services/packageGroupService';
import { googleDriveService } from '../../services/googleDriveService';
import AnimatedTemplateReveal from '../animations/AnimatedTemplateReveal';
import PackageTemplatePreview from '../PackageTemplatePreview';
import { ChevronRight, ChevronLeft, Folder } from 'lucide-react';

// Template state management types with session storage
interface TemplateState {
  // Base templates loaded from database (read-only, admin-configured)
  basePackageTemplates: Record<string, ManualTemplate[]>;
  
  // Session-specific template modifications (client customizations)
  sessionOverrides: Record<string, {
    replacements: Record<number, ManualTemplate>; // position -> replacement template
    additions: ManualTemplate[]; // additional templates added to package
  }>;
  
  expandedPackageId: string | null;
  loadingPackageId: string | null;
  templateError: string | null;
}

type TemplateAction = 
  // Base template management (read-only database templates)
  | { type: 'SET_BASE_TEMPLATES'; packageId: string; templates: ManualTemplate[] }
  | { type: 'INVALIDATE_BASE_TEMPLATES'; packageId: string }
  
  // Session-based template customizations (client modifications)
  | { type: 'REPLACE_TEMPLATE_IN_SESSION'; packageId: string; templateIndex: number; newTemplate: ManualTemplate }
  | { type: 'ADD_TEMPLATE_TO_SESSION'; packageId: string; template: ManualTemplate }
  | { type: 'DELETE_TEMPLATE_FROM_SESSION'; packageId: string; templateIndex: number }
  | { type: 'CLEAR_SESSION_OVERRIDES'; packageId?: string }
  
  // UI state management
  | { type: 'SET_EXPANDED_PACKAGE'; packageId: string | null }
  | { type: 'SET_LOADING'; packageId: string | null }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'CLEAR_ALL_TEMPLATES' };

// Session-aware template reducer with base templates + session overrides
function templateReducer(state: TemplateState, action: TemplateAction): TemplateState {
  switch (action.type) {
    // Base template management (read-only from database)
    case 'SET_BASE_TEMPLATES':
      return {
        ...state,
        basePackageTemplates: {
          ...state.basePackageTemplates,
          [action.packageId]: action.templates
        }
      };
    
    case 'INVALIDATE_BASE_TEMPLATES':
      const { [action.packageId]: removed, ...remainingBase } = state.basePackageTemplates;
      console.log('🗑️ INVALIDATING BASE TEMPLATE CACHE for package:', {
        packageId: action.packageId,
        removedTemplatesCount: removed?.length || 0,
        remainingPackages: Object.keys(remainingBase)
      });
      return { 
        ...state, 
        basePackageTemplates: remainingBase 
      };
    
    // Session-based template modifications (client customizations)
    case 'REPLACE_TEMPLATE_IN_SESSION':
      const baseTemplates = state.basePackageTemplates[action.packageId] || [];
      
      // Validate template index against base templates
      if (action.templateIndex < 0 || action.templateIndex >= baseTemplates.length) {
        console.error('❌ INVALID TEMPLATE INDEX for session replacement:', {
          packageId: action.packageId,
          templateIndex: action.templateIndex,
          baseTemplatesCount: baseTemplates.length,
          newTemplateName: action.newTemplate.name
        });
        return state;
      }
      
      const currentOverrides = state.sessionOverrides[action.packageId] || { replacements: {}, additions: [] };
      
      console.log('🔄 SESSION-BASED TEMPLATE REPLACEMENT:', {
        packageId: action.packageId,
        templateIndex: action.templateIndex,
        oldTemplate: {
          id: baseTemplates[action.templateIndex]?.id,
          name: baseTemplates[action.templateIndex]?.name
        },
        newTemplate: {
          id: action.newTemplate.id,
          name: action.newTemplate.name
        }
      });
      
      return {
        ...state,
        sessionOverrides: {
          ...state.sessionOverrides,
          [action.packageId]: {
            ...currentOverrides,
            replacements: {
              ...currentOverrides.replacements,
              [action.templateIndex]: action.newTemplate
            }
          }
        }
      };
    
    case 'ADD_TEMPLATE_TO_SESSION':
      const currentSessionOverrides = state.sessionOverrides[action.packageId] || { replacements: {}, additions: [] };
      
      console.log('➕ SESSION-BASED TEMPLATE ADDITION:', {
        packageId: action.packageId,
        newTemplate: {
          id: action.template.id,
          name: action.template.name
        },
        currentAdditions: currentSessionOverrides.additions.length
      });
      
      return {
        ...state,
        sessionOverrides: {
          ...state.sessionOverrides,
          [action.packageId]: {
            ...currentSessionOverrides,
            additions: [...currentSessionOverrides.additions, action.template]
          }
        }
      };
    
    case 'DELETE_TEMPLATE_FROM_SESSION':
      const deleteOverrides = state.sessionOverrides[action.packageId];
      if (!deleteOverrides || !deleteOverrides.additions) {
        return state;
      }
      
      // Calculate the actual index in additions array
      // We need to account for base templates when determining which addition to delete
      const baseTemplateCount = state.basePackageTemplates[action.packageId]?.length || 0;
      const additionIndex = action.templateIndex - baseTemplateCount;
      
      if (additionIndex < 0 || additionIndex >= deleteOverrides.additions.length) {
        console.warn('⚠️ Invalid template index for deletion:', {
          templateIndex: action.templateIndex,
          baseTemplateCount,
          additionIndex,
          totalAdditions: deleteOverrides.additions.length
        });
        return state;
      }
      
      console.log('🗑️ SESSION-BASED TEMPLATE DELETION:', {
        packageId: action.packageId,
        templateIndex: action.templateIndex,
        additionIndex,
        deletedTemplate: deleteOverrides.additions[additionIndex]?.name
      });
      
      return {
        ...state,
        sessionOverrides: {
          ...state.sessionOverrides,
          [action.packageId]: {
            ...deleteOverrides,
            additions: deleteOverrides.additions.filter((_, index) => index !== additionIndex)
          }
        }
      };
    
    case 'CLEAR_SESSION_OVERRIDES':
      if (action.packageId) {
        // Clear overrides for specific package
        const { [action.packageId]: clearedPackage, ...remainingOverrides } = state.sessionOverrides;
        return {
          ...state,
          sessionOverrides: remainingOverrides
        };
      } else {
        // Clear all session overrides
        return {
          ...state,
          sessionOverrides: {}
        };
      }
    
    // UI state management
    case 'SET_EXPANDED_PACKAGE':
      return { ...state, expandedPackageId: action.packageId };
    
    case 'SET_LOADING':
      return { ...state, loadingPackageId: action.packageId };
    
    case 'SET_ERROR':
      return { ...state, templateError: action.error };
    
    case 'CLEAR_ALL_TEMPLATES':
      return { 
        ...state, 
        basePackageTemplates: {},
        sessionOverrides: {}
      };
    
    default:
      return state;
  }
}

const initialTemplateState: TemplateState = {
  basePackageTemplates: {},
  sessionOverrides: {},
  expandedPackageId: null,
  loadingPackageId: null,
  templateError: null
};

// Helper function to merge base templates with session overrides
function getEffectiveTemplates(
  baseTemplates: ManualTemplate[], 
  sessionOverrides?: { replacements: Record<number, ManualTemplate>; additions: ManualTemplate[] }
): ManualTemplate[] {
  if (!sessionOverrides) {
    return baseTemplates;
  }
  
  // Start with base templates (mark them as NOT additional)
  let effectiveTemplates = baseTemplates.map(template => ({
    ...template,
    _isFromAddition: false // Internal marker to track source
  }));
  
  // Apply session replacements (replacements are still part of base package)
  Object.entries(sessionOverrides.replacements).forEach(([indexStr, replacementTemplate]) => {
    const index = parseInt(indexStr);
    if (index >= 0 && index < effectiveTemplates.length) {
      effectiveTemplates[index] = {
        ...replacementTemplate,
        _isFromAddition: false // Replacements are not additions
      };
    }
  });
  
  // Add session additions (mark them as additional)
  const markedAdditions = sessionOverrides.additions.map(template => ({
    ...template,
    _isFromAddition: true // Mark as addition for later processing
  }));
  effectiveTemplates = [...effectiveTemplates, ...markedAdditions];
  
  return effectiveTemplates;
}

interface FolderSelectionScreenProps {
  googleAuth: GoogleAuth;
  selectedMainFolder: DriveFolder | null;
  clientFolders: DriveFolder[];
  handleClientFolderSelect: (folder: DriveFolder) => void;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
  // New props for package selection
  selectedPackage: Package | null;
  setSelectedPackage: (pkg: Package | null) => void;
  handleContinue: (effectiveTemplates?: ManualTemplate[]) => void;
  // New prop for template management
  onManageTemplates: () => void;
  // New prop for package management
  onManagePackages?: () => void;
  // New prop for admin settings
  onAdminSettings?: () => void;
}

// Transform Google Drive URLs to working image URLs
const transformGoogleDriveImageUrl = (photo: any, size: string = 's100'): string => {
  // Try to use the Google Drive file ID to create a working URL
  if (photo.googleDriveId || photo.id) {
    const fileId = photo.googleDriveId || photo.id;
    const transformedUrl = `https://lh3.googleusercontent.com/d/${fileId}=${size}`;
    console.log(`🔄 Transformed URL for ${photo.name}: ${transformedUrl}`);
    return transformedUrl;
  }
  
  // Fallback to thumbnail URL with size adjustment
  if (photo.thumbnailUrl) {
    const fallbackUrl = photo.thumbnailUrl.replace('=s220', `=${size}`);
    console.log(`📷 Fallback URL for ${photo.name}: ${fallbackUrl}`);
    return fallbackUrl;
  }
  
  // Last resort: use regular URL
  console.log(`⚠️ Using regular URL for ${photo.name}: ${photo.url}`);
  return photo.url || '';
};

// Simple folder card component with thumbnail
function FolderCard({ 
  folder, 
  isSelected,
  onClick 
}: { 
  folder: DriveFolder; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [previewImages, setPreviewImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchFolderImages = async () => {
      try {
        console.log(`📁 Fetching images for folder: ${folder.name}`);
        const photos = await googleDriveService.getPhotosFromFolder(folder.id);
        console.log(`📸 Found ${photos.length} photos in ${folder.name}`);
        
        if (photos.length > 0) {
          // Get first photo for main thumbnail
          const firstPhoto = photos[0];
          const smallThumbnail = transformGoogleDriveImageUrl(firstPhoto, 's80');
          setThumbnailUrl(smallThumbnail);

          // Get first 3 photos for preview strip
          const previewPhotos = photos.slice(0, 3).map(photo => 
            transformGoogleDriveImageUrl(photo, 's100')
          );
          console.log(`🖼️ Preview URLs for ${folder.name}:`, previewPhotos);
          setPreviewImages(previewPhotos);
        }
      } catch (error) {
        console.error('Failed to fetch folder images:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFolderImages();
  }, [folder.id]);

  return (
    <div 
      onClick={onClick}
      className={`rounded-lg p-3 sm:p-4 cursor-pointer transition-all duration-200 w-full border-2 ${
        isSelected 
          ? 'bg-blue-50 border-blue-500 shadow-md' 
          : 'bg-gray-50 border-transparent hover:bg-gray-100 hover:border-gray-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1">
          {/* Thumbnail or fallback icon */}
          <div className="w-8 sm:w-10 h-8 sm:h-10 mr-3 sm:mr-4 rounded-full overflow-hidden flex-shrink-0">
            {isLoading ? (
              <div className="w-full h-full bg-gray-300 animate-pulse rounded-full" />
            ) : thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`Preview of ${folder.name}`}
                className="w-full h-full object-cover"
                onError={() => setThumbnailUrl(null)}
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white text-sm">
                📁
              </div>
            )}
          </div>
          
          <div className="flex-1">
            <p className={`font-semibold text-base sm:text-lg ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
              {folder.name}
            </p>
            <p className="text-xs sm:text-sm text-gray-500">
              {new Date(folder.createdTime).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              })}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Photo Preview Strip - Hidden on mobile for space */}
          {previewImages.length > 0 && (
            <div className="hidden sm:flex space-x-2">
              {previewImages.map((imageUrl, index) => (
                <div key={index} className="w-10 h-10 rounded-lg overflow-hidden bg-gray-200 flex-shrink-0">
                  <img
                    src={imageUrl}
                    alt={`Photo ${index + 1} from ${folder.name}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
          )}
          
          {/* Selection indicator */}
          {isSelected && (
            <div className="text-blue-600">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FolderSelectionScreen({
  googleAuth,
  selectedMainFolder,
  clientFolders,
  handleClientFolderSelect,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
  selectedPackage,
  setSelectedPackage,
  handleContinue,
  onManageTemplates,
  onManagePackages,
  onAdminSettings,
}: FolderSelectionScreenProps) {
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [showPackageSelection, setShowPackageSelection] = useState(false);
  const [groups, setGroups] = useState<PackageGroup[]>([]);
  const [groupedPackages, setGroupedPackages] = useState<{ [groupId: string]: ManualPackage[] }>({});
  const [ungroupedPackages, setUngroupedPackages] = useState<ManualPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);
  
  // Navigation state for folder browsing
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [currentFolders, setCurrentFolders] = useState<DriveFolder[]>(clientFolders);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);
  const [selectedNavigationFolder, setSelectedNavigationFolder] = useState<DriveFolder | null>(null);
  
  // Template state managed by reducer (replaces scattered useState)
  const [templateState, dispatchTemplate] = useReducer(templateReducer, initialTemplateState);
  
  // Individual template selection state
  const [selectedTemplates, setSelectedTemplates] = useState<ManualTemplate[]>([]);
  const [availablePhotos, setAvailablePhotos] = useState<Photo[]>([]);

  // Load folders from a specific parent folder
  const loadFolders = async (parentId: string | null = null) => {
    setIsLoadingFolders(true);
    try {
      // If parentId is null, we're at the root (selectedMainFolder)
      if (parentId === null) {
        // Load folders from the main folder
        const mainFolderId = selectedMainFolder?.id;
        if (!mainFolderId) {
          setCurrentFolders(clientFolders);
          return;
        }
        
        const response = await window.gapi.client.drive.files.list({
          q: `'${mainFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name, createdTime)',
          orderBy: 'name'
        });
        setCurrentFolders(response.result.files || []);
      } else {
        // Load subfolders from the specified parent
        const response = await window.gapi.client.drive.files.list({
          q: `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name, createdTime)',
          orderBy: 'name'
        });
        setCurrentFolders(response.result.files || []);
      }
    } catch (error) {
      console.error('Failed to load folders:', error);
      setCurrentFolders([]);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Navigate into a folder (browse its contents)
  const handleFolderNavigate = async (folder: DriveFolder) => {
    console.log('📂 Navigating into folder:', folder.name);
    
    // Add to path
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
    setSelectedNavigationFolder(null); // Clear selection when navigating
    
    // Load subfolders
    await loadFolders(folder.id);
  };

  // Navigate via breadcrumb
  const handleBreadcrumbClick = async (index: number) => {
    console.log('🔙 Navigating to breadcrumb index:', index);
    
    setSelectedNavigationFolder(null); // Clear selection when navigating
    
    if (index === -1) {
      // Root/main folder clicked
      setFolderPath([]);
      setCurrentFolderId(null);
      await loadFolders(null);
    } else {
      // Navigate to specific folder in path
      const newPath = folderPath.slice(0, index + 1);
      setFolderPath(newPath);
      const targetFolder = newPath[newPath.length - 1];
      setCurrentFolderId(targetFolder.id);
      await loadFolders(targetFolder.id);
    }
  };

  // Go back one level
  const handleBackClick = async () => {
    if (folderPath.length > 0) {
      const newPath = folderPath.slice(0, -1);
      setFolderPath(newPath);
      setSelectedNavigationFolder(null); // Clear selection when going back
      
      if (newPath.length === 0) {
        // Back to root
        setCurrentFolderId(null);
        await loadFolders(null);
      } else {
        // Back to parent folder
        const parentFolder = newPath[newPath.length - 1];
        setCurrentFolderId(parentFolder.id);
        await loadFolders(parentFolder.id);
      }
    }
  };

  // Database-first template replacement (eliminates race conditions)
  const handleTemplateReplace = useCallback((packageId: string, packageName: string, templateIndex: number, newTemplate: ManualTemplate) => {
    console.log('🔄 SESSION-BASED TEMPLATE REPLACEMENT:', {
      packageId,
      packageName,
      templateIndex,
      newTemplateId: newTemplate.id,
      newTemplateName: newTemplate.name
    });
    
    // Clear any previous errors
    dispatchTemplate({ type: 'SET_ERROR', error: null });

    try {
      console.log('💾 Storing template replacement in session (no database modification)');
      
      // Store replacement in session overrides (does not modify database)
      dispatchTemplate({
        type: 'REPLACE_TEMPLATE_IN_SESSION',
        packageId,
        templateIndex,
        newTemplate
      });
      
      console.log('✅ Template replacement stored in session successfully');
      console.log('📝 Admin-configured base package remains unchanged in database');
    } catch (error) {
      console.error('❌ Template replacement failed:', error);
      
      dispatchTemplate({ 
        type: 'SET_ERROR', 
        error: `Failed to change template: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  }, []);

  // Add template to session (does not modify database)
  const handleTemplateAdd = useCallback((packageId: string, newTemplate: ManualTemplate) => {
    console.log('➕ Adding template to session:', {
      packageId,
      newTemplateId: newTemplate.id,
      newTemplateName: newTemplate.name
    });

    try {
      console.log('💾 Storing template addition in session (no database modification)');
      
      // Add template to session overrides (does not modify database)
      dispatchTemplate({
        type: 'ADD_TEMPLATE_TO_SESSION',
        packageId,
        template: newTemplate
      });
      
      console.log('✅ Template added to session successfully');
      console.log('📝 Admin-configured base package remains unchanged in database');
    } catch (error) {
      console.error('❌ Failed to add template to session:', error);
      dispatchTemplate({ 
        type: 'SET_ERROR', 
        error: `Failed to add template: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  }, []);
  
  // Delete template from session (only for additions)
  const handleTemplateDelete = useCallback((packageId: string, templateIndex: number) => {
    console.log('🗑️ Deleting template from session:', {
      packageId,
      templateIndex
    });
    
    try {
      // Delete template from session overrides
      dispatchTemplate({
        type: 'DELETE_TEMPLATE_FROM_SESSION',
        packageId,
        templateIndex
      });
      
      console.log('✅ Template deleted from session successfully');
    } catch (error) {
      console.error('❌ Failed to delete template from session:', error);
      dispatchTemplate({ 
        type: 'SET_ERROR', 
        error: `Failed to delete template: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    }
  }, []);

  // Utility function to transform Google Drive URLs to direct image URLs
  const transformGoogleDriveUrl = (url: string): string => {
    if (!url) return url;
    
    // Check if it's a Google Drive share URL
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    
    return url;
  };

  // Get thumbnail URL for package
  const getPackageThumbnailUrl = (pkg: ManualPackage): string | null => {
    if (!pkg.thumbnail_url) return null;
    return transformGoogleDriveUrl(pkg.thumbnail_url);
  };

  // Package Icon Component
  const PackageIcon = ({ pkg, size = "w-16 h-16", isUngrouped = false }: { 
    pkg: ManualPackage; 
    size?: string; 
    isUngrouped?: boolean; 
  }) => {
    const thumbnailUrl = getPackageThumbnailUrl(pkg);
    const [imageError, setImageError] = useState(false);

    if (thumbnailUrl && !imageError) {
      return (
        <div className={`${size} rounded-full overflow-hidden border-2 border-white shadow-sm mr-4 flex-shrink-0`}>
          <img
            src={thumbnailUrl}
            alt={`${pkg.name} thumbnail`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    // Fallback to icon
    const iconColors = isUngrouped 
      ? "from-gray-400 to-gray-600" 
      : "from-blue-400 to-blue-600";

    return (
      <div className={`${size} bg-gradient-to-br ${iconColors} rounded-full flex items-center justify-center mr-4 flex-shrink-0`}>
        <span className="text-white font-bold">📦</span>
      </div>
    );
  };

  // Load dynamic packages from manual package service
  const loadPackages = async () => {
    setIsLoadingPackages(true);
    setPackageError(null);
    try {
      // Load groups and packages separately
      const allGroups = await packageGroupService.getActiveGroups();
      const allPackages = await manualPackageService.getActivePackages();
      
      setGroups(allGroups);
      
      // Organize packages by group
      const grouped: { [groupId: string]: ManualPackage[] } = {};
      const ungrouped: ManualPackage[] = [];

      allPackages.forEach(pkg => {
        if (pkg.group_id) {
          if (!grouped[pkg.group_id]) {
            grouped[pkg.group_id] = [];
          }
          grouped[pkg.group_id].push(pkg);
        } else {
          ungrouped.push(pkg);
        }
      });

      // Sort packages within each group by sort_order
      Object.keys(grouped).forEach(groupId => {
        grouped[groupId].sort((a, b) => a.sort_order - b.sort_order);
      });
      
      ungrouped.sort((a, b) => a.sort_order - b.sort_order);

      setGroupedPackages(grouped);
      setUngroupedPackages(ungrouped);
      
      console.log('✅ Loaded', allPackages.length, 'packages from manual package service');
    } catch (error: any) {
      console.error('❌ Error loading packages:', error);
      setPackageError(error.message || 'Failed to load packages');
      // Fallback to empty arrays
      setGroups([]);
      setGroupedPackages({});
      setUngroupedPackages([]);
    } finally {
      setIsLoadingPackages(false);
    }
  };

  // Load photos from selected folder for template auto-fill
  const loadAvailablePhotos = async (folder: DriveFolder) => {
    try {
      console.log(`📸 Loading photos from folder for template auto-fill: ${folder.name}`);
      const photos = await googleDriveService.getPhotosFromFolder(folder.id);
      console.log(`📸 Loaded ${photos.length} photos for template auto-fill`);
      
      // Use more photos for better variety in template auto-fill (limit to 50 for performance)
      const photosForTemplates = photos.slice(0, 50);
      setAvailablePhotos(photosForTemplates);
      
      console.log(`📸 Using ${photosForTemplates.length} photos for template preview auto-fill`);
    } catch (error) {
      console.error('❌ Error loading photos for template auto-fill:', error);
      setAvailablePhotos([]); // Fallback to empty array
    }
  };

  // Handle individual template selection
  const handleTemplateSelect = (template: ManualTemplate) => {
    console.log('🎯 Individual template selected:', template.name);
    
    // Add to selected templates if not already selected
    setSelectedTemplates(prev => {
      const isAlreadySelected = prev.some(t => t.id === template.id);
      if (isAlreadySelected) {
        return prev.filter(t => t.id !== template.id); // Remove if already selected
      } else {
        return [...prev, template]; // Add to selection
      }
    });
  };

  // Load templates for the selected package with debugging
  const loadPackageTemplates = async (packageId: string, packageName: string) => {
    console.log('📋 Loading base templates for package:', {
      packageId,
      packageName,
      packageIdType: typeof packageId
    });
    
    // Check if we already have base templates for this package
    if (templateState.basePackageTemplates[packageId]) {
      console.log('📋 Using cached base templates for package:', packageId);
      dispatchTemplate({ type: 'SET_EXPANDED_PACKAGE', packageId });
      return;
    }
    
    dispatchTemplate({ type: 'SET_LOADING', packageId });
    dispatchTemplate({ type: 'SET_ERROR', error: null });
    
    try {
      console.log('🔄 Loading base templates from database (admin-configured, read-only)...');
      const packageWithTemplates = await manualPackageService.getPackageWithTemplates(packageId);
      
      console.log('📦 Base templates loaded:', {
        response: packageWithTemplates,
        hasResponse: !!packageWithTemplates,
        templates: packageWithTemplates?.templates,
        templatesCount: packageWithTemplates?.templates?.length || 0,
        templatesArray: Array.isArray(packageWithTemplates?.templates)
      });
      
      if (packageWithTemplates && packageWithTemplates.templates) {
        console.log('✅ Base templates found:', packageWithTemplates.templates.length);
        console.log('📋 Base template details:', packageWithTemplates.templates.map(t => ({
          id: t.id,
          name: t.name,
          type: t.template_type,
          printSize: t.print_size,
          hasHoles: !!t.holes_data,
          holesCount: t.holes_data?.length || 0
        })));
        
        // Store base templates (admin-configured, read-only)
        dispatchTemplate({
          type: 'SET_BASE_TEMPLATES',
          packageId,
          templates: packageWithTemplates.templates || []
        });
        dispatchTemplate({ type: 'SET_EXPANDED_PACKAGE', packageId });
        
        console.log('📝 Base templates preserved - client changes will be session-only');
      } else {
        console.log('⚠️ No base templates found or invalid response structure');
        // Store empty array for this package so we don't keep trying to load
        dispatchTemplate({
          type: 'SET_BASE_TEMPLATES',
          packageId,
          templates: []
        });
        dispatchTemplate({ type: 'SET_EXPANDED_PACKAGE', packageId });
      }
    } catch (error: any) {
      console.error('❌ Error loading base templates:', {
        error,
        message: error.message,
        stack: error.stack,
        packageId,
        packageName
      });
      dispatchTemplate({ type: 'SET_ERROR', error: error.message || 'Failed to load templates' });
      // Store empty array on error so we don't keep retrying
      dispatchTemplate({
        type: 'SET_BASE_TEMPLATES',
        packageId,
        templates: []
      });
      dispatchTemplate({ type: 'SET_EXPANDED_PACKAGE', packageId });
    } finally {
      dispatchTemplate({ type: 'SET_LOADING', packageId: null });
    }
  };

  // Load packages when component mounts or when showing package selection
  useEffect(() => {
    if (showPackageSelection) {
      setSelectedPackage(null); // Reset selected package when entering package selection
      dispatchTemplate({ type: 'SET_EXPANDED_PACKAGE', packageId: null }); // Reset expanded package
      dispatchTemplate({ type: 'CLEAR_ALL_TEMPLATES' }); // Clear cached templates
      loadPackages();
    }
  }, [showPackageSelection]);

  // Initialize folders on mount
  useEffect(() => {
    if (!showPackageSelection && clientFolders.length > 0) {
      setCurrentFolders(clientFolders);
    }
  }, [clientFolders, showPackageSelection]);

  const handleFolderSelect = (folder: DriveFolder) => {
    console.log('✅ Selecting folder as client folder:', folder.name);
    setSelectedFolder(folder);
    handleClientFolderSelect(folder); // Still call the original handler for data loading
    loadAvailablePhotos(folder); // Load photos for sample generation
    setShowPackageSelection(true); // Show package selection step
  };

  const handleBackToFolders = () => {
    setShowPackageSelection(false);
    setSelectedFolder(null);
    setSelectedPackage(null);
    dispatchTemplate({ type: 'SET_EXPANDED_PACKAGE', packageId: null });
    dispatchTemplate({ type: 'CLEAR_ALL_TEMPLATES' });
    // Reset navigation state
    setCurrentFolderId(null);
    setFolderPath([]);
    setSelectedNavigationFolder(null);
    loadFolders(null); // Reload root folders
  };

  const handlePackageContinue = () => {
    if (selectedFolder && selectedPackage) {
      // Get the effective templates (base + session overrides) to pass to photo screen
      const baseTemplates = templateState.basePackageTemplates[selectedPackage.id.toString()] || [];
      const sessionOverrides = templateState.sessionOverrides[selectedPackage.id.toString()];
      const effectiveTemplates = getEffectiveTemplates(baseTemplates, sessionOverrides);
      
      console.log('📋 Passing effective templates to photo screen:', {
        baseTemplatesCount: baseTemplates.length,
        sessionReplacements: Object.keys(sessionOverrides?.replacements || {}).length,
        sessionAdditions: sessionOverrides?.additions?.length || 0,
        effectiveTemplatesCount: effectiveTemplates.length,
        effectiveTemplates: effectiveTemplates.map(t => ({ id: t.id, name: t.name }))
      });
      
      handleContinue(effectiveTemplates); // Pass effective templates to photo screen
    }
  };

  const handleChangePackage = () => {
    setSelectedPackage(null);
    dispatchTemplate({ type: 'SET_EXPANDED_PACKAGE', packageId: null });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      {/* <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        FolderSelectionScreen.tsx
      </div> */}
      <HeaderNavigation
        googleAuth={googleAuth}
        mainSessionsFolder={mainSessionsFolder}
        onSignOut={onSignOut}
        onChangeMainFolder={onChangeMainFolder}
        showMainFolder={true}
        onManageTemplates={onManageTemplates}
        onManagePackages={onManagePackages}
        onAdminSettings={onAdminSettings}
      />
      
      <div className="p-2 sm:p-4">
        <div className="max-w-4xl mx-auto">
          
          {/* Step 1: Folder Selection */}
          {!showPackageSelection && (
            <>
              <div className="text-center mb-4 sm:mb-8">
                <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2">
                  Select Client Folder
                </h1>
                <p className="text-gray-600 text-sm sm:text-base md:text-lg">
                  Choose the client's photo session folder
                </p>
                <div className="mt-2 text-xs sm:text-sm text-blue-600">
                  Main folder: {selectedMainFolder?.name}
                </div>
              </div>

              <div className="bg-white rounded-lg p-3 sm:p-6 shadow-sm">
                {/* Breadcrumb Navigation */}
                {(folderPath.length > 0 || currentFolderId !== null) && (
                  <div className="mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-gray-200">
                    <div className="flex items-center flex-wrap gap-1 text-xs sm:text-sm">
                      {/* Root/Main Folder */}
                      <button
                        onClick={() => handleBreadcrumbClick(-1)}
                        className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-1 sm:px-2 py-0.5 sm:py-1 rounded transition-colors flex items-center"
                      >
                        <Folder className="w-3 sm:w-4 h-3 sm:h-4 mr-0.5 sm:mr-1" />
                        <span className="truncate max-w-[100px] sm:max-w-none">{selectedMainFolder?.name || 'Root'}</span>
                      </button>
                      
                      {/* Path folders */}
                      {folderPath.map((folder, index) => (
                        <div key={folder.id} className="flex items-center">
                          <ChevronRight className="w-3 sm:w-4 h-3 sm:h-4 text-gray-400 mx-0.5 sm:mx-1" />
                          <button
                            onClick={() => handleBreadcrumbClick(index)}
                            className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-1 sm:px-2 py-0.5 sm:py-1 rounded transition-colors"
                          >
                            <span className="truncate max-w-[80px] sm:max-w-none">{folder.name}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    {/* Back Button */}
                    {folderPath.length > 0 && (
                      <button
                        onClick={handleBackClick}
                        className="mt-2 sm:mt-3 flex items-center text-gray-600 hover:text-gray-800 text-xs sm:text-sm"
                      >
                        <ChevronLeft className="w-3 sm:w-4 h-3 sm:h-4 mr-0.5 sm:mr-1" />
                        <span className="truncate">Back to {folderPath.length > 1 ? folderPath[folderPath.length - 1].name : selectedMainFolder?.name}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* Loading state */}
                {isLoadingFolders ? (
                  <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-2 text-gray-600">Loading folders...</p>
                  </div>
                ) : (
                  <>
                    {/* Folder List */}
                    <div className="space-y-2 sm:space-y-3 max-h-[50vh] overflow-y-auto mb-3 sm:mb-4">
                      {currentFolders
                        .sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime())
                        .map((folder) => (
                        <FolderCard 
                          key={folder.id}
                          folder={folder}
                          isSelected={selectedNavigationFolder?.id === folder.id}
                          onClick={() => setSelectedNavigationFolder(folder)}
                        />
                      ))}
                    </div>

                    {/* Action Buttons - Only show when a folder is selected */}
                    {selectedNavigationFolder && (
                      <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                          <div className="text-xs sm:text-sm text-gray-600">
                            Selected: <span className="font-semibold text-gray-800 truncate">{selectedNavigationFolder.name}</span>
                          </div>
                        </div>
                        <div className="flex space-x-2 sm:space-x-3">
                          <button
                            onClick={() => {
                              handleFolderNavigate(selectedNavigationFolder);
                              setSelectedNavigationFolder(null);
                            }}
                            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-white border border-gray-300 sm:border-2 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center space-x-1 sm:space-x-2 text-sm sm:text-base font-medium text-gray-700"
                          >
                            <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            <span className="hidden sm:inline">Open Folder</span>
                            <span className="sm:hidden">Open</span>
                          </button>
                          
                          <button
                            onClick={() => {
                              handleFolderSelect(selectedNavigationFolder);
                              setSelectedNavigationFolder(null);
                            }}
                            className="flex-1 px-3 sm:px-4 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1 sm:space-x-2 text-sm sm:text-base font-medium"
                          >
                            <svg className="w-4 sm:w-5 h-4 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden sm:inline">Select as Client Folder</span>
                            <span className="sm:hidden">Select</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {currentFolders.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No folders found in this directory</p>
                        {folderPath.length > 0 && (
                          <button
                            onClick={handleBackClick}
                            className="mt-4 text-blue-600 hover:text-blue-800 text-sm underline"
                          >
                            Go back
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}

          {/* Step 2: Package Selection */}
          {showPackageSelection && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  Select Package
                </h1>
                <p className="text-gray-600 text-lg">
                  Choose your photo package for <span className="font-semibold text-blue-600">{selectedFolder?.name}</span>
                </p>
                
                <button
                  onClick={handleBackToFolders}
                  className="mt-4 text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  ← Change Client Folder
                </button>
              </div>

              {/* Loading State */}
              {isLoadingPackages && (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-600">Loading packages...</p>
                </div>
              )}

              {/* Error State */}
              {packageError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 text-center">
                  <p className="text-red-600 font-medium mb-2">Failed to load packages</p>
                  <p className="text-red-500 text-sm mb-4">{packageError}</p>
                  <button
                    onClick={loadPackages}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Grouped Packages Display */}
              {!isLoadingPackages && !packageError && (
                <>
                  {(groups.length > 0 || ungroupedPackages.length > 0) ? (
                    <div className="space-y-8">
                      {/* Display Groups */}
                      {groups.map((group) => (
                        <div key={group.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          {/* Group Header */}
                          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
                            {group.description && (
                              <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              {groupedPackages[group.id]?.length || 0} package{(groupedPackages[group.id]?.length || 0) === 1 ? '' : 's'}
                            </div>
                          </div>

                          {/* Packages in Group */}
                          <div className="p-4">
                            {groupedPackages[group.id]?.length > 0 ? (
                              <div className="space-y-3">
                                {groupedPackages[group.id].map((pkg) => (
                                  <div key={pkg.id} className="space-y-0">
                                    <div
                                      onClick={() => {
                                        const packageData = {
                                          id: pkg.id,
                                          name: pkg.name,
                                          templateCount: pkg.template_count || 1,
                                          price: pkg.price || 0,
                                          description: pkg.description || `${pkg.template_count || 1} template${(pkg.template_count || 1) === 1 ? '' : 's'}`
                                        };
                                        
                                        // DISABLED INLINE EXPANSION - Now navigates to PackageSelectionScreen
                                        // If this package is already expanded, collapse it
                                        // if (templateState.expandedPackageId === pkg.id.toString()) {
                                        //   dispatchTemplate({ type: 'SET_EXPANDED_PACKAGE', packageId: null });
                                        //   setSelectedPackage(null);
                                        // } else {
                                        //   // Expand this package and load templates
                                        //   setSelectedPackage(packageData);
                                        //   loadPackageTemplates(pkg.id.toString(), pkg.name);
                                        // }
                                        
                                        // NEW: Navigate to PackageSelectionScreen with selected package
                                        setSelectedPackage(packageData);
                                        handleContinue(); // This should navigate to 'package' screen
                                      }}
                                      className={`flex items-center p-4 rounded-lg cursor-pointer transition-all duration-200 border ${
                                        selectedPackage?.id === pkg.id
                                          ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200'
                                          : 'hover:bg-gray-50 border-gray-200 bg-white'
                                      }`}
                                    >
                                      {/* Package Icon */}
                                      <PackageIcon pkg={pkg} />
                                      
                                      {/* Package Info */}
                                      <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                          <div>
                                            <h4 className="text-lg font-bold text-gray-800">{pkg.name}</h4>
                                            <p className="text-sm text-gray-600 mt-1">
                                              {pkg.description || `${pkg.template_count} template${pkg.template_count === 1 ? '' : 's'}`}
                                            </p>
                                          </div>
                                          
                                          {/* Package Details */}
                                          <div className="text-right flex-shrink-0 ml-4">
                                            {pkg.price && (
                                              <div className="text-xl font-bold text-green-600">
                                                ₱{pkg.price.toLocaleString()}
                                              </div>
                                            )}
                                            <div className="text-sm text-blue-600 font-medium">
                                              {pkg.template_count} Print{pkg.template_count > 1 ? 's' : ''}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              {pkg.is_unlimited_photos ? 'Unlimited photos' : `${pkg.photo_limit} photos`}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Continue Arrow - only show when selected */}
                                      {selectedPackage?.id === pkg.id && (
                                        <div className="ml-3 flex items-center text-blue-500 text-xl font-medium">
                                          ⟩
                                        </div>
                                      )}
                                    </div>

                                    {/* DISABLED INLINE TEMPLATE PREVIEW - Now shown in PackageSelectionScreen */}
                                    {/* <AnimatedTemplateReveal show={templateState.expandedPackageId === pkg.id.toString()}>
                                      {templateState.expandedPackageId === pkg.id.toString() && (
                                        <PackageTemplatePreview
                                          templates={getEffectiveTemplates(
                                            templateState.basePackageTemplates[pkg.id.toString()] || [],
                                            templateState.sessionOverrides[pkg.id.toString()]
                                          )}
                                          packageName={pkg.name}
                                          packageId={pkg.id.toString()}
                                          onContinue={handlePackageContinue}
                                          onChangePackage={handleChangePackage}
                                          onTemplateSelect={handleTemplateSelect}
                                          availablePhotos={availablePhotos}
                                          loading={templateState.loadingPackageId === pkg.id.toString()}
                                          onTemplateReplace={(packageId, templateIndex, newTemplate) => 
                                            handleTemplateReplace(packageId, pkg.name, templateIndex, newTemplate)
                                          }
                                          onTemplateAdd={(newTemplate) => 
                                            handleTemplateAdd(pkg.id.toString(), newTemplate)
                                          }
                                          onTemplateDelete={(templateIndex) =>
                                            handleTemplateDelete(pkg.id.toString(), templateIndex)
                                          }
                                        />
                                      )}
                                    </AnimatedTemplateReveal> */}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <div className="text-4xl mb-2">📦</div>
                                <p className="text-sm">No packages in this group</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Ungrouped Packages */}
                      {ungroupedPackages.length > 0 && (
                        <div className="bg-white rounded-lg border border-dashed border-gray-300 overflow-hidden">
                          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-600">Other Packages</h3>
                            <p className="text-sm text-gray-500 mt-1">Additional package options</p>
                            <div className="text-xs text-gray-500 mt-1">
                              {ungroupedPackages.length} package{ungroupedPackages.length === 1 ? '' : 's'}
                            </div>
                          </div>
                          
                          <div className="p-4">
                            <div className="space-y-3">
                              {ungroupedPackages.map((pkg) => (
                                <div key={pkg.id} className="space-y-0">
                                  <div
                                    onClick={() => {
                                      const packageData = {
                                        id: pkg.id,
                                        name: pkg.name,
                                        templateCount: pkg.template_count || 1,
                                        price: pkg.price || 0,
                                        description: pkg.description || `${pkg.template_count || 1} template${(pkg.template_count || 1) === 1 ? '' : 's'}`
                                      };
                                      
                                      // DISABLED INLINE EXPANSION - Now navigates to PackageSelectionScreen
                                      // If this package is already expanded, collapse it
                                      // if (templateState.expandedPackageId === pkg.id.toString()) {
                                      //   dispatchTemplate({ type: 'SET_EXPANDED_PACKAGE', packageId: null });
                                      //   setSelectedPackage(null);
                                      // } else {
                                      //   // Expand this package and load templates
                                      //   setSelectedPackage(packageData);
                                      //   loadPackageTemplates(pkg.id.toString(), pkg.name);
                                      // }
                                      
                                      // NEW: Navigate to PackageSelectionScreen with selected package
                                      setSelectedPackage(packageData);
                                      handleContinue(); // This should navigate to 'package' screen
                                    }}
                                    className={`flex items-center p-4 rounded-lg cursor-pointer transition-all duration-200 border ${
                                      selectedPackage?.id === pkg.id
                                        ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200'
                                        : 'hover:bg-gray-50 border-gray-200 bg-white'
                                    }`}
                                  >
                                    {/* Package Icon */}
                                    <PackageIcon pkg={pkg} isUngrouped={true} />
                                    
                                    {/* Package Info */}
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <h4 className="text-lg font-bold text-gray-800">{pkg.name}</h4>
                                          <p className="text-sm text-gray-600 mt-1">
                                            {pkg.description || `${pkg.template_count} template${pkg.template_count === 1 ? '' : 's'}`}
                                          </p>
                                        </div>
                                        
                                        {/* Package Details */}
                                        <div className="text-right flex-shrink-0 ml-4">
                                          {pkg.price && (
                                            <div className="text-xl font-bold text-green-600">
                                              ₱{pkg.price.toLocaleString()}
                                            </div>
                                          )}
                                          <div className="text-sm text-blue-600 font-medium">
                                            {pkg.template_count} Print{pkg.template_count > 1 ? 's' : ''}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {pkg.is_unlimited_photos ? 'Unlimited photos' : `${pkg.photo_limit} photos`}
                                          </div>
                                        </div>
                                      </div>
                                      
                                      {/* Continue Arrow - only show when selected */}
                                      {selectedPackage?.id === pkg.id && (
                                        <div className="ml-3 flex items-center text-blue-500 text-xl font-medium">
                                          ⟩
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* DISABLED INLINE TEMPLATE PREVIEW - Now shown in PackageSelectionScreen */}
                                  {/* <AnimatedTemplateReveal show={templateState.expandedPackageId === pkg.id.toString()}>
                                    {templateState.expandedPackageId === pkg.id.toString() && (
                                      <PackageTemplatePreview
                                        templates={getEffectiveTemplates(
                                          templateState.basePackageTemplates[pkg.id.toString()] || [],
                                          templateState.sessionOverrides[pkg.id.toString()]
                                        )}
                                        packageName={pkg.name}
                                        packageId={pkg.id.toString()}
                                        onContinue={handlePackageContinue}
                                        onChangePackage={handleChangePackage}
                                        onTemplateSelect={handleTemplateSelect}
                                        availablePhotos={availablePhotos}
                                        loading={templateState.loadingPackageId === pkg.id.toString()}
                                        onTemplateReplace={(packageId, templateIndex, newTemplate) => 
                                          handleTemplateReplace(packageId, pkg.name, templateIndex, newTemplate)
                                        }
                                        onTemplateAdd={(newTemplate) => 
                                          handleTemplateAdd(pkg.id.toString(), newTemplate)
                                        }
                                        onTemplateDelete={(templateIndex) =>
                                          handleTemplateDelete(pkg.id.toString(), templateIndex)
                                        }
                                      />
                                    )}
                                  </AnimatedTemplateReveal> */}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-4xl mb-4">📦</div>
                      <p className="text-gray-600 font-medium mb-2">No packages found</p>
                      <p className="text-gray-500 text-sm mb-4">Create packages in the Package Manager to get started</p>
                      {onManagePackages && (
                        <button
                          onClick={onManagePackages}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Manage Packages
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
} 