import { Package, TemplateSlot, Photo, GoogleAuth, TemplateType, PrintSize, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform, createPhotoTransform, createSmartPhotoTransformFromSlot, ManualPackage, ManualTemplate } from '../../types';
import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import toast from 'react-hot-toast';
import InlineTemplateEditor from '../InlineTemplateEditor';
import InlinePhotoEditor from '../InlinePhotoEditor';
import FullscreenPhotoViewer from '../FullscreenPhotoViewer';
import PhotoRenderer from '../PhotoRenderer';
import FullscreenTemplateSelector from '../FullscreenTemplateSelector';
import PhotoSelectionMode from '../PhotoSelectionMode';
import SlidingTemplateBar from '../SlidingTemplateBar';
import { manualTemplateService } from '../../services/manualTemplateService';
import { templateRasterizationService } from '../../services/templateRasterizationService';
import { printSizeService } from '../../services/printSizeService';
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
const TemplateVisual = ({ template, slots, onSlotClick, photos, selectedSlot, inlineEditingSlot, inlineEditingPhoto, onInlineApply, onInlineCancel, skipStateGuard, isActiveTemplate = true, slotShowingEditButton, onEditButtonClick, onChangeButtonClick, slotShowingRemoveConfirmation, onRemoveButtonClick, onConfirmRemove, onCancelRemove }: any) => {
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
        isEditingMode={!!inlineEditingSlot}
        isActiveTemplate={isActiveTemplate}
        slotShowingEditButton={slotShowingEditButton}
        onEditButtonClick={onEditButtonClick}
        onChangeButtonClick={onChangeButtonClick}
        slotShowingRemoveConfirmation={slotShowingRemoveConfirmation}
        onRemoveButtonClick={onRemoveButtonClick}
        onConfirmRemove={onConfirmRemove}
        onCancelRemove={onCancelRemove}
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
  handlePhotoSelect: (photo: Photo) => void;
  handleSlotSelect: (slot: TemplateSlot) => void;
  handleBack: () => void;
  totalAllowedPrints: number;
  setSelectedSlot: (slot: TemplateSlot | null) => void;
  setTemplateSlots: (slots: TemplateSlot[]) => void;
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
  handlePhotoSelect,
  handleSlotSelect,
  handleBack,
  totalAllowedPrints,
  setSelectedSlot,
  setTemplateSlots,
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
  const [favoritedPhotos, setFavoritedPhotos] = useState<Set<string>>(new Set()); // Photo IDs that are favorited
  
  // NOTE: Removed expansion state - using fixed height layout now
  
  // Note: Debug logging removed - viewport-aware expansion is working correctly in both modes

  
  // Simplified workflow states
  const [viewMode, setViewMode] = useState<'normal' | 'photo-viewer' | 'sliding-templates' | 'template-first' | 'photo-selection' | 'inline-editing'>('normal');
  const [selectedPhotoForViewer, setSelectedPhotoForViewer] = useState<Photo | null>(null);
  const [selectedPhotoForTemplate, setSelectedPhotoForTemplate] = useState<Photo | null>(null);
  const [selectedTemplateForViewer, setSelectedTemplateForViewer] = useState<string | null>(null);
  const [selectedSlotForEditor, setSelectedSlotForEditor] = useState<TemplateSlot | null>(null);
  const [isSelectingPhoto, setIsSelectingPhoto] = useState(false); // Track when user is selecting photo for empty slot
  
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
  
  // Edit button state for filled slots (intermediate step before editing)
  const [slotShowingEditButton, setSlotShowingEditButton] = useState<TemplateSlot | null>(null);
  
  // Remove confirmation state
  const [slotShowingRemoveConfirmation, setSlotShowingRemoveConfirmation] = useState<TemplateSlot | null>(null);
  
  // Back navigation confirmation
  const [showBackConfirmation, setShowBackConfirmation] = useState(false);
  
  // Incomplete slots warning
  const [showIncompleteWarning, setShowIncompleteWarning] = useState(false);
  
  // Template management states (simplified)
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateToChange, setTemplateToChange] = useState<{template: ManualTemplate, index: number} | null>(null);
  const [templateToView, setTemplateToView] = useState<{ templateId: string; templateName: string; slots: TemplateSlot[] } | null>(null);
  const [templateReplacements, setTemplateReplacements] = useState<Record<number, ManualTemplate>>({});
  
  // Add Prints modal state
  const [showAddPrintsModal, setShowAddPrintsModal] = useState(false);

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
  };


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
        templateName: `${template.name} (Additional)`,
        templateType: template.id.toString() as TemplateType,
        printSize: template.print_size as PrintSize,
        slotIndex,
        photoId: undefined
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
    
    setTemplateSlots([...templateSlots, ...newSlotsToAdd]);
    toast.success(`Added ${template.name} template`);
  };

  const handleDeletePrint = (templateIdToDelete: string) => {
    if (window.confirm('Are you sure you want to delete this print? This will remove any photos placed in it.')) {
      const newTemplateSlots = templateSlots.filter(s => s.templateId !== templateIdToDelete);
      setTemplateSlots(newTemplateSlots);

      // If the currently selected slot was part of the deleted template, deselect it
      if (selectedSlot?.templateId === templateIdToDelete) {
        setSelectedSlot(null);
      }
    }
  };

  // New workflow handlers
  
  // Photo-first workflow
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
          
          // Now start inline editing so user can adjust if needed
          setIsSelectingPhoto(false); // Close expanded favorites bar
          setInlineEditingSlot(selectedSlot);
          setInlineEditingPhoto(photo);
          setViewMode('inline-editing');
          
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
          
          setIsSelectingPhoto(false);
          setInlineEditingSlot(selectedSlot);
          setInlineEditingPhoto(photo);
          setViewMode('inline-editing');
        });
      
      console.log('✅ Starting inline editing with auto-fit Process 1 (smart scale)');
    } else if (selectionMode === 'print' && selectedSlot) {
      // In print mode with selected slot but favorites not expanded - start inline editing
      console.log('🔧 Starting inline editing from photo click');
      setInlineEditingSlot(selectedSlot);
      setInlineEditingPhoto(photo);
      setViewMode('inline-editing');
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
      // If we have a selected slot, start inline editing
      setInlineEditingSlot(selectedSlot);
      setInlineEditingPhoto(photo);
      setViewMode('inline-editing');
    } else {
      // Fallback to sliding templates if no slot selected
      setViewMode('sliding-templates');
    }
  };

  const handleSlotSelectFromSlidingBar = (slot: TemplateSlot) => {
    setInlineEditingSlot(slot);
    setViewMode('inline-editing');
  };

  // Template-first workflow  
  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplateForViewer(templateId);
    setViewMode('template-first');
  };

  const handleSlotSelectFromTemplate = (slot: TemplateSlot) => {
    console.log('🔧 SLOT CLICK DEBUG:', {
      slotId: slot.id,
      hasPhoto: !!slot.photoId,
      photoId: slot.photoId,
      selectionMode,
      currentViewMode: viewMode,
      currentInlineEditingSlot: inlineEditingSlot?.id
    });

    // Prevent slot selection if already in inline editing mode
    if (viewMode === 'inline-editing') {
      console.log('⚠️ Already in inline editing mode, ignoring slot click');
      return;
    }

    // NEW UX: Filled slots show edit button first (no immediate editing)
    if (slot.photoId) {
      console.log('🔧 Filled slot clicked - checking for toggle behavior');
      
      // TOGGLE BEHAVIOR: If this slot is already selected with edit button showing, deselect completely
      if (selectedSlot?.id === slot.id && slotShowingEditButton?.id === slot.id) {
        console.log('🔧 Same slot clicked - toggling deselection for clean viewing');
        setSelectedSlot(null);
        setSlotShowingEditButton(null);
        console.log('✅ Slot completely deselected - clean viewing mode');
        return;
      }
      
      // Find the existing photo in the photos array
      const existingPhoto = photos.find(photo => photo.id === slot.photoId);
      
      if (existingPhoto) {
        console.log('🔧 Found existing photo, showing edit button:', {
          photo: existingPhoto.name,
          slotId: slot.id
        });
        
        // Show edit button instead of immediately entering edit mode
        setSelectedSlot(slot);
        setSlotShowingEditButton(slot);
        // Don't set inline editing states yet - wait for edit button click
        
        console.log('✅ Edit button shown for filled slot:', {
          selectedSlot: slot.id,
          slotShowingEditButton: slot.id,
          photo: existingPhoto.name
        });
        
        return; // Exit early - filled slots show edit button first
      } else {
        console.warn('🔧 Photo not found in photos array:', slot.photoId);
      }
    }

    // Empty slot behavior: select and trigger photo selection mode
    console.log('🔧 Empty slot clicked - entering photo selection mode');
    setSelectedSlot(slot);
    setIsSelectingPhoto(true); // Trigger expanded favorites bar
  };

  // Handle change button click for filled slots - opens favorites bar
  const handleChangeButtonClick = (slot: TemplateSlot) => {
    console.log('🔧 Change button clicked - opening favorites bar');
    
    // Set the slot as selected and trigger photo selection mode
    setSelectedSlot(slot);
    setIsSelectingPhoto(true);
    setSlotShowingEditButton(null); // Hide the edit buttons
    
    console.log('✅ Favorites bar expanded for photo change');
  };
  
  // Handle edit button click for filled slots - starts inline editing
  const handleEditButtonClick = (slot: TemplateSlot) => {
    console.log('🔧 Edit button clicked - starting inline editing for position/zoom');
    
    // Find the existing photo in the photos array
    const existingPhoto = photos.find(photo => photo.id === slot.photoId);
    
    if (existingPhoto) {
      console.log('🔧 Starting inline editing:', {
        photo: existingPhoto.name,
        slotId: slot.id
      });
      
      // Clear edit button state and enter inline editing mode
      setSlotShowingEditButton(null);
      setInlineEditingSlot(slot);
      setInlineEditingPhoto(existingPhoto);
      setViewMode('inline-editing');
      
      console.log('✅ Inline editing started for position/zoom adjustment');
    } else {
      console.error('❌ Photo not found when clicking edit button:', slot.photoId);
    }
  };

  // Handle remove button click for filled slots
  const handleRemoveButtonClick = (slot: TemplateSlot) => {
    console.log('🔧 Remove button clicked - showing confirmation');
    
    // Hide edit buttons and show remove confirmation
    setSlotShowingEditButton(null);
    setSlotShowingRemoveConfirmation(slot);
  };

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
    if (slot) {
      setSlotShowingEditButton(slot);
    }
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

    // Clear edit button state if shown
    if (slotShowingEditButton) {
      console.log('🔧 Background clicked - clearing edit button');
      setSlotShowingEditButton(null);
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
    setSlotShowingEditButton(null);
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
    setSlotShowingEditButton(null);
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

  const handleInlineApply = (slotId: string, photoId: string, transform: PhotoTransform) => {
    console.log('🔧 INLINE APPLY DEBUG:', { 
      slotId, 
      photoId, 
      transform,
      currentViewMode: viewMode,
      currentInlineEditingSlot: inlineEditingSlot?.id,
      currentInlineEditingPhoto: inlineEditingPhoto?.id
    });
    
    // Add timeout safety net in case the apply operation hangs
    const timeoutId = setTimeout(() => {
      console.warn('⚠️ TIMEOUT - Inline apply taking too long, force resetting states');
      forceResetEditingState();
    }, 5000); // 5 second timeout
    
    try {
      if (!slotId || !photoId) {
        throw new Error(`Missing required parameters: slotId=${slotId}, photoId=${photoId}`);
      }
      
      // Log transform details before passing
      console.log('🔄 Passing transform to handleApplyPhotoToSlot:', {
        slotId,
        photoId,
        hasTransform: !!transform,
        isValidPhotoTransform: transform ? isPhotoTransform(transform) : false,
        transformDetails: transform ? {
          photoScale: (transform as PhotoTransform).photoScale,
          photoCenterX: (transform as PhotoTransform).photoCenterX,
          photoCenterY: (transform as PhotoTransform).photoCenterY
        } : null
      });
      
      handleApplyPhotoToSlot(slotId, photoId, transform);
      console.log('✅ Photo applied successfully, resetting states');
      
      // Clear timeout since operation succeeded
      clearTimeout(timeoutId);
      
      // Reset states immediately to prevent loading flashes
      console.log('🔧 Resetting inline editing states immediately after apply');
      setViewMode('normal');
      setInlineEditingSlot(null);
      setInlineEditingPhoto(null);
      // Don't reset selectedSlot - let handleApplyPhotoToSlot handle selection logic
      
    } catch (error) {
      console.error('❌ Error in handleInlineApply:', error);
      
      // Clear timeout
      clearTimeout(timeoutId);
      
      // Force reset states even if there's an error to prevent getting stuck
      forceResetEditingState();
    }
    // NOTE: Removed collapse logic - using fixed height layout now
  };

  const handleInlineCancel = () => {
    console.log('🔧 INLINE CANCEL DEBUG:', {
      currentViewMode: viewMode,
      currentInlineEditingSlot: inlineEditingSlot?.id,
      currentInlineEditingPhoto: inlineEditingPhoto?.id
    });
    
    console.log('✅ Cancelling inline editing, resetting states');
    
    try {
      // Force reset all editing states immediately
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

  // Handle back navigation with confirmation
  const handleBackWithConfirmation = () => {
    // Reset photo selection state before navigating back
    setIsSelectingPhoto(false);
    setSelectedSlot(null);
    
    // Check if user has made any selections
    const hasSelections = templateSlots.some(slot => slot.photoId);
    
    if (hasSelections) {
      // Show confirmation dialog
      setShowBackConfirmation(true);
    } else {
      // No selections made, go back directly
      handleBack();
    }
  };

  // Confirm back navigation
  const confirmBackNavigation = () => {
    setShowBackConfirmation(false);
    setIsSelectingPhoto(false); // Ensure overlay is cleared
    setSelectedSlot(null); // Clear selected slot
    handleBack();
  };

  // Cancel back navigation
  const cancelBackNavigation = () => {
    setShowBackConfirmation(false);
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
      // All slots filled, proceed normally
      handlePhotoContinue();
    }
  };

  // Cancel incomplete finalize
  const cancelIncompleteFinalize = () => {
    setShowIncompleteWarning(false);
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
            className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center animate-fade-in"
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
              className="bg-white rounded-2xl px-12 py-10 mx-4 shadow-2xl transform animate-slide-down"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center">
                <div className="text-6xl mb-4">🖼️</div>
                <p className="text-2xl font-semibold text-gray-800">
                  Select a photo to fill the slot
                </p>
                <p className="text-base text-gray-600 mt-4">
                  Choose from your favorites below
                </p>
                <p className="text-sm text-gray-500 mt-3">
                  Tap outside or press ESC to cancel
                </p>
              </div>
            </div>
          </div>
        </>
      )}
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        PhotoSelectionScreen.tsx
      </div>

      {/* FIXED-HEIGHT LAYOUT: Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Photo Grid Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mode Header with Toggle - FIXED HEIGHT */}
          <div className="bg-white border-b p-3 flex items-center justify-between layout-header">
            <div className="flex items-center space-x-3">
              <h2 className="font-medium text-gray-800">
                {selectionMode === 'photo' ? 'Select Your Favorite Photos' : 'Fill Your Print Templates'}
              </h2>
              <div className="text-sm text-gray-600">
                {selectionMode === 'photo' 
                  ? `${favoritedPhotos.size} favorites • ${calculatePhotoLimit() - getUsedPhotoIds().size} photos available`
                  : `Templates: ${getUsedPhotoIds().size} of ${calculatePhotoLimit()} slots filled • ${getDisplayPhotos().length} favorites available`
                }
              </div>
            </div>
            
            <div className="flex items-center gap-3">
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
              
              {/* Back button for mobile - visible in header on mobile only */}
              <button
                onClick={handleBackWithConfirmation}
                className={`px-4 py-2 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200 ${
                  viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                ← Back
              </button>
              
              {/* Add Prints button - only in print mode */}
              {selectionMode === 'print' && (
                <button
                  onClick={() => setShowAddPrintsModal(true)}
                  className={`px-4 py-2 rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 transition-all duration-200 flex items-center gap-2 ${
                    viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''
                  }`}
                >
                  <span className="text-lg">+</span>
                  <span>Add Prints</span>
                </button>
              )}
            </div>
          </div>

          {/* MAIN CONTENT AREA - CALCULATED FIXED HEIGHT */}
          <div 
            className={`layout-main-content relative z-40 transition-all duration-300 ${
              viewMode === 'inline-editing' && selectionMode === 'print' 
                ? 'editing-mode' // Custom class to help with styling
                : ''
            }`}
            style={{ 
              touchAction: 'manipulation',
              // Add padding when favorites bar is expanded to prevent template cutoff
              paddingBottom: isSelectingPhoto ? 'calc(40vh - 150px)' : '0px',
              // Smooth transition for padding changes
              transition: 'padding-bottom 300ms cubic-bezier(0.4, 0, 0.2, 1)'
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
                    TemplateVisual={(props: any) => (
                      <TemplateVisual
                        {...props}
                        inlineEditingSlot={inlineEditingSlot}
                        inlineEditingPhoto={inlineEditingPhoto}
                        onInlineApply={handleInlineApply}
                        onInlineCancel={handleInlineCancel}
                        skipStateGuard={isApplyingPhoto}
                        slotShowingEditButton={slotShowingEditButton}
                        onEditButtonClick={handleEditButtonClick}
                        onChangeButtonClick={handleChangeButtonClick}
                        slotShowingRemoveConfirmation={slotShowingRemoveConfirmation}
                        onRemoveButtonClick={handleRemoveButtonClick}
                        onConfirmRemove={handleConfirmRemove}
                        onCancelRemove={handleCancelRemove}
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
        <div className="fixed bottom-[150px] left-0 right-0 z-40 bg-white border-t shadow-lg">
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
                  : 'bg-orange-500 hover:bg-orange-600'
              } text-white px-3 py-2 rounded-lg font-medium transition-all duration-200 shadow-md text-sm ${
                viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''
              }`}
            >
              Finalize ({templateSlots.filter(s => s.photoId).length}/{templateSlots.length}) ✓
            </button>
          </div>
        </div>

        {/* UNIFIED FAVORITES BAR - All screen sizes */}
        <div className={viewMode === 'inline-editing' ? 'opacity-50 pointer-events-none' : ''}>
          {/* Spacer to maintain layout when favorites bar and nav bar are fixed */}
          <div style={{ height: '210px' }} /> {/* Increased from 150px to account for nav bar (60px) */}
          
          {selectionMode === 'photo' ? (
            // Photo Selection Mode: Show Favorites Bar - FIXED HEIGHT
            <FavoritesBar
              favoritedPhotos={getUnusedFavorites()}
              onPhotoClick={handlePhotoClick}
              onRemoveFavorite={handleToggleFavorite}
              isActiveInteractionArea={false}
              layout="horizontal"
              showRemoveButtons={true}
              usedPhotoIds={getUsedPhotoIds()}
              isExpanded={false} // No expansion needed - fixed height
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
              isExpanded={isSelectingPhoto} // Expand when selecting photo for slot
              adaptivePhotoSize={isSelectingPhoto ? "large" : "medium"} // Larger photos when expanded
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

      {/* Back Navigation Confirmation Dialog */}
      <Transition appear show={showBackConfirmation} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={cancelBackNavigation}>
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
                    Are you sure you want to go back?
                  </Dialog.Title>
                  
                  <div className="mt-4">
                    <p className="text-sm text-gray-500 text-center">
                      You have selected photos for your prints. Going back will lose your current selections.
                    </p>
                    
                    <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                      <div className="text-sm text-yellow-800">
                        <strong>Current Progress:</strong>
                        <div className="mt-1">
                          • {templateSlots.filter(s => s.photoId).length} photos selected
                          <br />
                          • {templateSlots.filter(s => !s.photoId).length} slots remaining
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      onClick={cancelBackNavigation}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-lg border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                      onClick={confirmBackNavigation}
                    >
                      Yes, Go Back
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

    </div>
  );
}
 