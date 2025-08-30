import { Package, TemplateSlot, Photo, GoogleAuth, TemplateType, PrintSize, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform, createPhotoTransform, createSmartPhotoTransformFromSlot, ManualPackage, ManualTemplate } from '../../types';
import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import toast from 'react-hot-toast';
import ConfirmationModal from '../ConfirmationModal';
import InlineTemplateEditor from '../InlineTemplateEditor';
import InlinePhotoEditor from '../InlinePhotoEditor';
import FullscreenPhotoViewer from '../FullscreenPhotoViewer';
import PhotoRenderer from '../PhotoRenderer';
import FullscreenTemplateSelector from '../FullscreenTemplateSelector';
import PhotoSelectionMode from '../PhotoSelectionMode';
import SlidingTemplateBar from '../SlidingTemplateBar';
import { manualTemplateService } from '../../services/manualTemplateService';
import { templateRasterizationService } from '../../services/templateRasterizationService';
import { templateSyncService } from '../../services/templateSyncService';
import { printSizeService } from '../../services/printSizeService';
import UploadOptionsModal from '../UploadOptionsModal';
import { photoCacheService } from '../../services/photoCacheService';
import PngTemplateVisual from '../PngTemplateVisual';
import PhotoGrid from '../PhotoGrid';
import TemplateGrid from '../TemplateGrid';
import TemplateSelectionModal from '../TemplateSelectionModal';
import AddPrintsModal from '../AddPrintsModal';
import FavoritesBar from '../FavoritesBar';
import OriginalTemplateVisual from '../TemplateVisual';
import { setupViewportHandler, getViewportInfo } from '../../utils/viewportUtils';
// NOTE: Added viewport utilities for iPad Safari compatibility


// Simplified TemplateVisual component
const TemplateVisual = ({ template, slots, onSlotClick, photos, selectedSlot, inlineEditingSlot, inlineEditingPhoto, onInlineApply, onInlineCancel, skipStateGuard, isActiveTemplate = true, slotShowingRemoveConfirmation, onConfirmRemove, onCancelRemove, onDropPhoto, isDraggingPhoto, previewSlotId, previewPhotoId, onSetPreviewSlot }: any) => {
  // Get templates from both window cache AND database to ensure consistency with swap modal
  const windowTemplates = (window as any).pngTemplates || [];
  const [databaseTemplates, setDatabaseTemplates] = useState<any[]>([]);
  
  // Load all templates from database for consistent template matching
  useEffect(() => {
    const loadAllTemplates = async () => {
      try {
        const allDbTemplates = await manualTemplateService.getActiveTemplates();
        const convertedTemplates = allDbTemplates.map(template => ({
          ...template,
          holes: template.holes_data,
          driveFileId: template.drive_file_id
        }));
        setDatabaseTemplates(convertedTemplates);
        console.log('📋 Loaded all templates from database for consistent matching:', {
          totalCount: convertedTemplates.length,
          types: [...new Set(convertedTemplates.map(t => t.template_type))]
        });
      } catch (error) {
        console.error('❌ Failed to load templates from database:', error);
        setDatabaseTemplates([]);
      }
    };
    
    loadAllTemplates();
  }, []);
  
  // Use window templates (selected from package) or fall back to database templates
  const pngTemplates = windowTemplates.length > 0 ? windowTemplates : databaseTemplates;
  
  // Find PNG template using slot's templateType for better accuracy after swaps
  const templateType = slots[0]?.templateType || template.id;
  
  // STATE GUARD: Prevent rendering with mismatched template data during navigation
  // Skip validation during user-initiated apply actions to prevent loading flash
  const isDataConsistent = skipStateGuard || slots.every((slot: any) => {
    const slotTemplateType = slot.templateType || slot.templateId?.split('_')[0];
    return !slotTemplateType || slotTemplateType === templateType || slotTemplateType === template.id;
  });
  
  if (!isDataConsistent) {
    console.warn('🛡️ STATE GUARD - Blocking render due to mismatched template data:', {
      expectedTemplateType: templateType,
      templateId: template.id,
      slotTemplateTypes: slots.map((s: any) => s.templateType),
      reason: 'Template data mismatch during navigation - waiting for consistent state'
    });
    // Return a simple loading state instead of rendering with wrong data
    return <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded">
      <div className="text-gray-500">Loading...</div>
    </div>;
  }
  
  // NAVIGATION DEBUG: Track what we receive each time this component renders
  console.log('🔄 NAVIGATION DEBUG - TemplateVisual render:', {
    timestamp: new Date().toISOString(),
    templateId: template.id,
    templateName: template.name,
    derivedTemplateType: templateType,
    slotsCount: slots.length,
    slotsData: slots.map((s: any) => ({
      id: s.id,
      templateId: s.templateId,
      templateType: s.templateType,
      templateName: s.templateName,
      hasPhoto: !!s.photoId,
      slotIndex: s.slotIndex
    })),
    pngTemplatesAvailable: pngTemplates.length,
    templateTypeFromSlots: templateType,
    // Track where templateType comes from
    templateTypeSource: slots[0]?.templateType ? 'slots[0].templateType' : 'template.id',
    slots0TemplateType: slots[0]?.templateType,
    templateIdValue: template.id
  });
  
  // ENHANCED: Safety check with detailed template type analysis
  if (pngTemplates.length === 0) {
    console.error('🚨 CRITICAL ERROR - No PNG templates found in window.pngTemplates');
    console.log('🔧 This will cause template swapping to fail. Check hybridTemplateService loading.');
  } else {
    // Dynamic template types - get available types from loaded templates
    const availableTypes = [...new Set(pngTemplates.map((t: any) => t.template_type || t.templateType))];
    
    console.log('✅ TEMPLATE DEBUG - PNG templates analysis:', {
      totalCount: pngTemplates.length,
      availableTemplateTypes: availableTypes,
      searchingFor: templateType,
      templatesForCurrentType: pngTemplates.filter((t: any) => 
        t.template_type === templateType || t.templateType === templateType
      ).map((t: any) => ({
        name: t.name,
        template_type: t.template_type,
        templateType: t.templateType,
        id: t.id
      }))
    });
  }
  
  console.log('🔍 TEMPLATE DEBUG - TemplateVisual matching:', {
    templateType,
    templateId: template.id,
    availableTemplates: pngTemplates.map((t: any) => ({ 
      id: t.id, 
      name: t.name, 
      template_type: t.template_type,
      templateType: t.templateType 
    })),
    slotsTemplateTypes: slots.map((s: any) => s.templateType),
    slotsDetails: slots.map((s: any) => ({ 
      id: s.id, 
      templateId: s.templateId, 
      templateType: s.templateType, 
      photoId: s.photoId 
    }))
  });
  
  // Strict template matching - NO fallbacks, NO hardcoding
  let pngTemplate = null;
  
  if (pngTemplates.length > 0 && templateType) {
    // Find exact template by ID (templateType now contains the unique template ID)
    // First try direct UUID match, then fall back to type+size matching for compatibility
    let candidateTemplate = pngTemplates.find((t: any) => t.id === templateType || t.id.toString() === templateType);
    
    // If not found by UUID, try matching by template_type and print_size (for dynamically added templates)
    if (!candidateTemplate && slots[0]) {
      candidateTemplate = pngTemplates.find((t: any) => 
        t.template_type === slots[0].templateType && 
        t.print_size === slots[0].printSize
      );
      console.log('🔄 Fallback template matching by type+size:', {
        searchedType: slots[0].templateType,
        searchedSize: slots[0].printSize,
        found: !!candidateTemplate,
        candidateName: candidateTemplate?.name
      });
    }
    
    if (candidateTemplate) {
      // Strict compatibility check: template holes must match expected slots
      const templateHoles = candidateTemplate.holes?.length || 0;
      const expectedSlots = slots.length;
      
      if (templateHoles === expectedSlots) {
        pngTemplate = candidateTemplate;
        console.log('✅ Compatible template found:', {
          templateName: pngTemplate.name,
          templateType: pngTemplate.template_type,
          holes: templateHoles,
          slots: expectedSlots,
          compatible: true
        });
      } else {
        console.error('❌ TEMPLATE INCOMPATIBLE - Hole count mismatch:', {
          templateName: candidateTemplate.name,
          templateType: candidateTemplate.template_type,
          templateHoles: templateHoles,
          expectedSlots: expectedSlots,
          compatible: false,
          willShowError: true
        });
      }
    } else {
      console.error('❌ NO TEMPLATE MATCH - Template type not found in database:', {
        searchedTemplateType: templateType,
        availableTypes: [...new Set(pngTemplates.map((t: any) => t.template_type))],
        totalTemplatesInDB: pngTemplates.length,
        slotsLookingFor: slots.length,
        thisWillShowError: true
      });
    }
  } else {
    console.warn('⚠️ Invalid template matching state:', {
      pngTemplatesCount: pngTemplates.length,
      templateType: templateType,
      hasValidTemplateType: !!templateType
    });
  }

  // Final matching decision - strict, no fallbacks
  console.log('🎯 Template matching decision:', {
    searchedFor: templateType,
    found: !!pngTemplate,
    templateName: pngTemplate?.name || 'NOT FOUND',
    slotsExpected: slots.length,
    templateHoles: pngTemplate?.holes?.length || 0,
    willRenderCorrectly: !!pngTemplate
  });

  // Render result: either exact match or error state
  if (pngTemplate) {
    console.log('✅ Rendering exact template match:', pngTemplate.name);
    return (
      <PngTemplateVisual
        pngTemplate={pngTemplate}
        templateSlots={slots}
        onSlotClick={onSlotClick}
        photos={photos}
        selectedSlot={selectedSlot}
        inlineEditingSlot={inlineEditingSlot}
        inlineEditingPhoto={inlineEditingPhoto}
        onInlineApply={onInlineApply}
        onInlineCancel={onInlineCancel}
        isActiveTemplate={isActiveTemplate}
        onDropPhoto={onDropPhoto}
      />
    );
  }

  // No compatible template found - show detailed error state
  const candidateTemplate = pngTemplates.find((t: any) => t.template_type === templateType);
  const availableTypes = [...new Set(pngTemplates.map((t: any) => t.template_type))];
  
  console.log('❌ Template error, showing detailed error state for:', templateType);
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-red-50 border-2 border-red-200 rounded-lg p-4">
      <div className="text-red-600 text-4xl mb-4">⚠️</div>
      <h3 className="text-red-800 font-bold text-lg mb-2">Template Issue</h3>
      
      {candidateTemplate ? (
        // Template exists but incompatible
        <div className="text-center">
          <p className="text-red-700 mb-3">
            Template <span className="font-mono bg-red-100 px-2 py-1 rounded">{candidateTemplate.name}</span> found but incompatible
          </p>
          <div className="text-sm text-red-600 space-y-1">
            <p>Template holes: <span className="font-bold">{candidateTemplate.holes?.length || 0}</span></p>
            <p>Expected slots: <span className="font-bold">{slots.length}</span></p>
            <p className="mt-3 font-medium">Hole count must match slot count exactly.</p>
          </div>
        </div>
      ) : (
        // Template type not found
        <div className="text-center">
          <p className="text-red-700 mb-3">
            No template found for type: <span className="font-mono bg-red-100 px-2 py-1 rounded">{templateType}</span>
          </p>
          <div className="text-sm text-red-600">
            <p>Available types: {availableTypes.length > 0 ? availableTypes.join(', ') : 'None'}</p>
            <p className="mt-2">Please add a <strong>{templateType}</strong> template to the database.</p>
          </div>
        </div>
      )}
    </div>
  );
};

interface PhotoSelectionScreenProps {
  clientName: string;
  selectedPackage: Package | ManualPackage | null;
  googleAuth: GoogleAuth;
  templateSlots: TemplateSlot[];
  selectedSlot: TemplateSlot | null;
  photos: Photo[];
  getTotalTemplateCount: () => number;
  handlePhotoContinue: () => void;
  handleTemplateUpload?: () => void;
  handlePhotoUpload?: (favoritedPhotos: Photo[]) => void;
  isUploading?: boolean;
  uploadProgress?: { current: number; total: number; templateName: string } | null;
  handlePhotoSelect: (photo: Photo) => void;
  handleSlotSelect: (slot: TemplateSlot) => void;
  totalAllowedPrints: number;
  setSelectedSlot: (slot: TemplateSlot | null) => void;
  setTemplateSlots: (slots: TemplateSlot[]) => void;
  onBackToPackage?: () => void;
  favoritedPhotos: Set<string>;
  setFavoritedPhotos: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export default function PhotoSelectionScreen({
  clientName,
  selectedPackage,
  googleAuth,
  templateSlots,
  selectedSlot,
  photos,
  getTotalTemplateCount,
  handlePhotoContinue,
  handleTemplateUpload,
  handlePhotoUpload,
  isUploading = false,
  uploadProgress = null,
  handlePhotoSelect,
  handleSlotSelect,
  totalAllowedPrints,
  setSelectedSlot,
  setTemplateSlots,
  onBackToPackage,
  favoritedPhotos,
  setFavoritedPhotos,
}: PhotoSelectionScreenProps) {
  console.log('📷 PhotoSelectionScreen rendered with:', {
    photosCount: photos.length,
    clientName,
    templateSlotsCount: templateSlots.length,
    firstPhotoSample: photos[0] ? { id: photos[0].id, name: photos[0].name, url: photos[0].url } : 'No photos'
  });
  
  const [editingTemplate, setEditingTemplate] = useState<TemplateSlot[] | null>(null);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<ManualTemplate[]>([]);
  const [isApplyingPhoto, setIsApplyingPhoto] = useState(false);
  
  // NOTE: Removed viewport constraints - using fixed height layout now
  
  // Two-mode system for photo selection
  const [selectionMode, setSelectionMode] = useState<'photo' | 'print'>('photo'); // Default to photo selection mode
  // NOTE: favoritedPhotos now comes from props, not local state
  
  // NOTE: Removed expansion state - using fixed height layout now
  
  // Note: Debug logging removed - viewport-aware expansion is working correctly in both modes

  
  // Simplified workflow states
  const [viewMode, setViewMode] = useState<'normal' | 'photo-viewer' | 'sliding-templates' | 'template-first' | 'photo-selection' | 'inline-editing'>('normal');
  const [selectedPhotoForViewer, setSelectedPhotoForViewer] = useState<Photo | null>(null);
  const [selectedPhotoForTemplate, setSelectedPhotoForTemplate] = useState<Photo | null>(null);
  const [selectedTemplateForViewer, setSelectedTemplateForViewer] = useState<string | null>(null);
  const [selectedSlotForEditor, setSelectedSlotForEditor] = useState<TemplateSlot | null>(null);
  const [isSelectingPhoto, setIsSelectingPhoto] = useState(false); // Track when user is selecting photo for empty slot
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false); // Track when dragging a photo
  const [previewSlotId, setPreviewSlotId] = useState<string | null>(null); // Track which slot is being previewed
  const [previewPhotoId, setPreviewPhotoId] = useState<string | null>(null); // Track which photo is being previewed
  
  // Replacement confirmation state
  const [pendingReplacement, setPendingReplacement] = useState<{slot: TemplateSlot, photoId: string} | null>(null);
  const [showReplaceConfirmation, setShowReplaceConfirmation] = useState(false);
  
  // Handle escape key to close photo selection mode
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSelectingPhoto) {
        setIsSelectingPhoto(false);
        setSelectedSlot(null);
      }
    };
    
    if (isSelectingPhoto) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isSelectingPhoto]);
  
  // Inline editing states
  const [inlineEditingSlot, setInlineEditingSlot] = useState<TemplateSlot | null>(null);
  const [inlineEditingPhoto, setInlineEditingPhoto] = useState<Photo | null>(null);
  
  // Remove confirmation state - kept for replacement confirmation
  const [slotShowingRemoveConfirmation, setSlotShowingRemoveConfirmation] = useState<TemplateSlot | null>(null);
  
  // Incomplete slots warning
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  
  // Double-tap navigation states
  const [lastTapTime, setLastTapTime] = useState(0);
  const [showBackToPackageConfirm, setShowBackToPackageConfirm] = useState(false);
  
  // Template management states (simplified)
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateToChange, setTemplateToChange] = useState<{template: ManualTemplate, index: number} | null>(null);
  const [templateToView, setTemplateToView] = useState<{ templateId: string; templateName: string; slots: TemplateSlot[] } | null>(null);
  const [templateReplacements, setTemplateReplacements] = useState<Record<number, ManualTemplate>>({});
  
  // Add Prints modal state
  const [showAddPrintsModal, setShowAddPrintsModal] = useState(false);
  
  // Delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  // Setup viewport handling for iPad Safari compatibility
  useEffect(() => {
    const cleanup = setupViewportHandler((info) => {
      console.log('📱 PhotoSelectionScreen viewport update:', {
        dimensions: `${info.width}×${info.height}`,
        visualHeight: info.visualHeight,
        isIpad: info.isIpad,
        needsAdjustment: info.height !== info.visualHeight
      });
    });
    
    return cleanup;
  }, []);

  // Batch preload all photos when screen mounts
  useEffect(() => {
    if (photos && photos.length > 0) {
      console.log(`🚀 Starting batch preload of ${photos.length} photos`);
      
      // First, preload favorited photos with highest priority
      if (favoritedPhotos.size > 0) {
        const favPhotos = photos.filter(p => favoritedPhotos.has(p.id));
        console.log(`⭐ Prioritizing preload of ${favPhotos.length} favorited photos`);
        photoCacheService.batchPreloadPhotos(favPhotos, { 
          priority: 'high',
          concurrency: 5 
        });
      }
      
      // Then preload first 20 photos with high priority
      const visiblePhotos = photos.slice(0, 20);
      photoCacheService.batchPreloadPhotos(visiblePhotos, { 
        priority: 'high',
        concurrency: 4
      });
      
      // Preload remaining photos in background with lower priority
      if (photos.length > 20) {
        setTimeout(() => {
          const remainingPhotos = photos.slice(20);
          console.log(`📦 Preloading remaining ${remainingPhotos.length} photos in background`);
          photoCacheService.batchPreloadPhotos(remainingPhotos, { 
            priority: 'low',
            concurrency: 2,
            onProgress: (loaded, total) => {
              if (loaded % 10 === 0 || loaded === total) {
                console.log(`📊 Background preload progress: ${loaded}/${total}`);
              }
            }
          });
        }, 1000);
      }
    }
  }, [photos]); // Removed favoritedPhotos dependency to avoid re-preloading on favorite changes

  // Sync all completed templates on mount and when slots/photos change
  useEffect(() => {
    // Only sync if we have both slots and photos AND service is initialized
    if (templateSlots.length > 0 && photos.length > 0 && templateSyncService.getIsInitialized()) {
      console.log('🚀 Initial sync check for all completed templates');
      syncAllCompletedTemplates(templateSlots);
    } else if (templateSlots.length > 0 && photos.length > 0) {
      console.log('⏸️ Skipping initial sync - sync service not initialized');
    }
  }, []); // Only run once on mount
  
  // Update sync status periodically
  useEffect(() => {
    const updateSyncStatus = () => {
      const status = templateSyncService.getSyncStatus();
      setSyncStatus({
        isInitialized: status.isInitialized,
        isProcessing: status.isProcessing,
        queueSize: status.queueSize,
        syncedCount: status.syncedTemplates
      });
    };
    
    // Initial update
    updateSyncStatus();
    
    // Update every second while processing
    const interval = setInterval(updateSyncStatus, 1000);
    
    return () => clearInterval(interval);
  }, []);

  // Load available templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        // Use database directly - simple and reliable
        const dbTemplates = await manualTemplateService.getActiveTemplates();
        console.log('🔄 PhotoSelectionScreen - Loaded database templates:', {
          totalCount: dbTemplates.length,
          templateTypes: [...new Set(dbTemplates.map(t => t.template_type))],
          templateNames: dbTemplates.map(t => t.name),
          printSizes: [...new Set(dbTemplates.map(t => t.print_size))]
        });
        setAvailableTemplates(dbTemplates);
      } catch (error) {
        console.error('❌ Error loading templates:', error);
        setAvailableTemplates([]);
      }
    };
    loadTemplates();
  }, []);


  // No auto-selection - user must manually select slots
  // This gives the user full control over which slot to work with


  const onSlotSelect = (slot: TemplateSlot) => {
    setSelectedSlot(slot);
    const templateToEdit = templateSlots.filter(s => s.templateId === slot.templateId);
    setEditingTemplate(templateToEdit);
    
    // NOTE: Removed expansion logic - using fixed height layout now
  };

  const handleInlineEditorClose = () => {
    setEditingTemplate(null);
  };


  const handleInlineTransformChange = (slotId: string, transform: { scale: number; x: number; y: number }) => {
    const updatedSlots = templateSlots.map(s =>
      s.id === slotId ? { ...s, transform } : s
    );
    setTemplateSlots(updatedSlots);
    
    // Sync ALL completed templates (transforms may affect multiple templates)
    syncAllCompletedTemplates(updatedSlots);
  };


  const [templateToNavigate, setTemplateToNavigate] = useState<string | null>(null);
  
  // Sync status tracking
  const [syncStatus, setSyncStatus] = useState<{
    isInitialized: boolean;
    isProcessing: boolean;
    queueSize: number;
    syncedCount: number;
  }>({ isInitialized: false, isProcessing: false, queueSize: 0, syncedCount: 0 });

  const handleTemplateAdd = (template: ManualTemplate) => {
    // Create new slots for the added template
    const newSlotsToAdd: TemplateSlot[] = [];
    
    // Find the next available index for a new template to ensure unique IDs
    const existingTemplateIds = new Set(templateSlots.map(s => s.templateId));
    const nextTemplateIndex = existingTemplateIds.size;
    
    const newTemplateId = `${template.id}_${nextTemplateIndex}`;
    
    for (let slotIndex = 0; slotIndex < template.holes_data.length; slotIndex++) {
      newSlotsToAdd.push({
        id: `${newTemplateId}_${slotIndex}`,
        templateId: newTemplateId,
        templateName: template.name,
        templateType: template.id.toString() as TemplateType,
        printSize: template.print_size as PrintSize,
        slotIndex,
        photoId: undefined,
        isAdditional: true // Mark as additional print added via Add Prints button
      });
    }
    
    // Add the template to window cache so it can be found later
    const windowTemplates = (window as any).pngTemplates || [];
    const convertedTemplate = {
      ...template,
      holes: template.holes_data,
      driveFileId: template.drive_file_id
    };
    
    // Check if template already exists in cache
    const existsInCache = windowTemplates.some((t: any) => t.id === template.id);
    if (!existsInCache) {
      windowTemplates.push(convertedTemplate);
      (window as any).pngTemplates = windowTemplates;
      console.log('✅ Added template to window cache:', {
        templateId: template.id,
        templateName: template.name,
        cacheSize: windowTemplates.length
      });
    }
    
    // Update template slots
    setTemplateSlots([...templateSlots, ...newSlotsToAdd]);
    
    // Set the new template ID to navigate to
    setTemplateToNavigate(newTemplateId);
    
    toast.success(`Added ${template.name} template`);
  };

  const handleDeletePrint = (templateIdToDelete: string) => {
    // Check if template is additional (can be deleted) or original (protected)
    const slotsToDelete = templateSlots.filter(s => s.templateId === templateIdToDelete);
    if (slotsToDelete.length > 0 && !slotsToDelete[0].isAdditional) {
      toast.error('Cannot delete original package templates. Only added prints can be removed.', {
        duration: 4000,
        icon: '🚫'
      });
      return;
    }
    
    // Store the template ID and show confirmation modal
    setTemplateToDelete(templateIdToDelete);
    setShowDeleteConfirm(true);
  };
  
  const handleConfirmDelete = () => {
    if (!templateToDelete) return;
    
    // Original delete logic moved here
    const templateIdToDelete = templateToDelete;
    
    // Delete from Google Drive sync immediately
    console.log('🗑️ Deleting template from Drive sync:', templateIdToDelete);
    templateSyncService.deleteFromDrive(templateIdToDelete);
    
      // Get current template groups before deletion
      const currentGroups = Object.values(
        templateSlots.reduce((acc, slot) => {
          if (!acc[slot.templateId]) {
            acc[slot.templateId] = {
              templateId: slot.templateId,
              templateName: slot.templateName,
              slots: [],
            };
          }
          acc[slot.templateId].slots.push(slot);
          return acc;
        }, {} as Record<string, { templateId: string; templateName: string; slots: TemplateSlot[] }>)
      );
      
      // Find the index of the template being deleted
      const deletedIndex = currentGroups.findIndex(group => group.templateId === templateIdToDelete);
      
      // Remove the template slots
      const newTemplateSlots = templateSlots.filter(s => s.templateId !== templateIdToDelete);
      setTemplateSlots(newTemplateSlots);

      // If the currently selected slot was part of the deleted template, deselect it
      if (selectedSlot?.templateId === templateIdToDelete) {
        setSelectedSlot(null);
      }
      
      // Auto-navigate to next available template
      if (newTemplateSlots.length > 0) {
        // Get the new template groups after deletion
        const newGroups = Object.values(
          newTemplateSlots.reduce((acc, slot) => {
            if (!acc[slot.templateId]) {
              acc[slot.templateId] = {
                templateId: slot.templateId,
                templateName: slot.templateName,
                slots: [],
              };
            }
            acc[slot.templateId].slots.push(slot);
            return acc;
          }, {} as Record<string, { templateId: string; templateName: string; slots: TemplateSlot[] }>)
        );
        
        if (newGroups.length > 0) {
          // Determine which template to navigate to
          let targetTemplateId: string;
          
          if (deletedIndex < newGroups.length) {
            // Navigate to the template at the same index (next template took its place)
            targetTemplateId = newGroups[deletedIndex].templateId;
          } else if (deletedIndex > 0) {
            // Was the last template, navigate to the previous one
            targetTemplateId = newGroups[deletedIndex - 1].templateId;
          } else {
            // Fallback to first template
            targetTemplateId = newGroups[0].templateId;
          }
          
          console.log('🔄 Auto-navigating after deletion to template:', targetTemplateId);
          setTemplateToNavigate(targetTemplateId);
        }
      }
      
      // Clear the state after deletion
      setTemplateToDelete(null);
      setShowDeleteConfirm(false);
      
      toast.success('Template deleted successfully');
  };

  // New workflow handlers
  
  // Photo-first workflow
  // Helper function to sync ALL completed templates
  const syncAllCompletedTemplates = (slots: TemplateSlot[]) => {
    // Guard: Only sync if service is initialized
    if (!templateSyncService.getIsInitialized()) {
      console.log('⚠️ Sync service not initialized, skipping template sync');
      return;
    }
    
    // Get all unique template IDs
    const templateIds = new Set(slots.map(s => s.templateId));
    console.log('🔍 Checking ALL templates for completion:', {
      totalTemplates: templateIds.size,
      templateIds: Array.from(templateIds)
    });
    
    let completedCount = 0;
    let syncedTemplates: string[] = [];
    
    // Check each template for completion
    templateIds.forEach(templateId => {
      const templateSpecificSlots = slots.filter(s => s.templateId === templateId);
      const isComplete = templateSpecificSlots.length > 0 && 
                        templateSpecificSlots.every(s => s.photoId);
      
      if (isComplete) {
        completedCount++;
        syncedTemplates.push(templateId);
        console.log(`✅ Template ${templateId} is complete (${templateSpecificSlots.length} slots filled)`);
        templateSyncService.queueTemplateSync(templateId, slots, photos);
      } else {
        const filledSlots = templateSpecificSlots.filter(s => s.photoId).length;
        console.log(`⏸️ Template ${templateId} is incomplete (${filledSlots}/${templateSpecificSlots.length} slots filled)`);
      }
    });
    
    console.log('📊 Sync summary:', {
      totalTemplates: templateIds.size,
      completedTemplates: completedCount,
      syncedTemplateIds: syncedTemplates
    });
  };

  const handlePhotoClick = (photo: Photo) => {
    console.log('🔧 PHOTO CLICK DEBUG:', {
      photoId: photo.id,
      photoName: photo.name,
      currentViewMode: viewMode,
      currentSelectionMode: selectionMode,
      hasSelectedSlot: !!selectedSlot,
      selectedSlotId: selectedSlot?.id,
      isInlineEditing: viewMode === 'inline-editing',
      currentInlineEditingSlot: inlineEditingSlot?.id,
      currentInlineEditingPhoto: inlineEditingPhoto?.name
    });

    // NOTE: Removed collapse logic - using fixed height layout now

    // Check if we're in inline editing mode first
    if (viewMode === 'inline-editing') {
      console.log('🔧 In inline editing mode - photo selection disabled');
      // Don't allow photo switching during editing - user must save or cancel first
      return;
    }
    
    // In print mode with selected slot and favorites expanded - start inline editing
    if (selectionMode === 'print' && selectedSlot && isSelectingPhoto) {
      console.log('🔧 Starting inline editing from expanded favorites:', {
        photo: photo.name,
        slotId: selectedSlot.id
      });
      
      // Calculate smart transform for initial position, then start inline editing
      createSmartPhotoTransformFromSlot(photo, selectedSlot)
        .then(smartTransform => {
          console.log('📐 Smart transform calculated for initial position:', smartTransform);
          
          // Apply photo to slot with smart transform first
          // This ensures the photo is in the slot for inline editing
          const updatedSlots = templateSlots.map(s => {
            if (s.id === selectedSlot.id) {
              return {
                ...s,
                photoId: photo.id,
                transform: smartTransform
              };
            }
            return s;
          });
          setTemplateSlots(updatedSlots);
          
          // Sync ALL completed templates
          syncAllCompletedTemplates(updatedSlots);
          
          // Direct manipulation - photos are immediately interactive
          setIsSelectingPhoto(false); // Close expanded favorites bar
          
          console.log('✅ Photo applied with smart transform - inline editor opened for adjustment');
        })
        .catch(error => {
          console.error('❌ Failed to calculate smart transform, using default:', error);
          
          // Fallback: apply with default transform and start editing
          const defaultTransform = createPhotoTransform(1, 0.5, 0.5);
          const updatedSlots = templateSlots.map(s => {
            if (s.id === selectedSlot.id) {
              return {
                ...s,
                photoId: photo.id,
                transform: defaultTransform
              };
            }
            return s;
          });
          setTemplateSlots(updatedSlots);
          
          // Sync ALL completed templates
          syncAllCompletedTemplates(updatedSlots);
          
          setIsSelectingPhoto(false);
          // Photos are now immediately interactive via PhotoRenderer
        });
      
      console.log('✅ Starting inline editing with auto-fit Process 1 (smart scale)');
    } else if (selectionMode === 'print' && selectedSlot) {
      // Direct manipulation - photo is immediately interactive
      console.log('🔧 Photo applied for direct manipulation');
    } else if (selectionMode === 'photo') {
      // In photo mode - show photo viewer for starring/unstarring
      console.log('🔧 Opening photo viewer in photo mode');
      setSelectedPhotoForViewer(photo);
      setViewMode('photo-viewer');
    }
  };

  const handleAddToTemplate = (photo: Photo) => {
    setSelectedPhotoForTemplate(photo);
    if (selectedSlot) {
      // Photos are immediately interactive via PhotoRenderer
      console.log('🔧 Photo ready for direct manipulation');
    } else {
      // Fallback to sliding templates if no slot selected
      setViewMode('sliding-templates');
    }
  };

  const handleSlotSelectFromSlidingBar = (slot: TemplateSlot) => {
    // Direct manipulation - close sliding bar and photos become immediately interactive
    setViewMode('normal');
  };

  // Template-first workflow  
  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplateForViewer(templateId);
    setViewMode('template-first');
  };

  // Slot clicks no longer needed - using pure direct manipulation
  const handleSlotSelectFromTemplate = (slot: TemplateSlot) => {
    // This function is kept for compatibility but does nothing
    // Photos are directly manipulable without any slot selection
  };
  
  // Handle photo drop on slot
  const handleDropPhoto = async (slot: TemplateSlot, photoId: string) => {
    // Get fresh slot data in case of stale closure
    const currentSlot = templateSlots.find(s => s.id === slot.id) || slot;
    
    console.log('🎯 Photo dropped on slot:', { 
      slotId: currentSlot.id, 
      photoId, 
      hasExistingPhoto: !!currentSlot.photoId,
      existingPhotoId: currentSlot.photoId 
    });
    
    // Check if it's the same photo being dropped
    if (currentSlot.photoId === photoId) {
      console.log('⚠️ Same photo dropped - no action needed');
      // Clear any preview states
      setPreviewSlotId(null);
      setPreviewPhotoId(null);
      return;
    }
    
    // Check if slot already has a different photo
    if (currentSlot.photoId) {
      console.log('🔄 Showing replacement confirmation for occupied slot');
      // Store pending replacement and show confirmation
      setPendingReplacement({ slot: currentSlot, photoId });
      setShowReplaceConfirmation(true);
      return;
    }
    
    // Find the photo
    const photo = photos.find(p => p.id === photoId);
    if (!photo) {
      console.error('❌ Photo not found:', photoId);
      return;
    }
    
    // Calculate smart transform for initial position
    const smartTransform = await createSmartPhotoTransformFromSlot(photo, slot);
    console.log('📠 Smart transform calculated for dropped photo:', smartTransform);
    
    // Update the slot with the photo and smart transform
    const updatedSlot: TemplateSlot = {
      ...slot,
      photoId: photo.id,
      transform: smartTransform
    };
    
    const updatedSlots = templateSlots.map(s => 
      s.id === slot.id ? updatedSlot : s
    );
    
    setTemplateSlots(updatedSlots);
    
    // Sync ALL completed templates
    syncAllCompletedTemplates(updatedSlots);
    
    // Direct manipulation - no mode switching needed
    // Photo is now immediately interactive via PhotoRenderer
    
    console.log('✅ Photo dropped with smart alignment - ready for continuous interaction');
  };

  // Handle confirmed replacement
  const handleConfirmReplace = async () => {
    if (!pendingReplacement) return;
    
    const { slot, photoId } = pendingReplacement;
    console.log('✅ Replacing photo in slot:', { slotId: slot.id, newPhotoId: photoId });
    
    // Find the photo
    const photo = photos.find(p => p.id === photoId);
    if (!photo) {
      console.error('❌ Photo not found:', photoId);
      setShowReplaceConfirmation(false);
      setPendingReplacement(null);
      return;
    }
    
    // Calculate smart transform for initial position
    const smartTransform = await createSmartPhotoTransformFromSlot(photo, slot);
    console.log('📠 Smart transform calculated for replacement photo:', smartTransform);
    
    // Update the slot with the new photo and smart transform
    const updatedSlot: TemplateSlot = {
      ...slot,
      photoId: photo.id,
      transform: smartTransform
    };
    
    const updatedSlots = templateSlots.map(s => 
      s.id === slot.id ? updatedSlot : s
    );
    
    setTemplateSlots(updatedSlots);
    
    // Sync ALL completed templates
    syncAllCompletedTemplates(updatedSlots);
    
    // Direct manipulation - photo is immediately interactive via PhotoRenderer
    
    // Clear confirmation state
    setShowReplaceConfirmation(false);
    setPendingReplacement(null);
    
    console.log('✅ Photo replaced with smart alignment and inline editing started');
  };
  
  // Handle change button click for filled slots - opens favorites bar
  // Button handlers removed - using pure direct manipulation

  // Handle confirmed photo removal
  const handleConfirmRemove = async (slot: TemplateSlot) => {
    console.log('🔧 Confirming photo removal for slot:', slot.id);
    
    try {
      // Remove photo from slot
      const updatedSlot: TemplateSlot = {
        ...slot,
        photoId: undefined,
        transform: undefined
      };

      // Update the slot in templateSlots array
      const updatedTemplateSlots = templateSlots.map(s => 
        s.id === slot.id ? updatedSlot : s
      );

      // Update template slots using the provided setter
      console.log('🔧 Photo removed from slot, updating template slots');
      setTemplateSlots(updatedTemplateSlots);
      
      // Check if template is now incomplete and delete from Drive if it was synced
      const templateId = slot.templateId;
      const templateSpecificSlots = updatedTemplateSlots.filter(s => s.templateId === templateId);
      const isTemplateComplete = templateSpecificSlots.every(s => s.photoId);
      
      if (!isTemplateComplete) {
        console.log('❌ Template now incomplete, removing from Drive sync:', templateId);
        templateSyncService.deleteFromDrive(templateId);
      }
      
      // Clear all related states
      setSlotShowingRemoveConfirmation(null);
      setSelectedSlot(null);
      
      console.log('✅ Photo removal completed and template slots updated');
      
    } catch (error) {
      console.error('❌ Error removing photo from slot:', error);
    }
  };

  // Handle remove confirmation cancellation
  const handleCancelRemove = () => {
    console.log('🔧 Remove confirmation cancelled - returning to edit buttons');
    
    // Get the slot that was being considered for removal
    const slot = slotShowingRemoveConfirmation;
    
    // Clear confirmation and show edit buttons again
    setSlotShowingRemoveConfirmation(null);
  };

  const handlePhotoSelectForSlot = (photo: Photo) => {
    // This function might not be needed anymore with inline editing
    setSelectedPhotoForTemplate(photo);
    // Could potentially start inline editing here if we have a slot context
  };

  // Handle background clicks to deselect when all templates are complete
  const handleBackgroundClick = (event: React.MouseEvent) => {
    // Only deselect if clicking directly on the background (not on child elements)
    if (event.target !== event.currentTarget) {
      return;
    }

    // Clear remove confirmation if shown
    if (slotShowingRemoveConfirmation) {
      console.log('🔧 Background clicked - clearing remove confirmation');
      setSlotShowingRemoveConfirmation(null);
      return;
    }

    // NOTE: Removed collapse logic - using fixed height layout now

    // Check if all templates are complete (all slots have photos)
    const allSlotsHavePhotos = templateSlots.every(slot => slot.photoId);
    
    if (allSlotsHavePhotos && selectedSlot) {
      console.log('🔧 Background clicked - deselecting for clean view');
      setSelectedSlot(null);
    }
  };

  // Handle template navigation changes from TemplateGrid
  const handleTemplateChange = (templateIndex: number, templateId: string) => {
    console.log('📱 Template changed via swipe/navigation:', {
      templateIndex,
      templateId,
      currentSelectedSlot: selectedSlot?.id
    });
    
    // Don't change selection if we're in inline editing mode
    if (viewMode === 'inline-editing') {
      console.log('⏭️ Skipping slot auto-select - inline editing in progress');
      return;
    }
    
    // Get slots for the new template
    const newTemplateSlots = templateSlots.filter(slot => slot.templateId === templateId);
    
    // When switching templates, clear selection
    // User must manually select a slot they want to work with
    setSelectedSlot(null);
    console.log('🔧 Template switched - selection cleared for manual slot selection:', {
      templateId,
      totalSlots: newTemplateSlots.length
    });
  };

  // Template editor
  const handleApplyPhotoToSlot = (slotId: string, photoId: string, transform?: PhotoTransform | ContainerTransform) => {
    console.log('🔧 FULLSCREEN EDITOR - Apply button clicked:', { slotId, photoId, transform });
    console.log('🔧 Current templateSlots before update:', templateSlots.map(s => ({ id: s.id, photoId: s.photoId, hasTransform: !!s.transform })));
    
    // Validate transform
    if (transform) {
      console.log('🔍 Transform validation:', {
        hasTransform: !!transform,
        isPhotoTransform: isPhotoTransform(transform),
        isContainerTransform: isContainerTransform(transform),
        transformType: (transform as any).type || 'unknown',
        transformData: transform
      });
    } else {
      console.warn('⚠️ No transform provided - will use default or existing');
    }
    
    // Set flag to bypass state guard during apply operation
    setIsApplyingPhoto(true);
    
    // Verify photo exists in photos array BEFORE updating
    const photo = photos.find(p => p.id === photoId);
    if (!photo) {
      console.error('❌ CRITICAL ERROR: Photo not found in photos array!', {
        requestedPhotoId: photoId,
        availablePhotoIds: photos.map(p => p.id),
        photosArrayLength: photos.length
      });
      return; // Don't proceed if photo doesn't exist
    }
    console.log('✅ Photo found in photos array:', photo.name, photo.url);
    
    // Create completely new array to ensure React detects the change
    const updatedSlots = templateSlots.map(s => {
      if (s.id === slotId) {
        // Determine the transform to use
        let finalTransform = transform;
        
        // If no transform provided and slot has no existing transform (new photo)
        if (!transform && !s.transform) {
          // Create default transform for new photos
          finalTransform = createPhotoTransform(1, 0.5, 0.5);
          console.log('📐 Creating default transform for new photo');
        } else if (!transform && s.transform) {
          // Keep existing transform if no new one provided
          finalTransform = s.transform;
          console.log('📐 Keeping existing transform');
        }
        
        // Create a completely new slot object to ensure React detects the change
        const newSlot = {
          ...s,
          photoId: photoId, // Ensure the photoId is properly set
          transform: finalTransform
        };
        console.log('🔧 Creating new slot object:', {
          slotId: newSlot.id,
          photoId: newSlot.photoId,
          hasTransform: !!newSlot.transform,
          transformType: newSlot.transform ? (isPhotoTransform(newSlot.transform) ? 'PhotoTransform' : 'Other') : 'None',
          transform: newSlot.transform
        });
        return newSlot;
      }
      return { ...s }; // Create new object references for all slots to force re-render
    });
    
    console.log('🔧 Updated slots after applying photo:', updatedSlots.map(s => ({ id: s.id, photoId: s.photoId, hasTransform: !!s.transform })));
    
    // Verify the slot that was updated
    const updatedSlot = updatedSlots.find(s => s.id === slotId);
    console.log('🔧 Slot that was updated:', updatedSlot);
    
    // Validate that the update actually took place
    if (updatedSlot?.photoId !== photoId) {
      console.error('❌ CRITICAL: Slot update failed! photoId not set correctly');
      console.error('Expected photoId:', photoId, 'Actual photoId:', updatedSlot?.photoId);
      return; // Don't proceed with state update if it failed
    } else {
      console.log('✅ Slot update successful - photoId set correctly');
    }
    
    // Force component to re-render by also updating a dummy counter
    console.log('🔧 FORCING COMPONENT RE-RENDER - Calling setTemplateSlots');
    setTemplateSlots(updatedSlots);
    
    // Sync ALL completed templates
    syncAllCompletedTemplates(updatedSlots);
    
    // Force immediate re-render check
    const immediateCheck = () => {
      console.log('🔧 IMMEDIATE CHECK - templateSlots should be updated now');
      // Force a re-render by updating the state again if needed
      const verification = updatedSlots.find(s => s.id === slotId);
      if (verification?.photoId === photoId) {
        console.log('✅ VERIFICATION PASSED: Updated slots array contains correct photoId');
      } else {
        console.error('❌ VERIFICATION FAILED: Updated slots array does not contain correct photoId');
      }
    };
    
    // Check immediately and after a brief delay
    immediateCheck();
    setTimeout(() => {
      console.log('🔧 DELAYED CHECK - Verifying templateSlots state after React update cycle');
      // This will still show the old state due to closure, but the TemplateVisual should have re-rendered
      const currentSlots = templateSlots; // This will be the old state due to closure
      console.log('Current templateSlots (closure - will be old):', currentSlots.map(s => ({ id: s.id, photoId: s.photoId })));
      console.log('Updated templateSlots (what we set):', updatedSlots.map(s => ({ id: s.id, photoId: s.photoId })));
    }, 50);
    
    // Simple template completion check and deselect
    const currentSlot = updatedSlots.find(slot => slot.id === slotId);
    if (currentSlot) {
      // Get all slots in the same template
      const sameTemplateSlots = updatedSlots.filter(slot => slot.templateId === currentSlot.templateId);
      
      // Count how many slots in this template now have photos
      const filledSlotsCount = sameTemplateSlots.filter(slot => slot.photoId).length;
      const totalSlotsInTemplate = sameTemplateSlots.length;
      
      console.log(`🔧 Template ${currentSlot.templateId}: ${filledSlotsCount}/${totalSlotsInTemplate} slots filled`);
      
      if (filledSlotsCount === totalSlotsInTemplate) {
        // Template is complete - deselect for clean viewing
        console.log('🔧 Template completed - deselecting for clean view');
        setSelectedSlot(null);
      } else {
        // Don't auto-select next slot - let user decide what to do next
        // They may want to edit the photo they just placed
        console.log('🔧 Photo placed - keeping current slot selected so user can edit if needed');
        // Keep the current slot selected so user can click it to edit
        setSelectedSlot(currentSlot);
      }
    }
    
    // Reset states and return to normal view
    console.log('🔧 Resetting view states and closing fullscreen editor');
    // NOTE: Removed collapse logic - using fixed height layout now
    resetViewStates();
    
    // Clear the applying flag to re-enable state guard
    setIsApplyingPhoto(false);
  };

  const resetViewStates = () => {
    console.log('🔧 Resetting all view states to normal mode');
    setViewMode('normal');
    setSelectedPhotoForViewer(null);
    setSelectedPhotoForTemplate(null);
    setSelectedTemplateForViewer(null);
    setSelectedSlotForEditor(null);
    setInlineEditingSlot(null);
    setInlineEditingPhoto(null);
    setSlotShowingRemoveConfirmation(null);
  };

  // Enhanced escape mechanism for stuck states
  const forceResetEditingState = () => {
    console.log('🚨 FORCE RESET - Clearing all editing states');
    setViewMode('normal');
    setInlineEditingSlot(null);
    setInlineEditingPhoto(null);
    setSelectedSlot(null);
    setSelectedPhotoForViewer(null);
    setSelectedPhotoForTemplate(null);
    setSelectedTemplateForViewer(null);
    setSelectedSlotForEditor(null);
    setSlotShowingRemoveConfirmation(null);
  };

  // Keyboard escape handler
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && viewMode === 'inline-editing') {
        console.log('🔧 ESC key pressed - cancelling inline editing');
        handleInlineCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [viewMode]);

  // Inline editing handlers
  const handleInlinePhotoSelect = (photo: Photo) => {
    console.log('🔧 handleInlinePhotoSelect called:', {
      photoId: photo.id,
      photoName: photo.name,
      currentViewMode: viewMode,
      hasInlineEditingSlot: !!inlineEditingSlot,
      inlineEditingSlotId: inlineEditingSlot?.id
    });

    if (viewMode === 'inline-editing' && inlineEditingSlot) {
      console.log('✅ Setting photo for inline editing - conditions met');
      setInlineEditingPhoto(photo);
    } else {
      console.warn('❌ Cannot set photo for inline editing - conditions not met:', {
        isInlineEditingMode: viewMode === 'inline-editing',
        hasInlineEditingSlot: !!inlineEditingSlot
      });
    }
  };

  // Batched apply handler to prevent excessive re-renders during interactions  
  const handleInlineApply = (slotId: string, photoId: string, transform: PhotoTransform) => {
    try {
      if (!slotId || !photoId) {
        return; // Silently ignore invalid calls to prevent errors
      }
      
      // Apply the photo and transform immediately without state management overhead
      handleApplyPhotoToSlot(slotId, photoId, transform);
      
      // Keep interaction state active for smooth continuous editing
      // Don't reset states to prevent flashing during auto-snap
      
    } catch (error) {
      console.error('❌ Error in handleInlineApply:', error);
      // Only reset on actual errors, not during normal operation
      forceResetEditingState();
    }
    // NOTE: Removed collapse logic - using fixed height layout now
  };

  const handleInlineCancel = () => {
    try {
      // Immediately reset all editing states
      forceResetEditingState();
    } catch (error) {
      console.error('❌ Error in handleInlineCancel:', error);
      // Force reset even if there's an error
      forceResetEditingState();
    }
    // NOTE: Removed collapse logic - using fixed height layout now
  };

  const handleOverlayCancel = () => {
    if (viewMode === 'inline-editing') {
      // In inline editing mode, cancel the editing
      handleInlineCancel();
    } else if (selectedSlot) {
      // Just slot selected (not editing), deselect it
      console.log('🔧 Deselecting slot via overlay click');
      setSelectedSlot(null);
    }
  };

  // Favorites management
  const handleToggleFavorite = (photoId: string) => {
    // Check if trying to unfavorite a photo that's in a template slot
    const usedPhotoIds = getUsedPhotoIds();
    const isPhotoInSlot = usedPhotoIds.has(photoId);
    const isCurrentlyFavorited = favoritedPhotos.has(photoId);
    
    console.log('⭐ Toggle Favorite Debug:', {
      photoId,
      isCurrentlyFavorited,
      isPhotoInSlot,
      usedPhotoIds: Array.from(usedPhotoIds),
      favoritedPhotos: Array.from(favoritedPhotos),
      templateSlots: templateSlots.map(s => ({ id: s.id, photoId: s.photoId }))
    });
    
    // If trying to unfavorite a photo that's in a slot, show warning
    if (isCurrentlyFavorited && isPhotoInSlot) {
      console.log('🚫 Blocking unfavorite - photo is in slot');
      toast('Please remove from template slot first', {
        id: 'unfavorite-locked',
        duration: 3000,
        icon: '⚠️',
        style: {
          background: '#FEF3C7',
          color: '#92400E',
        },
      });
      return; // Don't allow unfavoriting
    }
    
    // Otherwise, toggle favorite normally
    console.log('✅ Allowing favorite toggle');
    setFavoritedPhotos(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(photoId)) {
        newFavorites.delete(photoId);
      } else {
        newFavorites.add(photoId);
      }
      return newFavorites;
    });
  };

  // Mode toggling
  const handleModeToggle = () => {
    setSelectionMode(prev => prev === 'photo' ? 'print' : 'photo');
    // NOTE: Removed collapse logic - using fixed height layout now
  };

  // Handle finalize with validation
  const handleFinalizeClick = () => {
    // Count empty slots
    const emptySlots = templateSlots.filter(slot => !slot.photoId);
    const filledSlots = templateSlots.filter(slot => slot.photoId);
    
    if (emptySlots.length > 0) {
      // Show warning if there are empty slots
      setShowIncompleteWarning(true);
    } else {
      // All slots filled, show upload options modal
      setShowUploadOptions(true);
    }
  };

  // Handle upload options
  const handleUploadTemplatesClick = () => {
    setShowUploadOptions(false);
    if (handleTemplateUpload) {
      handleTemplateUpload();
    } else {
      // Fallback to original behavior
      handlePhotoContinue();
    }
  };

  const handleUploadPhotosClick = () => {
    const favoritedPhotosList = photos.filter(photo => favoritedPhotos.has(photo.id));
    setShowUploadOptions(false);
    if (handlePhotoUpload) {
      handlePhotoUpload(favoritedPhotosList);
    }
  };

  // Cancel incomplete finalize
  const cancelIncompleteFinalize = () => {
    setShowIncompleteWarning(false);
  };
  
  // Handle double-tap on client name
  const handleClientNameTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300; // milliseconds
    
    if (now - lastTapTime < DOUBLE_TAP_DELAY) {
      // Double tap detected
      console.log('Double tap detected on client name');
      if (onBackToPackage) {
        setShowBackToPackageConfirm(true);
      }
    }
    setLastTapTime(now);
  };
  
  // Confirm navigation back to package
  const confirmBackToPackage = () => {
    setShowBackToPackageConfirm(false);
    if (onBackToPackage) {
      onBackToPackage();
    }
  };
  
  // Cancel navigation back
  const cancelBackToPackage = () => {
    setShowBackToPackageConfirm(false);
  };

  // Get photos used in templates
  const getUsedPhotoIds = () => {
    const usedIds = new Set<string>();
    templateSlots.forEach(slot => {
      if (slot.photoId) {
        usedIds.add(slot.photoId);
      }
    });
    return usedIds;
  };

  // Get favorited photos that aren't used in templates
  const getUnusedFavorites = () => {
    const usedIds = getUsedPhotoIds();
    return photos.filter(photo => 
      favoritedPhotos.has(photo.id) && !usedIds.has(photo.id)
    );
  };

  // Calculate dynamic photo limit
  const calculatePhotoLimit = () => {
    // Check if selectedPackage has photo_limit (ManualPackage) or use default
    const baseLimit = (selectedPackage as ManualPackage)?.photo_limit || 10;
    const templatePhotoCount = templateSlots.length;
    return Math.max(baseLimit, templatePhotoCount);
  };

  // Get photos for display (only favorites in print mode)
  const getDisplayPhotos = () => {
    if (selectionMode === 'print') {
      // In print mode, show all favorited photos (including used ones for reuse)
      return photos.filter(photo => favoritedPhotos.has(photo.id));
    }
    return photos; // Photo mode shows all photos normally
  };

  // Get template groups for tracking positions
  const getTemplateGroups = () => {
    const groups: { templateId: string; templateName: string; slots: TemplateSlot[] }[] = [];
    const groupMap = new Map<string, TemplateSlot[]>();
    
    templateSlots.forEach(slot => {
      if (!groupMap.has(slot.templateId)) {
        groupMap.set(slot.templateId, []);
      }
      groupMap.get(slot.templateId)?.push(slot);
    });
    
    groupMap.forEach((slots, templateId) => {
      if (slots.length > 0) {
        groups.push({
          templateId,
          templateName: slots[0].templateName,
          slots
        });
      }
    });
    
    return groups;
  };

  // Template management handlers

  const handleConfirmTemplateSwap = (newTemplate: ManualTemplate) => {
    if (!templateToChange) return;
    
    console.log('🔄 Template replacement confirmed:', {
      position: templateToChange.index,
      oldTemplate: templateToChange.template.name,
      newTemplate: newTemplate.name,
      oldHoles: templateToChange.template.holes_data?.length || 0,
      newHoles: newTemplate.holes_data?.length || 0
    });
    
    // Store the replacement by position
    setTemplateReplacements(prev => ({
      ...prev,
      [templateToChange.index]: newTemplate
    }));
    
    // Update slots for the new template
    const templateGroups = getTemplateGroups();
    const targetGroup = templateGroups[templateToChange.index];
    if (targetGroup) {
      // Get the old slots for this template
      const oldSlots = templateSlots.filter(slot => slot.templateId === targetGroup.templateId);
      
      // Create new slots based on the new template's hole count
      const newHoleCount = newTemplate.holes_data?.length || 0;
      const newSlots: TemplateSlot[] = [];
      
      // Generate new slots for the new template
      for (let i = 0; i < newHoleCount; i++) {
        const oldSlot = oldSlots[i]; // Try to preserve photo from corresponding old slot
        
        newSlots.push({
          id: `${newTemplate.id}_slot_${i}_${Date.now()}`,
          templateId: targetGroup.templateId, // Keep the same group ID
          templateName: newTemplate.name,
          templateType: newTemplate.id.toString(),
          printSize: newTemplate.print_size,
          slotIndex: i,
          photoId: oldSlot?.photoId || undefined, // Preserve photo if available
          transform: undefined // Reset transform for recalculation
        });
      }
      
      console.log('📝 Creating new slots for template swap:', {
        oldSlotCount: oldSlots.length,
        newSlotCount: newSlots.length,
        preservedPhotos: newSlots.filter(s => s.photoId).length
      });
      
      // Add the new template to window cache so it can be found by TemplateVisual
      const windowTemplates = (window as any).pngTemplates || [];
      const convertedTemplate = {
        ...newTemplate,
        holes: newTemplate.holes_data,
        driveFileId: newTemplate.drive_file_id
      };
      
      // Check if template already exists in cache
      const existsInCache = windowTemplates.some((t: any) => t.id === newTemplate.id);
      if (!existsInCache) {
        windowTemplates.push(convertedTemplate);
        (window as any).pngTemplates = windowTemplates;
        console.log('✅ Added swapped template to window cache:', {
          templateId: newTemplate.id,
          templateName: newTemplate.name,
          templateType: newTemplate.template_type,
          cacheSize: windowTemplates.length
        });
      }
      
      // Replace old slots with new slots
      const updatedSlots = templateSlots.filter(slot => slot.templateId !== targetGroup.templateId).concat(newSlots);
      
      // Sort to maintain order
      updatedSlots.sort((a, b) => {
        const aGroup = templateGroups.findIndex(g => g.templateId === a.templateId);
        const bGroup = templateGroups.findIndex(g => g.templateId === b.templateId);
        if (aGroup !== bGroup) return aGroup - bGroup;
        return (a.slotIndex || 0) - (b.slotIndex || 0);
      });
      
      setTemplateSlots(updatedSlots);
    }
    
    setShowTemplateModal(false);
    setTemplateToChange(null);
  };

  const handleCloseTemplateSwap = () => {
    setShowTemplateModal(false);
    setTemplateToChange(null);
  };

  const handleSwapTemplate = (template: { templateId: string; templateName: string; slots: TemplateSlot[] }, index: number) => {
    console.log('🔄 Template change requested:', { 
      templateName: template.templateName, 
      templateId: template.templateId,
      index,
      slots: template.slots.length 
    });
    
    // Get the current template for this position
    const currentSlot = template.slots[0];
    if (!currentSlot) {
      console.error('❌ No slots found in template');
      return;
    }
    
    // Find the manual template for this position
    manualTemplateService.getAllTemplates().then(allTemplates => {
      // Try multiple ways to find the template
      let currentTemplate = allTemplates.find(t => 
        t.id.toString() === currentSlot.templateType
      );
      
      // If not found by templateType, try by template ID
      if (!currentTemplate) {
        currentTemplate = allTemplates.find(t => 
          t.id.toString() === template.templateId
        );
      }
      
      // If still not found, try by matching print size and template type
      if (!currentTemplate && currentSlot.printSize) {
        currentTemplate = allTemplates.find(t => 
          t.print_size === currentSlot.printSize &&
          t.template_type === currentSlot.templateType.replace(/[0-9-]/g, '') // Remove numbers/UUIDs
        );
      }
      
      if (currentTemplate) {
        console.log('✅ Found template for change:', {
          id: currentTemplate.id,
          name: currentTemplate.name,
          type: currentTemplate.template_type
        });
        setTemplateToChange({ template: currentTemplate, index });
        setShowTemplateModal(true);
      } else {
        console.error('❌ Could not find template for change:', {
          searchedType: currentSlot.templateType,
          searchedId: template.templateId,
          availableTemplates: allTemplates.map(t => ({ id: t.id, name: t.name }))
        });
      }
    }).catch(error => {
      console.error('❌ Error loading templates:', error);
    });
  };

  const handleDownloadTemplate = async (template: { templateId: string; templateName: string; slots: TemplateSlot[] }) => {
    try {
      console.log('📥 Template download requested:', template);

      // Find the manual template for this template group
      const firstSlot = template.slots[0];
      if (!firstSlot) {
        throw new Error('No slots found in template');
      }

      // Get all templates to find the matching manual template
      const allTemplates = await manualTemplateService.getAllTemplates();
      const manualTemplate = allTemplates.find(t => 
        t.template_type === firstSlot.templateType && 
        t.print_size === (firstSlot.printSize || '4R')
      );

      if (!manualTemplate) {
        throw new Error(`Manual template not found for type: ${firstSlot.templateType}`);
      }

      console.log('📝 Found manual template:', manualTemplate.name);

      // Rasterize and download the template
      const rasterized = await templateRasterizationService.rasterizeTemplate(
        manualTemplate,
        template.slots,
        photos,
        {
          format: 'jpeg',
          quality: 0.95,
          includeBackground: true
        }
      );

      await templateRasterizationService.downloadTemplate(rasterized);

      console.log('✅ Template download completed');
    } catch (error) {
      console.error('❌ Template download failed:', error);
      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      toast.error(`Unable to download template. Please try again. ${errorMessage}`, {
        duration: 5000,
        style: {
          maxWidth: '500px',
        }
      });
    }
  };



  return (
    <div className="bg-gray-50 flex flex-col overflow-hidden" style={{ 
      touchAction: 'pan-y',
      height: 'var(--full-vh, 100vh)',
      maxHeight: 'var(--full-vh, 100vh)'
    }}>
      
      {/* SELECTIVE BLOCKING - Only dim non-interactive areas during editing */}
      {viewMode === 'inline-editing' && (
        <>
          {/* Subtle backdrop to indicate editing mode - does not block interactions */}
          <div 
            className="fixed inset-0 z-10 bg-black bg-opacity-20 pointer-events-none"
            style={{ 
              // This is purely visual - no click blocking
            }}
          />
        </>
      )}
      
      {/* Photo Selection Overlay - Shows when selecting photo for empty slot */}
      {isSelectingPhoto && (
        <>
          {/* Semi-transparent overlay with instruction */}
          <div 
            className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-start sm:items-center justify-center animate-fade-in pt-20 sm:pt-0"
            onClick={(e) => {
              // Only close if clicking directly on overlay, not on child elements
              if (e.target === e.currentTarget) {
                setIsSelectingPhoto(false);
                setSelectedSlot(null);
                console.log('📌 Photo selection overlay cancelled');
              }
            }}
          >
            <div 
              className="bg-white rounded-2xl px-6 py-6 sm:px-12 sm:py-10 mx-4 shadow-2xl transform animate-slide-down"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                {/* Modern photo icon */}
                <div className="mb-3 sm:mb-4">
                  <svg 
                    className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-400"
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={1.5} 
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" 
                    />
                  </svg>
                </div>
                <p className="text-xl sm:text-2xl font-semibold text-gray-800">
                  Select a photo to fill the slot
                </p>
                <p className="text-sm sm:text-base text-gray-600 mt-3 sm:mt-4">
                  Choose from your favorites below
                </p>
                {/* Animated down arrow */}
                <div className="mt-2">
                  <svg 
                    className="w-6 h-6 sm:w-8 sm:h-8 mx-auto text-gray-500 animate-bounce"
                    fill="none" 
                    viewBox="0 0 24 24" 
                    stroke="currentColor"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M19 13l-7 7-7-7m14-8l-7 7-7-7" 
                    />
                  </svg>
                </div>
                <p className="text-xs sm:text-sm text-gray-500 mt-2">
                  Tap outside or press ESC to cancel
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      {/* <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        PhotoSelectionScreen.tsx
      </div> */}

      {/* FIXED-HEIGHT LAYOUT: Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Photo Grid Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mode Header with Toggle - FIXED HEIGHT */}
          <div className="bg-white border-b p-2 sm:p-3 flex items-center justify-between layout-header">
            <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-3">
              <h2 className="text-sm sm:text-base font-medium text-gray-800">
                <span 
                  className="text-blue-600 cursor-pointer hover:text-blue-700 hover:underline transition-colors select-none"
                  onClick={handleClientNameTap}
                  title="Double-tap to go back to selected package"
                >
                  {clientName}
                </span>
                <span className="mx-1 text-gray-400">•</span>
                {selectionMode === 'photo' ? 'Select Your Favorite Photos' : 'Fill Your Print Templates'}
              </h2>
              <div className="text-xs sm:text-sm text-gray-600">
                {selectionMode === 'photo' 
                  ? `${favoritedPhotos.size} favorites • ${calculatePhotoLimit() - getUsedPhotoIds().size} photos available`
                  : (
                    <>
                      <span>Templates: {getUsedPhotoIds().size} of {calculatePhotoLimit()} slots filled</span>
                      <span className="hidden sm:inline"> • </span>
                      <span className="block sm:inline">{getDisplayPhotos().length} favorites available</span>
                    </>
                  )
                }
              </div>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Mode toggle button for desktop */}
              <button
                onClick={handleModeToggle}
                className={`hidden px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                  selectionMode === 'photo'
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                } ${viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''}`}
              >
                {selectionMode === 'photo' ? '📷 Ready to Fill Prints' : '⭐ Back to Photo Selection'}
              </button>
              
              {/* Add Prints button - only in print mode */}
              {selectionMode === 'print' && (
                <button
                  onClick={() => setShowAddPrintsModal(true)}
                  className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium bg-green-600 text-white hover:bg-green-700 transition-all duration-200 flex items-center gap-1 sm:gap-2 whitespace-nowrap ${
                    viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <span className="text-sm sm:text-lg">+</span>
                  <span>Add Prints</span>
                </button>
              )}
            </div>
          </div>

          {/* MAIN CONTENT AREA - CALCULATED FIXED HEIGHT */}
          <div 
            className={`layout-main-content relative z-40 ${
              viewMode === 'inline-editing' && selectionMode === 'print' 
                ? 'editing-mode' // Custom class to help with styling
                : ''
            }`}
            style={{ 
              touchAction: 'manipulation',
              // Add padding when favorites bar is expanded to prevent template cutoff
              paddingBottom: isSelectingPhoto ? 'calc(40vh - 150px)' : '0px',
              // No transitions - pure direct manipulation interface
            }}
          >
            {selectionMode === 'photo' ? (
              <PhotoGrid
                photos={getDisplayPhotos()}
                onPhotoClick={handlePhotoClick}
                showScrollHint={false}
                hasScrolled={hasScrolled}
                onScroll={() => setHasScrolled(true)}
                favoritedPhotos={favoritedPhotos}
                onToggleFavorite={handleToggleFavorite}
                usedPhotoIds={getUsedPhotoIds()}
                isEditingMode={viewMode === 'inline-editing'}
              />
            ) : (
              // Print mode: Show templates in Cover Flow
              <div className="h-full overflow-hidden" onClick={handleBackgroundClick}>
                  <TemplateGrid
                    templateSlots={templateSlots}
                    photos={photos}
                    selectedSlot={selectedSlot}
                    onSlotClick={handleSlotSelectFromTemplate}
                    onSwapTemplate={handleSwapTemplate}
                    onDeleteTemplate={handleDeletePrint}
                    onDownloadTemplate={handleDownloadTemplate}
                    onTemplateChange={handleTemplateChange}
                    templateToNavigate={templateToNavigate}
                    onNavigationComplete={() => setTemplateToNavigate(null)}
                    TemplateVisual={(props: any) => (
                      <TemplateVisual
                        {...props}
                        inlineEditingSlot={inlineEditingSlot}
                        inlineEditingPhoto={inlineEditingPhoto}
                        onInlineApply={handleInlineApply}
                        onInlineCancel={handleInlineCancel}
                        skipStateGuard={isApplyingPhoto}
                        slotShowingRemoveConfirmation={slotShowingRemoveConfirmation}
                        onConfirmRemove={handleConfirmRemove}
                        onCancelRemove={handleCancelRemove}
                        onDropPhoto={handleDropPhoto}
                        isDraggingPhoto={isDraggingPhoto}
                        previewSlotId={previewSlotId}
                        previewPhotoId={previewPhotoId}
                        onSetPreviewSlot={setPreviewSlotId}
                      />
                    )}
                    layout="coverflow"
                    showActions={true}
                    isEditingMode={viewMode === 'inline-editing'}
                    editingSlot={inlineEditingSlot}
                  />
              </div>
            )}
          </div>
        </div>

        {/* UNIFIED NAVIGATION BAR - Mode toggle and Finalize buttons (all screen sizes) */}
        <div className="fixed bottom-[200px] left-0 right-0 z-40 bg-white border-t shadow-lg">
          {/* Sync Status Indicator */}
          {syncStatus.isInitialized && (syncStatus.isProcessing || syncStatus.queueSize > 0) && (
            <div className="bg-blue-50 border-b border-blue-200 px-3 py-2">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  {syncStatus.isProcessing ? (
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="w-4 h-4 border-2 border-yellow-500 rounded-full" />
                  )}
                  <span className="text-gray-700">
                    {syncStatus.isProcessing 
                      ? `Syncing templates to Google Drive...` 
                      : `${syncStatus.queueSize} template${syncStatus.queueSize !== 1 ? 's' : ''} pending sync`}
                  </span>
                </div>
                {syncStatus.syncedCount > 0 && (
                  <span className="text-green-600 font-medium">
                    ✓ {syncStatus.syncedCount} synced
                  </span>
                )}
              </div>
            </div>
          )}
          {!syncStatus.isInitialized && templateSlots.length > 0 && (
            <div className="bg-yellow-50 border-b border-yellow-200 px-3 py-2">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-yellow-700">⚠️ Background sync disabled - templates won't auto-save</span>
              </div>
            </div>
          )}
          <div className="flex p-3 gap-3">
            <button
              onClick={handleModeToggle}
              className={`flex-1 px-3 py-2 rounded-lg font-medium transition-all duration-200 text-sm ${
                selectionMode === 'photo'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } ${viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''}`}
            >
              {selectionMode === 'photo' ? '📷 Fill Templates' : '⭐ Select Photos'}
            </button>
            <button
              onClick={handleFinalizeClick}
              className={`flex-1 ${
                templateSlots.every(slot => slot.photoId) 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-500 cursor-not-allowed'
              } text-white px-3 py-2 rounded-lg font-medium transition-all duration-200 shadow-md text-sm ${
                viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              Finalize ({templateSlots.filter(s => s.photoId).length}/{templateSlots.length}) ✓
            </button>
          </div>
        </div>

        {/* UNIFIED FAVORITES BAR - All screen sizes */}
        <div className="">
          {/* Spacer to maintain layout when favorites bar and nav bar are fixed */}
          <div style={{ height: '260px' }} /> {/* Account for FavoritesBar (200px) + NavBar (60px) */}
          
          {selectionMode === 'photo' ? (
            // Photo Selection Mode: Show Favorites Bar - FIXED HEIGHT
            <FavoritesBar
              favoritedPhotos={photos.filter(photo => favoritedPhotos.has(photo.id))}
              onPhotoClick={handlePhotoClick}
              onRemoveFavorite={handleToggleFavorite}
              isActiveInteractionArea={false}
              layout="horizontal"
              showRemoveButtons={true}
              usedPhotoIds={getUsedPhotoIds()}
              onDragStart={(photo) => {
                setIsDraggingPhoto(true);
                setPreviewPhotoId(photo.id);
                // Pause background sync during drag
                templateSyncService.setUserInteracting(true);
              }}
              onDragEnd={() => {
                setIsDraggingPhoto(false);
                setPreviewSlotId(null);
                // Resume background sync after drag
                templateSyncService.setUserInteracting(false);
                setPreviewPhotoId(null);
              }}
            />
          ) : (
            // Print Filling Mode: Show Favorites Bar - EXPANDED when selecting
            <FavoritesBar
              favoritedPhotos={getDisplayPhotos()}
              onPhotoClick={handlePhotoClick}
              onRemoveFavorite={handleToggleFavorite}
              isActiveInteractionArea={viewMode === 'inline-editing' || isSelectingPhoto}
              layout="horizontal"
              showRemoveButtons={false}
              usedPhotoIds={getUsedPhotoIds()}
              onDragStart={(photo) => {
                setIsDraggingPhoto(true);
                setPreviewPhotoId(photo.id);
                // Pause background sync during drag
                templateSyncService.setUserInteracting(true);
              }}
              onDragEnd={() => {
                setIsDraggingPhoto(false);
                setPreviewSlotId(null);
                // Resume background sync after drag
                templateSyncService.setUserInteracting(false);
                setPreviewPhotoId(null);
              }}
            />
          )}
        </div>

      </div>


      {editingTemplate && (
        <InlineTemplateEditor
          templateSlots={editingTemplate}
          initialSelectedSlotId={selectedSlot!.id}
          photos={photos}
          onClose={handleInlineEditorClose}
          onPhotoSelect={handleInlinePhotoSelect}
          onTransformChange={handleInlineTransformChange}
          templateVisual={TemplateVisual}
        />
      )}

      {/* Add Prints Modal */}
      <AddPrintsModal
        isOpen={showAddPrintsModal}
        onClose={() => setShowAddPrintsModal(false)}
        onTemplateAdd={handleTemplateAdd}
        availablePhotos={photos}
      />
      
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTemplateToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Remove Template"
        message="Are you sure you want to remove this template? Any photos placed in it will be removed."
        confirmText="Remove"
        cancelText="Cancel"
        confirmButtonClass="bg-gray-600 hover:bg-gray-700"
      />

      {/* New Workflow Components */}
      
      {/* Fullscreen Photo Viewer */}
      <FullscreenPhotoViewer
        photo={selectedPhotoForViewer!}
        photos={getDisplayPhotos()} // Use filtered photos based on mode
        onClose={resetViewStates}
        onAddToTemplate={handleAddToTemplate}
        isVisible={(viewMode === 'photo-viewer' || viewMode === 'sliding-templates') && !!selectedPhotoForViewer}
        isDimmed={viewMode === 'sliding-templates'}
        selectionMode={selectionMode}
        favoritedPhotos={favoritedPhotos}
        onToggleFavorite={handleToggleFavorite}
      />

      {/* Sliding Template Bar (from photo) */}
      <SlidingTemplateBar
        templateSlots={templateSlots}
        selectedPhoto={selectedPhotoForTemplate!}
        photos={photos}
        onSlotSelect={handleSlotSelectFromSlidingBar}
        onClose={resetViewStates}
        isVisible={viewMode === 'sliding-templates' && !!selectedPhotoForTemplate}
        TemplateVisual={TemplateVisual}
      />

      {/* Fullscreen Template Selector (template-first) */}
      <FullscreenTemplateSelector
        templateSlots={templateSlots}
        selectedTemplateId={selectedTemplateForViewer || ''}
        photos={photos}
        onSlotSelect={handleSlotSelectFromTemplate}
        onClose={resetViewStates}
        isVisible={viewMode === 'template-first' && !!selectedTemplateForViewer}
        TemplateVisual={TemplateVisual}
      />

      {/* Photo Selection Mode (template-first) */}
      <PhotoSelectionMode
        photos={photos}
        selectedSlot={selectedSlotForEditor!}
        onPhotoSelect={handlePhotoSelectForSlot}
        onBack={() => setViewMode('template-first')}
        isVisible={viewMode === 'photo-selection' && !!selectedSlotForEditor}
      />


      {/* Template Selection Modal */}
      {templateToChange && (
        <TemplateSelectionModal
          isOpen={showTemplateModal}
          onClose={handleCloseTemplateSwap}
          currentTemplate={templateToChange}
          availablePhotos={photos}
          onTemplateSelect={handleConfirmTemplateSwap}
        />
      )}

      {/* Upload Options Modal */}
      <UploadOptionsModal
        isOpen={showUploadOptions}
        onClose={() => setShowUploadOptions(false)}
        onUploadTemplates={handleUploadTemplatesClick}
        onUploadPhotos={handleUploadPhotosClick}
        favoritedPhotos={photos.filter(photo => favoritedPhotos.has(photo.id))}
        isUploading={isUploading}
        uploadProgress={uploadProgress ? {
          current: uploadProgress.current,
          total: uploadProgress.total,
          message: uploadProgress.templateName
        } : null}
      />

      {/* Incomplete Slots Warning Dialog */}
      <Transition appear show={showIncompleteWarning} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={cancelIncompleteFinalize}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 text-center"
                  >
                    ⚠️ Some slots are empty
                  </Dialog.Title>
                  
                  <div className="mt-4">
                    <p className="text-sm text-gray-600 text-center">
                      Not all template slots have photos. You have {templateSlots.filter(s => !s.photoId).length} empty slot{templateSlots.filter(s => !s.photoId).length !== 1 ? 's' : ''}.
                    </p>
                    
                    <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                      <div className="text-sm text-orange-800">
                        <strong>Template Status:</strong>
                        <div className="mt-1">
                          • {templateSlots.filter(s => s.photoId).length} of {templateSlots.length} slots filled
                          <br />
                          • {templateSlots.filter(s => !s.photoId).length} slot{templateSlots.filter(s => !s.photoId).length !== 1 ? 's' : ''} still empty
                        </div>
                      </div>
                      
                      {/* Show which templates have empty slots */}
                      <div className="mt-2 text-xs text-orange-700">
                        {(() => {
                          const templatesWithEmpty = Array.from(
                            new Set(
                              templateSlots
                                .filter(s => !s.photoId)
                                .map(s => s.templateName)
                            )
                          );
                          return templatesWithEmpty.length > 0 && (
                            <>
                              <strong>Templates needing photos:</strong>
                              <ul className="mt-1 list-disc list-inside">
                                {templatesWithEmpty.map((name, i) => (
                                  <li key={i}>{name}</li>
                                ))}
                              </ul>
                            </>
                          );
                        })()}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-500 text-center mt-3">
                      Please fill all slots before finalizing. Empty slots cannot be processed.
                    </p>
                  </div>

                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      onClick={cancelIncompleteFinalize}
                    >
                      Go Back & Fill Slots
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Back to Package Confirmation Dialog */}
      <Transition appear show={showBackToPackageConfirm} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={cancelBackToPackage}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 text-center"
                  >
                    Go back to selected package?
                  </Dialog.Title>
                  
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 text-center">
                      Your photo selections will be preserved and you can continue from where you left off.
                    </p>
                    
                    <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="text-sm text-blue-800">
                        <strong>Current Progress:</strong>
                        <div className="mt-1">
                          • {templateSlots.filter(s => s.photoId).length} slots filled
                          <br />
                          • {favoritedPhotos.size} photos favorited
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      onClick={cancelBackToPackage}
                    >
                      Stay Here
                    </button>
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      onClick={confirmBackToPackage}
                    >
                      Go Back
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Photo Replacement Confirmation Modal */}
      <ConfirmationModal
        isOpen={showReplaceConfirmation}
        onClose={() => {
          setShowReplaceConfirmation(false);
          setPendingReplacement(null);
        }}
        onConfirm={handleConfirmReplace}
        title="Replace Photo?"
        message="This slot already has a photo. Do you want to replace it with the new one?"
        confirmText="Replace"
        cancelText="Cancel"
        confirmButtonClass="bg-orange-600 hover:bg-orange-700"
      />

    </div>
  );
}
 