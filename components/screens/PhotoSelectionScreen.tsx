import { Package, TemplateSlot, Photo, GoogleAuth, TemplateType, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform, ManualPackage } from '../../types';
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
import { HybridTemplate, hybridTemplateService } from '../../services/hybridTemplateService';
import { manualTemplateService } from '../../services/manualTemplateService';
import { templateRasterizationService } from '../../services/templateRasterizationService';
import PngTemplateVisual from '../PngTemplateVisual';
import PhotoGrid from '../PhotoGrid';
import TemplateGrid from '../TemplateGrid';
import TemplateSwapModal from '../TemplateSwapModal';
import FavoritesBar from '../FavoritesBar';
import OriginalTemplateVisual from '../TemplateVisual';


// Simplified TemplateVisual component
const TemplateVisual = ({ template, slots, onSlotClick, photos, selectedSlot, inlineEditingSlot, inlineEditingPhoto, onInlineApply, onInlineCancel }: any) => {
  const pngTemplates = (window as any).pngTemplates || [];
  
  // Find PNG template using slot's templateType for better accuracy after swaps
  const templateType = slots[0]?.templateType || template.id;
  
  // STATE GUARD: Prevent rendering with mismatched template data during navigation
  const isDataConsistent = slots.every((slot: any) => {
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
    isSoloTemplate: templateType === 'solo' || template.id === 'solo',
    // Track where templateType comes from
    templateTypeSource: slots[0]?.templateType ? 'slots[0].templateType' : 'template.id',
    slots0TemplateType: slots[0]?.templateType,
    templateIdValue: template.id
  });
  
  // Safety check to ensure window.pngTemplates is populated
  if (pngTemplates.length === 0) {
    console.warn('🚨 SOLO TEMPLATE DEBUG - No PNG templates found in window.pngTemplates');
  } else {
    console.log('✅ SOLO TEMPLATE DEBUG - PNG templates loaded:', {
      totalCount: pngTemplates.length,
      soloTemplates: pngTemplates.filter((t: any) => t.template_type === 'solo' || t.templateType === 'solo'),
      allTemplateTypes: [...new Set(pngTemplates.map((t: any) => t.template_type || t.templateType))],
      firstFewTemplates: pngTemplates.slice(0, 3).map((t: any) => ({
        id: t.id,
        name: t.name,
        template_type: t.template_type,
        templateType: t.templateType,
        holesCount: t.holes?.length || 0
      }))
    });
  }
  
  console.log('🔍 SOLO TEMPLATE DEBUG - TemplateVisual matching:', {
    templateType,
    templateId: template.id,
    isSolo: templateType === 'solo' || template.id === 'solo',
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
  
  // Enhanced template matching logic with multiple fallback strategies
  // NAVIGATION PROTECTION: Only proceed with matching if we have consistent data
  let pngTemplate = null;
  
  if (pngTemplates.length > 0 && templateType) {
    // Primary matching strategy with better solo template handling
    pngTemplate = 
      // 1. Exact match on template_type field
      pngTemplates.find((t: any) => t.template_type === templateType) || 
      // 2. Exact match on templateType field  
      pngTemplates.find((t: any) => t.templateType === templateType) ||
      // 3. Match template.id (for legacy compatibility)
      pngTemplates.find((t: any) => t.template_type === template.id) ||
      // 4. Match by ID
      pngTemplates.find((t: any) => t.id === templateType);
      
    // 5. Enhanced solo template fallback - try multiple properties and patterns
    if (!pngTemplate && (templateType === 'solo' || template.id === 'solo')) {
      console.log('🔍 SOLO TEMPLATE DEBUG - Enhanced solo template search...', {
        totalTemplates: pngTemplates.length,
        searchingFor: 'solo templates with various property patterns'
      });
      
      // Try multiple solo template patterns
      pngTemplate = 
        // Try template_type === 'solo'
        pngTemplates.find((t: any) => t.template_type === 'solo') ||
        // Try templateType === 'solo' 
        pngTemplates.find((t: any) => t.templateType === 'solo') ||
        // Try id === 'solo'
        pngTemplates.find((t: any) => t.id === 'solo') ||
        // Try name containing 'solo' (case insensitive)
        pngTemplates.find((t: any) => t.name?.toLowerCase().includes('solo')) ||
        // Try templates with single hole (solo characteristic)
        pngTemplates.find((t: any) => t.holes?.length === 1) ||
        // Last resort - use first available template for solo
        pngTemplates[0];
      
      if (pngTemplate) {
        console.log('✅ SOLO TEMPLATE DEBUG - Found solo template using enhanced search:', {
          id: pngTemplate.id,
          name: pngTemplate.name,
          template_type: pngTemplate.template_type,
          templateType: pngTemplate.templateType,
          holesCount: pngTemplate.holes?.length || 0,
          matchedBy: 
            pngTemplate.template_type === 'solo' ? 'template_type=solo' :
            pngTemplate.templateType === 'solo' ? 'templateType=solo' :
            pngTemplate.id === 'solo' ? 'id=solo' :
            pngTemplate.name?.toLowerCase().includes('solo') ? 'name contains solo' :
            pngTemplate.holes?.length === 1 ? 'single hole template' :
            'first available template'
        });
      }
    }
    
    // 6. Fallback for other template types
    if (!pngTemplate && templateType !== 'solo' && template.id !== 'solo') {
      pngTemplate = pngTemplates[0];
      console.log('🔄 Using first available template for non-solo type:', templateType);
    }
  } else {
    console.warn('🛡️ NAVIGATION PROTECTION - Skipping PNG template matching due to invalid state:', {
      pngTemplatesCount: pngTemplates.length,
      templateType: templateType,
      hasValidTemplateType: !!templateType
    });
  }

  // NAVIGATION DEBUG: Track the final decision
  const matchResult = pngTemplate ? {
    id: pngTemplate.id,
    name: pngTemplate.name,
    template_type: pngTemplate.template_type,
    templateType: pngTemplate.templateType,
    holesCount: pngTemplate.holes?.length || 0,
    matchedBy: pngTemplates.find((t: any) => t.template_type === templateType) ? 'template_type===templateType' :
               pngTemplates.find((t: any) => t.templateType === templateType) ? 'templateType===templateType' :
               pngTemplates.find((t: any) => t.template_type === template.id) ? 'template_type===template.id' :
               pngTemplates.find((t: any) => t.id === templateType) ? 'id===templateType' :
               (templateType === 'solo' || template.id === 'solo') && 
               pngTemplates.find((t: any) => t.template_type === 'solo' || t.templateType === 'solo') ? 'solo-fallback' : 'first-available'
  } : `NO PNG TEMPLATE FOUND - Will use legacy fallback for ${templateType}`;

  console.log('🎯 NAVIGATION DEBUG - Template matching result:', {
    searchedFor: templateType,
    templateId: template.id,
    isSolo: templateType === 'solo' || template.id === 'solo',
    result: matchResult,
    willUsePngTemplateVisual: !!pngTemplate,
    willUseLegacyFallback: !pngTemplate
  });

  if (pngTemplate) {
    console.log('✅ NAVIGATION DEBUG - Using PngTemplateVisual for:', templateType, 'with template:', pngTemplate.name);
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
      />
    );
  }

  // Emergency fallback for solo templates - should not be needed with enhanced matching above
  if ((templateType === 'solo' || template.id === 'solo') && pngTemplates.length > 0 && !pngTemplate) {
    console.warn('🚨 EMERGENCY FALLBACK - Solo template matching failed, using first available PNG template');
    pngTemplate = pngTemplates[0];
  }

  // If we now have a PNG template (including from emergency fallback), use it
  if (pngTemplate) {
    console.log('✅ NAVIGATION DEBUG - Using PngTemplateVisual with fallback template:', pngTemplate.name);
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
      />
    );
  }

  // Fallback to legacy TemplateVisual only when no PNG templates are available at all
  console.log('❌ NAVIGATION DEBUG - Using legacy TemplateVisual fallback for:', templateType, '(No PNG templates available)');
  return (
    <OriginalTemplateVisual
      template={template}
      slots={slots}
      onSlotClick={onSlotClick}
      photos={photos}
      selectedSlot={selectedSlot}
    />
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
  const [selectedSize, setSelectedSize] = useState<'4R' | '5R' | 'A4'>('4R');
  const [addPrintQuantity, setAddPrintQuantity] = useState(1);
  const [hasScrolled, setHasScrolled] = useState(false);
  const [availableTemplates, setAvailableTemplates] = useState<HybridTemplate[]>([]);
  
  // Two-mode system for photo selection
  const [selectionMode, setSelectionMode] = useState<'photo' | 'print'>('photo'); // Default to photo selection mode
  const [favoritedPhotos, setFavoritedPhotos] = useState<Set<string>>(new Set()); // Photo IDs that are favorited
  
  // Simplified workflow states
  const [viewMode, setViewMode] = useState<'normal' | 'photo-viewer' | 'sliding-templates' | 'template-first' | 'photo-selection' | 'inline-editing'>('normal');
  const [selectedPhotoForViewer, setSelectedPhotoForViewer] = useState<Photo | null>(null);
  const [selectedPhotoForTemplate, setSelectedPhotoForTemplate] = useState<Photo | null>(null);
  const [selectedTemplateForViewer, setSelectedTemplateForViewer] = useState<string | null>(null);
  const [selectedSlotForEditor, setSelectedSlotForEditor] = useState<TemplateSlot | null>(null);
  
  // Inline editing states
  const [inlineEditingSlot, setInlineEditingSlot] = useState<TemplateSlot | null>(null);
  const [inlineEditingPhoto, setInlineEditingPhoto] = useState<Photo | null>(null);
  
  // Template management states (simplified)
  const [showTemplateSwapper, setShowTemplateSwapper] = useState(false);
  const [templateToSwap, setTemplateToSwap] = useState<{ templateId: string; templateName: string; slots: TemplateSlot[] } | null>(null);
  const [templateToView, setTemplateToView] = useState<{ templateId: string; templateName: string; slots: TemplateSlot[] } | null>(null);

  // Load available templates
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        // Use hybrid template service to get BOTH manual AND auto-detected templates
        const allHybridTemplates = await hybridTemplateService.getAllTemplates();
        console.log('🔄 PhotoSelectionScreen - Loaded hybrid templates:', {
          totalCount: allHybridTemplates.length,
          manualCount: allHybridTemplates.filter(t => t.source === 'manual').length,
          autoCount: allHybridTemplates.filter(t => t.source === 'auto').length,
          templateTypes: [...new Set(allHybridTemplates.map(t => t.template_type))],
          templateNames: allHybridTemplates.map(t => t.name)
        });
        setAvailableTemplates(allHybridTemplates);
      } catch (error) {
        console.error('❌ Error loading templates:', error);
        setAvailableTemplates([]);
      }
    };
    loadTemplates();
  }, []);

  // Auto-select first empty slot when entering screen (but respect completed templates)
  useEffect(() => {
    if (!selectedSlot && templateSlots.length > 0) {
      const firstEmptySlot = templateSlots.find(slot => !slot.photoId);
      if (firstEmptySlot) {
        // Only auto-select if we have empty slots (not all templates are complete)
        setSelectedSlot(firstEmptySlot);
      }
      // Don't auto-select anything if all slots are filled (templates complete)
      // This allows for clean view when templates are completed
    }
  }, [templateSlots, selectedSlot, setSelectedSlot]);


  const onSlotSelect = (slot: TemplateSlot) => {
    setSelectedSlot(slot);
    const templateToEdit = templateSlots.filter(s => s.templateId === slot.templateId);
    setEditingTemplate(templateToEdit);
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
      // Find template from hybrid templates
      const template = availableTemplates.find((t: HybridTemplate) => 
        t.template_type === selectedType && t.print_size === selectedSize
      );
      
      if (template) {
        const newSlotsToAdd: TemplateSlot[] = [];
        // Find the next available index for a new template to ensure unique IDs
        const existingTemplateIds = new Set(templateSlots.map(s => s.templateId));
        const nextTemplateIndex = existingTemplateIds.size;
        
        for (let i = 0; i < addPrintQuantity; i++) {
          const newTemplateId = `${template.id}_${nextTemplateIndex + i}`;
          
          for (let slotIndex = 0; slotIndex < template.holes.length; slotIndex++) {
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
    setSelectedSize('4R');
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
    console.log('🔧 handlePhotoClick called:', {
      photoId: photo.id,
      photoName: photo.name,
      currentViewMode: viewMode,
      currentSelectionMode: selectionMode,
      hasSelectedSlot: !!selectedSlot,
      selectedSlotId: selectedSlot?.id,
      isInlineEditing: viewMode === 'inline-editing'
    });

    // Check if we're in inline editing mode first
    if (viewMode === 'inline-editing') {
      console.log('🔧 Photo clicked in inline editing mode - delegating to handleInlinePhotoSelect');
      handleInlinePhotoSelect(photo);
      return;
    }
    
    // In print mode with a selected slot, start inline editing
    if (selectionMode === 'print' && selectedSlot) {
      console.log('🔧 Starting inline editing - print mode with selected slot:', selectedSlot.id);
      setInlineEditingSlot(selectedSlot);
      setInlineEditingPhoto(photo);
      setViewMode('inline-editing');
    } else {
      // In photo mode or print mode without selected slot, show photo viewer
      console.log('🔧 Opening photo viewer - photo mode or no selected slot');
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
    // Check if slot is empty - if so, start inline editing
    if (!slot.photoId) {
      console.log('🔧 Starting inline editing for empty slot:', slot.id);
      setInlineEditingSlot(slot);
      setViewMode('inline-editing');
    } else {
      setSelectedSlot(slot); // Just highlight the slot for filled slots
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

    // Check if all templates are complete (all slots have photos)
    const allSlotsHavePhotos = templateSlots.every(slot => slot.photoId);
    
    if (allSlotsHavePhotos && selectedSlot) {
      console.log('🔧 Background clicked - deselecting for clean view');
      setSelectedSlot(null);
    }
  };

  // Template editor
  const handleApplyPhotoToSlot = (slotId: string, photoId: string, transform?: PhotoTransform | ContainerTransform) => {
    console.log('🔧 FULLSCREEN EDITOR - Apply button clicked:', { slotId, photoId, transform });
    console.log('🔧 Current templateSlots before update:', templateSlots.map(s => ({ id: s.id, photoId: s.photoId, hasTransform: !!s.transform })));
    
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
        // Create a completely new slot object to ensure React detects the change
        const newSlot = {
          ...s,
          photoId: photoId, // Ensure the photoId is properly set
          transform: transform || s.transform // Keep existing transform if none provided
        };
        console.log('🔧 Creating new slot object:', newSlot);
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
        // Template is complete - deselect for clean view
        console.log('🔧 Template completed - deselecting for clean view');
        setSelectedSlot(null);
      } else {
        // Template not complete - auto-select next empty slot in same template
        const nextEmptySlot = sameTemplateSlots.find(slot => !slot.photoId);
        if (nextEmptySlot) {
          console.log('🔧 Auto-selecting next empty slot in same template:', nextEmptySlot.id);
          setSelectedSlot(nextEmptySlot);
        }
      }
    }
    
    // Reset states and return to normal view
    console.log('🔧 Resetting view states and closing fullscreen editor');
    resetViewStates();
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
  };

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
    console.log('🔧 Inline apply:', { slotId, photoId, transform });
    handleApplyPhotoToSlot(slotId, photoId, transform);
    setViewMode('normal');
    setInlineEditingSlot(null);
    setInlineEditingPhoto(null);
  };

  const handleInlineCancel = () => {
    console.log('🔧 Inline editing cancelled');
    setViewMode('normal');
    setInlineEditingSlot(null);
    setInlineEditingPhoto(null);
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

  const handleConfirmTemplateSwap = (newTemplate: HybridTemplate, updatedSlots: TemplateSlot[]) => {
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
    
    // Force a small delay to ensure state update is processed
    setTimeout(() => {
      console.log('🔄 PhotoSelectionScreen - Template swap state update completed');
    }, 100);
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
      // TODO: Show user-friendly error message
      alert(`Download failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };



  return (
    <div className="h-screen bg-gray-50 flex flex-col lg:flex-row overflow-hidden" style={{ touchAction: 'pan-x pan-y' }}>
      
      {/* Spotlight Overlay - Show in inline editing OR when slot selected in print mode */}
      {(viewMode === 'inline-editing' || (selectedSlot && selectionMode === 'print')) && (
        <>
          {/* Mobile/Tablet: Full screen overlay with cutouts for favorites and selected slot */}
          <div 
            className="lg:hidden fixed inset-0 z-30 bg-black bg-opacity-70 pointer-events-none"
          />
          
          {/* Desktop: darken only the header area, leave template area and sidebar clear */}
          <div 
            className="hidden lg:block fixed top-0 left-0 z-30 bg-black bg-opacity-70 pointer-events-none"
            style={{ 
              right: '320px', // Leave space for desktop sidebar (320px wide)
              height: '80px' // Only darken the header area, leave template area visible
            }}
          />
          
          {/* Clickable overlay for canceling - only on darkened areas */}
          {/* Mobile clickable area - full screen except elevated elements */}
          <div 
            className="lg:hidden fixed inset-0 z-25"
            onClick={handleOverlayCancel}
          />
          
          {/* Desktop clickable area - only header */}
          <div 
            className="hidden lg:block fixed top-0 left-0 z-25"
            style={{ 
              right: '320px', // Match the darkened area width
              height: '80px' // Match the darkened area height
            }}
            onClick={handleOverlayCancel}
          />
        </>
      )}
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        PhotoSelectionScreen.tsx
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Photo Grid Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Mode Header with Toggle */}
          <div className="bg-white border-b p-3 flex items-center justify-between">
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
              }`}
            >
              {selectionMode === 'photo' ? '📷 Ready to Fill Prints' : '⭐ Back to Photo Selection'}
            </button>
          </div>

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
            />
          ) : (
            // Print mode: Show templates in Cover Flow
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="p-4 text-center bg-gray-50 border-b flex-shrink-0" onClick={handleBackgroundClick}>
                <h3 className="text-lg font-medium text-gray-800 mb-1">Your Print Templates</h3>
                <p className="text-sm text-gray-600">
                  Click templates or use arrow keys to navigate • Click slots to fill with photos • Click empty space to deselect
                </p>
                {selectedSlot && (
                  <div className="mt-2 text-sm text-white bg-blue-600 px-3 py-1 rounded-full inline-block">
                    📍 Selected: {selectedSlot.templateName} - Slot {selectedSlot.slotIndex + 1}
                  </div>
                )}
              </div>
              <div className="flex-1 relative z-40" onClick={handleBackgroundClick}>
                <TemplateGrid
                  templateSlots={templateSlots}
                  photos={photos}
                  selectedSlot={selectedSlot}
                  onSlotClick={handleSlotSelectFromTemplate}
                  onSwapTemplate={handleSwapTemplate}
                  onDeleteTemplate={handleDeletePrint}
                  onDownloadTemplate={handleDownloadTemplate}
                  TemplateVisual={(props: any) => (
                    <TemplateVisual
                      {...props}
                      inlineEditingSlot={inlineEditingSlot}
                      inlineEditingPhoto={inlineEditingPhoto}
                      onInlineApply={handleInlineApply}
                      onInlineCancel={handleInlineCancel}
                    />
                  )}
                  layout="coverflow"
                  showActions={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* Two-Mode Bottom Section - Mobile/Tablet */}
        <div className="lg:hidden bg-white shadow-lg border-t flex-shrink-0 relative z-40" style={{ 
          height: '140px', // Consistent height for both modes
          touchAction: 'pan-x' 
        }}>
          {selectionMode === 'photo' ? (
            // Photo Selection Mode: Show Favorites Bar
            <FavoritesBar
              favoritedPhotos={getUnusedFavorites()}
              onPhotoClick={handlePhotoClick}
              onRemoveFavorite={handleToggleFavorite}
              isActiveInteractionArea={false}
              layout="horizontal"
              showRemoveButtons={true}
              usedPhotoIds={getUsedPhotoIds()}
            />
          ) : (
            // Print Filling Mode: Show Favorites Bar with controls
            <div className="h-full flex flex-col">
              <div className="flex-shrink-0 p-2 border-b bg-gray-50 relative">
                <div className="flex items-center justify-between mb-1">
                  <button
                    onClick={handleBack}
                    className="flex items-center space-x-1 px-2 py-1 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all duration-200 text-xs"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    <span>Back</span>
                  </button>
                  
                  <button 
                    onClick={openAddPrintModal} 
                    className="bg-green-600 text-white px-2 py-1 rounded-lg font-medium hover:bg-green-700 flex items-center space-x-1 text-xs"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    <span>Add</span>
                  </button>

                  <button
                    onClick={handlePhotoContinue}
                    className="bg-blue-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 text-xs"
                  >
                    Done
                  </button>
                </div>
                <h2 className="text-xs font-bold text-gray-800 text-center">⭐ Your Favorites • {getDisplayPhotos().length} available</h2>
              </div>
              <div className="flex-1 overflow-hidden relative">
                <FavoritesBar
                  favoritedPhotos={getDisplayPhotos()}
                  onPhotoClick={handlePhotoClick}
                  onRemoveFavorite={handleToggleFavorite}
                  isActiveInteractionArea={viewMode === 'inline-editing'}
                  layout="horizontal"
                  showRemoveButtons={false}
                  usedPhotoIds={getUsedPhotoIds()}
                />
              </div>
            </div>
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
                    className="bg-green-600 text-white px-2 py-1 rounded-lg font-medium hover:bg-green-700 flex items-center space-x-1 text-xs"
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
                />
              </div>
            </>
          )}

          {/* Desktop Navigation in Sidebar */}
          <div className="p-4 border-t bg-gray-50">
            <div className="space-y-2">
              <button
                onClick={handleBack}
                className="w-full px-4 py-2 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200 text-sm"
              >
                ← Back to Package
              </button>
              <button
                onClick={handlePhotoContinue}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-md"
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
                        .filter((t: HybridTemplate) => t.print_size === selectedSize)
                        .map((t: HybridTemplate) => (
                          <option key={t.id} value={t.template_type}>
                            {t.name} ({t.holes.length} slots) - {t.source}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Print Size</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value as '4R' | '5R' | 'A4')}
                      disabled={!selectedType || selectedType !== 'solo'}
                    >
                      <option value="4R">4R</option>
                      {selectedType === 'solo' && (
                        <>
                          <option value="5R">5R</option>
                          <option value="A4">A4</option>
                        </>
                      )}
                    </select>
                    {selectedType && selectedType !== 'solo' && (
                      <p className="mt-1 text-xs text-gray-500">Only Solo supports 5R/A4</p>
                    )}
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
 