import { Package, TemplateSlot, Photo, GoogleAuth, TemplateType, PrintSize, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform, createPhotoTransform, ManualPackage, ManualTemplate } from '../../types';
import { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
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
import PngTemplateVisual from '../PngTemplateVisual';
import PhotoGrid from '../PhotoGrid';
import TemplateGrid from '../TemplateGrid';
import TemplateSwapModal from '../TemplateSwapModal';
import FavoritesBar from '../FavoritesBar';
import OriginalTemplateVisual from '../TemplateVisual';
import { setupViewportHandler, getViewportInfo } from '../../utils/viewportUtils';
// NOTE: Added viewport utilities for iPad Safari compatibility


// Simplified TemplateVisual component
const TemplateVisual = ({ template, slots, onSlotClick, photos, selectedSlot, inlineEditingSlot, inlineEditingPhoto, onInlineApply, onInlineCancel, skipStateGuard, isActiveTemplate = true, slotShowingEditButton, onEditButtonClick, slotShowingRemoveConfirmation, onRemoveButtonClick, onConfirmRemove, onCancelRemove }: any) => {
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
  
  // Use database templates (consistent with swap modal) or fall back to window templates
  const pngTemplates = databaseTemplates.length > 0 ? databaseTemplates : windowTemplates;
  
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
    // Find exact template_type match
    const candidateTemplate = pngTemplates.find((t: any) => t.template_type === templateType);
    
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
  const [showAddPrintModal, setShowAddPrintModal] = useState(false);
  const [selectedType, setSelectedType] = useState<TemplateType | null>(null);
  const [selectedSize, setSelectedSize] = useState<PrintSize>('');
  const [availablePrintSizes, setAvailablePrintSizes] = useState<{name: PrintSize; label: string}[]>([]);
  const [addPrintQuantity, setAddPrintQuantity] = useState(1);
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
  
  // Inline editing states
  const [inlineEditingSlot, setInlineEditingSlot] = useState<TemplateSlot | null>(null);
  const [inlineEditingPhoto, setInlineEditingPhoto] = useState<Photo | null>(null);
  
  // Edit button state for filled slots (intermediate step before editing)
  const [slotShowingEditButton, setSlotShowingEditButton] = useState<TemplateSlot | null>(null);
  
  // Remove confirmation state
  const [slotShowingRemoveConfirmation, setSlotShowingRemoveConfirmation] = useState<TemplateSlot | null>(null);
  
  // Template management states (simplified)
  const [showTemplateSwapper, setShowTemplateSwapper] = useState(false);
  const [templateToSwap, setTemplateToSwap] = useState<{ templateId: string; templateName: string; slots: TemplateSlot[] } | null>(null);
  const [templateToView, setTemplateToView] = useState<{ templateId: string; templateName: string; slots: TemplateSlot[] } | null>(null);

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

  // Load available print sizes dynamically
  useEffect(() => {
    const loadPrintSizes = async () => {
      try {
        const printSizeConfigs = await printSizeService.getAvailablePrintSizes();
        const printSizeOptions = printSizeConfigs.map(config => ({
          name: config.name,
          label: config.label
        }));
        setAvailablePrintSizes(printSizeOptions);
        
        // Set default print size if none selected
        if (!selectedSize && printSizeOptions.length > 0) {
          setSelectedSize(printSizeOptions[0].name);
        }
      } catch (error) {
        console.error('Error loading print sizes:', error);
        setAvailablePrintSizes([]);
      }
    };
    
    loadPrintSizes();
  }, [selectedSize]);

  // Auto-select first empty slot when entering screen (but respect user actions)
  useEffect(() => {
    if (!selectedSlot && templateSlots.length > 0) {
      const firstEmptySlot = templateSlots.find(slot => !slot.photoId);
      if (firstEmptySlot) {
        // Only auto-select if we have empty slots and not in editing mode
        // This prevents overriding user actions during photo placement
        if (viewMode === 'normal') {
          setSelectedSlot(firstEmptySlot);
        }
      }
      // Don't auto-select anything if all slots are filled (templates complete)
      // This allows for clean view when templates are completed
    }
  }, [templateSlots, selectedSlot, setSelectedSlot, viewMode]);


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

  const openAddPrintModal = () => {
    setAddPrintQuantity(1); // Reset quantity when opening the modal
    setShowAddPrintModal(true);
  };

  const handleConfirmAddPrint = () => {
    if (selectedType) {
      // Find template from database templates
      const template = availableTemplates.find((t: ManualTemplate) => 
        t.template_type === selectedType && t.print_size === selectedSize
      );
      
      if (template) {
        const newSlotsToAdd: TemplateSlot[] = [];
        // Find the next available index for a new template to ensure unique IDs
        const existingTemplateIds = new Set(templateSlots.map(s => s.templateId));
        const nextTemplateIndex = existingTemplateIds.size;
        
        for (let i = 0; i < addPrintQuantity; i++) {
          const newTemplateId = `${template.id}_${nextTemplateIndex + i}`;
          
          for (let slotIndex = 0; slotIndex < template.holes_data.length; slotIndex++) {
            newSlotsToAdd.push({
              id: `${newTemplateId}_${slotIndex}`,
              templateId: newTemplateId,
              templateName: `${template.name} (Additional)`,
              templateType: selectedType,
              printSize: selectedSize,
              slotIndex,
              photoId: undefined
            });
          }
        }
        setTemplateSlots([...templateSlots, ...newSlotsToAdd]);
      } else {
        console.error('❌ Template not found for type:', selectedType, 'size:', selectedSize);
      }
    }
    setShowAddPrintModal(false);
    setSelectedType(null);
    // Reset to first available print size instead of hardcoded '4R'
    if (availablePrintSizes.length > 0) {
      setSelectedSize(availablePrintSizes[0].name);
    }
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
      console.log('🔧 Already in inline editing mode - delegating to handleInlinePhotoSelect');
      handleInlinePhotoSelect(photo);
      return;
    }
    
    // In print mode with a selected slot, start inline editing
    if (selectionMode === 'print' && selectedSlot) {
      console.log('🔧 STARTING INLINE EDITING:', {
        slotId: selectedSlot.id,
        photoName: photo.name,
        photoId: photo.id
      });
      
      setInlineEditingSlot(selectedSlot);
      setInlineEditingPhoto(photo);
      setViewMode('inline-editing');
      
      console.log('🔧 Inline editing states set - should trigger UI update');
    } else {
      // In photo mode or print mode without selected slot, show photo viewer
      console.log('🔧 Opening photo viewer - no selected slot or wrong mode');
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

    // Empty slot behavior: select and expand bookmarks
    console.log('🔧 Empty slot clicked - selecting and expanding bookmarks');
    setSelectedSlot(slot);
    
    // NOTE: Removed expansion logic - using fixed height layout now
  };

  // Handle edit button click for filled slots
  const handleEditButtonClick = (slot: TemplateSlot) => {
    console.log('🔧 Edit button clicked - starting inline editing');
    
    // Find the existing photo in the photos array
    const existingPhoto = photos.find(photo => photo.id === slot.photoId);
    
    if (existingPhoto) {
      console.log('🔧 Starting inline editing from edit button:', {
        photo: existingPhoto.name,
        slotId: slot.id
      });
      
      // Clear edit button state and enter inline editing mode
      setSlotShowingEditButton(null);
      setInlineEditingSlot(slot);
      setInlineEditingPhoto(existingPhoto);
      setViewMode('inline-editing');
      
      console.log('✅ Inline editing started from edit button');
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
    
    if (newTemplateSlots.length > 0) {
      // Only auto-select if there's an empty slot
      const firstEmptySlot = newTemplateSlots.find(slot => !slot.photoId);
      
      if (firstEmptySlot) {
        console.log('🎯 Auto-selecting first empty slot in new template:', {
          templateId,
          slotId: firstEmptySlot.id,
          totalSlots: newTemplateSlots.length
        });
        setSelectedSlot(firstEmptySlot);
      } else {
        // All slots filled - don't auto-select for clean viewing
        console.log('🔧 All slots filled in template - no auto-selection:', {
          templateId,
          totalSlots: newTemplateSlots.length,
          allFilled: true
        });
        setSelectedSlot(null);
      }
    } else {
      // No slots in this template (shouldn't happen but handle gracefully)
      console.warn('⚠️ No slots found for template:', templateId);
      setSelectedSlot(null);
    }
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
        // Template is complete - stay on current template instead of jumping to next
        console.log('🔧 Template completed - staying on current template');
        setSelectedSlot(currentSlot);
      } else {
        // Only auto-select next slot if the photo was placed on the currently selected template
        const currentlySelectedTemplateId = selectedSlot?.templateId;
        if (currentlySelectedTemplateId && currentSlot.templateId === currentlySelectedTemplateId) {
          // Template not complete and we're on the same template - auto-select next empty slot
          const nextEmptySlot = sameTemplateSlots.find(slot => !slot.photoId);
          if (nextEmptySlot) {
            console.log('🔧 Auto-selecting next empty slot in same template:', nextEmptySlot.id);
            setSelectedSlot(nextEmptySlot);
          }
        } else {
          // Photo was placed on a different template than currently selected - don't auto-select
          console.log('🔧 Photo placed on different template - not auto-selecting next slot');
        }
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

  // Template management handlers

  const handleConfirmTemplateSwap = (newTemplate: ManualTemplate, updatedSlots: TemplateSlot[]) => {
    console.log('🔄 PhotoSelectionScreen - Template swap confirmed:', {
      newTemplate: {
        id: newTemplate.id,
        name: newTemplate.name,
        template_type: newTemplate.template_type
      },
      updatedSlotsCount: updatedSlots.length,
      updatedSlots: updatedSlots.map(s => ({ 
        id: s.id, 
        templateId: s.templateId, 
        templateType: s.templateType, 
        photoId: s.photoId 
      }))
    });
    
    // Force React to detect the change by creating completely new array with new object references
    const forceUpdatedSlots = updatedSlots.map(slot => ({ ...slot }));
    
    console.log('🔄 PhotoSelectionScreen - Setting template slots with forced new references');
    setTemplateSlots(forceUpdatedSlots);
    setTemplateToSwap(null);
    console.log('🔄 PhotoSelectionScreen - Template swap state update completed');
  };

  const handleCloseTemplateSwap = () => {
    setShowTemplateSwapper(false);
    setTemplateToSwap(null);
  };

  const handleSwapTemplate = (template: { templateId: string; templateName: string; slots: TemplateSlot[] }) => {
    console.log('🔄 Template swap requested:', template);
    setTemplateToSwap(template);
    setShowTemplateSwapper(true);
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
        t.print_size === (firstSlot.printSize || (availablePrintSizes.length > 0 ? availablePrintSizes[0].name : ''))
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
      // TODO: Show user-friendly error message
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };



  return (
    <div className="bg-gray-50 flex flex-col lg:flex-row overflow-hidden" style={{ 
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
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        PhotoSelectionScreen.tsx
      </div>

      {/* FIXED-HEIGHT LAYOUT: Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
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
            
            <button
              onClick={handleModeToggle}
              className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                selectionMode === 'photo'
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              } ${viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''}`}
            >
              {selectionMode === 'photo' ? '📷 Ready to Fill Prints' : '⭐ Back to Photo Selection'}
            </button>
          </div>

          {/* MAIN CONTENT AREA - CALCULATED FIXED HEIGHT */}
          <div 
            className={`layout-main-content relative z-40 ${
              viewMode === 'inline-editing' && selectionMode === 'print' 
                ? 'editing-mode' // Custom class to help with styling
                : ''
            }`}
            style={{ 
              touchAction: 'manipulation'
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
              <div className="h-full" onClick={handleBackgroundClick}>
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

        {/* FIXED-HEIGHT FAVORITES BAR - Mobile/Tablet */}
        <div 
          className="lg:hidden bg-white shadow-lg border-t layout-favorites relative z-40"
          style={{ 
            touchAction: 'pan-x' // Allow horizontal scrolling for photo bar
          }}
        >
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
            // Print Filling Mode: Show Favorites Bar - FIXED HEIGHT
            <FavoritesBar
              favoritedPhotos={getDisplayPhotos()}
              onPhotoClick={handlePhotoClick}
              onRemoveFavorite={handleToggleFavorite}
              isActiveInteractionArea={viewMode === 'inline-editing'}
              layout="horizontal"
              showRemoveButtons={false}
              usedPhotoIds={getUsedPhotoIds()}
              isExpanded={false} // No expansion needed - fixed height
              adaptivePhotoSize="medium" // Fixed medium size for 150px height
            />
          )}
        </div>

        {/* Desktop: Vertical right sidebar */}
        <div className="hidden lg:flex bg-white shadow-lg border-l flex-shrink-0 flex-col relative" style={{ width: '320px' }}>
          {selectionMode === 'photo' ? (
            // Photo Selection Mode: Show Favorites using unified component
            <>
              <div className="p-4 border-b">
                <h2 className="text-sm font-bold text-gray-800 text-center">⭐ Your Favorites</h2>
                <div className="text-xs text-gray-600 text-center">
                  {favoritedPhotos.size} favorites • {calculatePhotoLimit() - getUsedPhotoIds().size} photos available
                </div>
              </div>
              <div className="flex-1 overflow-hidden">
                <FavoritesBar
                  favoritedPhotos={getUnusedFavorites()}
                  onPhotoClick={handlePhotoClick}
                  onRemoveFavorite={handleToggleFavorite}
                  isActiveInteractionArea={viewMode === 'inline-editing'}
                  layout="vertical"
                  showRemoveButtons={true}
                  usedPhotoIds={getUsedPhotoIds()}
                  isExpanded={false}
                  adaptivePhotoSize="medium"
                />
              </div>
            </>
          ) : (
            // Print Filling Mode: Show Favorites using unified component
            <>
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <button 
                    onClick={openAddPrintModal}
                    className={`bg-green-600 text-white px-2 py-1 rounded-lg font-medium hover:bg-green-700 flex items-center space-x-1 text-xs ${
                      viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    <span>Add Template</span>
                  </button>
                </div>
                <h2 className="text-sm font-bold text-gray-800 text-center">⭐ Your Favorites</h2>
                <div className="text-xs text-gray-600 text-center">
                  {getDisplayPhotos().length} available • Tap to fill slots
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <FavoritesBar
                  favoritedPhotos={getDisplayPhotos()}
                  onPhotoClick={handlePhotoClick}
                  onRemoveFavorite={handleToggleFavorite}
                  isActiveInteractionArea={viewMode === 'inline-editing'}
                  layout="vertical"
                  showRemoveButtons={false}
                  usedPhotoIds={getUsedPhotoIds()}
                  isExpanded={false}
                  adaptivePhotoSize="medium"
                />
              </div>
            </>
          )}

          {/* Desktop Navigation in Sidebar */}
          <div className="p-4 border-t bg-gray-50">
            <div className="space-y-2">
              <button
                onClick={handleBack}
                className={`w-full px-4 py-2 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200 text-sm ${
                  viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                ← Back to Package
              </button>
              <button
                onClick={handlePhotoContinue}
                className={`w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-md ${
                  viewMode === 'inline-editing' ? 'pointer-events-none opacity-60' : ''
                }`}
              >
                Finalize Selections
              </button>
            </div>
          </div>
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

      <Transition appear show={showAddPrintModal} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setShowAddPrintModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Add New Print
                  </Dialog.Title>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">PNG Template</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={selectedType || ''}
                      onChange={(e) => setSelectedType(e.target.value as TemplateType)}
                    >
                      <option value="">Select template</option>
                      {availableTemplates
                        .filter((t: ManualTemplate) => t.print_size === selectedSize)
                        .map((t: ManualTemplate) => (
                          <option key={t.id} value={t.template_type}>
                            {t.name} ({t.holes_data.length} slots)
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Print Size</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value as PrintSize)}
                      disabled={!selectedType}
                    >
                      {availablePrintSizes.map(size => (
                        <option key={size.name} value={size.name}>
                          {size.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <div className="mt-1 flex items-center rounded-md border border-gray-300 w-min">
                      <button
                        type="button"
                        className="px-3 py-1 border-r border-gray-300 text-gray-600 hover:bg-gray-100 rounded-l-md"
                        onClick={() => setAddPrintQuantity(q => Math.max(1, q - 1))}
                      >
                        -
                      </button>
                      <input
                        type="text"
                        readOnly
                        value={addPrintQuantity}
                        className="w-12 text-center border-none bg-transparent"
                      />
                      <button
                        type="button"
                        className="px-3 py-1 border-l border-gray-300 text-gray-600 hover:bg-gray-100 rounded-r-md"
                        onClick={() => setAddPrintQuantity(q => q + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowAddPrintModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700"
                      onClick={handleConfirmAddPrint}
                      disabled={!selectedType}
                    >
                      Add
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

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


      {/* Template Swapper Modal */}
      <TemplateSwapModal
        isOpen={showTemplateSwapper}
        onClose={handleCloseTemplateSwap}
        templateToSwap={templateToSwap}
        templateSlots={templateSlots}
        photos={photos}
        selectedPackage={selectedPackage as ManualPackage}
        onConfirmSwap={handleConfirmTemplateSwap}
        TemplateVisual={TemplateVisual}
      />

    </div>
  );
}
 