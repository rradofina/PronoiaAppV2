import { Package, TemplateSlot, Photo, GoogleAuth, TemplateType } from '../../types';
import { useState, useEffect, useRef } from 'react';
import { PRINT_SIZES, TEMPLATE_TYPES } from '../../utils/constants';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import InlineTemplateEditor from '../InlineTemplateEditor';
import FullscreenPhotoViewer from '../FullscreenPhotoViewer';
import TemplateSelector from '../TemplateSelector';
import FullscreenTemplateEditor from '../FullscreenTemplateEditor';
import FullscreenTemplateSelector from '../FullscreenTemplateSelector';
import PhotoSelectionMode from '../PhotoSelectionMode';
import SlidingTemplateBar from '../SlidingTemplateBar';
import { hybridTemplateService, HybridTemplate } from '../../services/hybridTemplateService';
import { manualTemplateService } from '../../services/manualTemplateService';
import { templateCacheService } from '../../services/templateCacheService';
import PngTemplateVisual from '../PngTemplateVisual';

// PROPER TemplateVisual - Uses PNG template data from window.pngTemplates
const TemplateVisual = ({ template, slots, onSlotClick, photos, selectedSlot }: any) => {
  // Get the actual PNG template data from window
  const pngTemplates = (window as any).pngTemplates || [];
  
  // Debug: Check if templates are loaded at all
  if (pngTemplates.length === 0) {
    console.warn('⚠️ No PNG templates found in window.pngTemplates - templates may not be loaded yet');
  }
  
  // Find the PNG template that matches this template ID
  let pngTemplate = pngTemplates.find((t: any) => {
    // Match by template type and first slot's templateId
    const templateId = slots[0]?.templateId || '';
    return templateId.includes(t.id) || 
           t.template_type === template.id ||
           t.id.includes(template.id) ||
           template.id.includes(t.template_type);
  });
  
  // TEMP DEBUG: If no match found, use the first available PNG template of same type
  if (!pngTemplate && pngTemplates.length > 0) {
    pngTemplate = pngTemplates.find((t: any) => t.template_type === template.id) || pngTemplates[0];
    console.log('🔧 Using fallback PNG template:', pngTemplate?.name);
  }

  console.log('🎨 TemplateVisual render:', {
    templateId: template.id,
    templateName: template.name,
    slotsCount: slots.length,
    pngTemplatesAvailable: pngTemplates.length,
    foundPngTemplate: !!pngTemplate,
    pngTemplateName: pngTemplate?.name,
    firstSlotTemplateId: slots[0]?.templateId,
    pngTemplateKeys: pngTemplate ? Object.keys(pngTemplate) : [],
    fullPngTemplate: pngTemplate,
    availablePngTemplates: pngTemplates.map((t: any) => ({ id: t.id, type: t.template_type, name: t.name }))
  });

  if (pngTemplate) {
    // Use the proper PNG template visual
    return (
      <PngTemplateVisual
        pngTemplate={pngTemplate}
        templateSlots={slots}
        onSlotClick={onSlotClick}
        photos={photos}
        selectedSlot={selectedSlot}
      />
    );
  }

  // Fallback for when PNG template not found
  return (
    <div className="bg-white p-3 rounded-lg shadow-md w-full h-full">
      <div className="text-center text-gray-500 mb-2">
        <div className="text-lg font-medium">{template.name}</div>
        <div className="text-sm">{slots.length} photos</div>
        <div className="text-xs text-red-500">PNG template not found</div>
      </div>
      
      {/* Simple grid for photos as fallback */}
      <div className="grid grid-cols-2 gap-2 h-32">
        {slots.slice(0, 4).map((slot: any, index: number) => {
          const photo = photos.find((p: any) => p.id === slot.photoId);
          const isSelected = selectedSlot?.id === slot.id;
          
          return (
            <div
              key={slot.id || index}
              className={`border-2 border-dashed cursor-pointer transition-all duration-200 ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'
              }`}
              onClick={() => onSlotClick(slot)}
            >
              {photo?.url ? (
                <img
                  src={photo.url}
                  alt={`Photo ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100">
                  {/* Remove fallback numbers for cleaner look */}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface PhotoSelectionScreenProps {
  clientName: string;
  selectedPackage: Package | null;
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
  
  // New workflow states
  const [viewMode, setViewMode] = useState<'normal' | 'photo-viewer' | 'sliding-templates' | 'template-editor' | 'template-first' | 'photo-selection'>('normal');
  const [selectedPhotoForViewer, setSelectedPhotoForViewer] = useState<Photo | null>(null);
  const [selectedPhotoForTemplate, setSelectedPhotoForTemplate] = useState<Photo | null>(null);
  const [selectedTemplateForViewer, setSelectedTemplateForViewer] = useState<string | null>(null);
  const [selectedSlotForEditor, setSelectedSlotForEditor] = useState<TemplateSlot | null>(null);
  
  // Template management states
  const [showTemplateViewer, setShowTemplateViewer] = useState(false);
  const [showTemplateSwapper, setShowTemplateSwapper] = useState(false);
  const [templateToView, setTemplateToView] = useState<{ templateId: string; templateName: string; slots: TemplateSlot[] } | null>(null);
  const [templateToSwap, setTemplateToSwap] = useState<{ templateId: string; templateName: string; slots: TemplateSlot[] } | null>(null);
  const [selectedNewTemplate, setSelectedNewTemplate] = useState<any>(null);
  
  // Separate state for preview - don't touch main templateSlots
  const [previewSlots, setPreviewSlots] = useState<TemplateSlot[]>([]);

  // Load available templates for add print modal and template swapping
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        // For template swapping, we need ALL manual templates from database
        const allManualTemplates = await manualTemplateService.getAllTemplates();
        
        console.log('📋 Loaded manual templates for swapping:', allManualTemplates.length);
        console.log('📋 Manual template names:', allManualTemplates.map(t => `${t.name}(${t.template_type})`));
        setAvailableTemplates(allManualTemplates.map(manual => ({
          id: manual.id,
          name: manual.name,
          description: manual.description,
          template_type: manual.template_type,
          print_size: manual.print_size,
          drive_file_id: manual.drive_file_id,
          driveFileId: manual.drive_file_id,
          holes: manual.holes_data,
          dimensions: manual.dimensions,
          thumbnail_url: manual.thumbnail_url,
          sample_image_url: manual.sample_image_url,
          base64_preview: manual.base64_preview,
          source: 'manual' as const,
          is_active: manual.is_active
        })));
      } catch (error) {
        console.error('❌ Error loading templates:', error);
        // Fallback to package templates if hybrid service fails
        const packageTemplates = (window as any).pngTemplates || [];
        setAvailableTemplates(packageTemplates);
      }
    };
    loadTemplates();
  }, [selectedPackage]);

  // Auto-select current template when swap modal opens
  useEffect(() => {
    console.log('🔄 Auto-select useEffect triggered:', {
      showTemplateSwapper,
      hasTemplateToSwap: !!templateToSwap,
      availableTemplatesCount: availableTemplates.length,
      templateToSwapData: templateToSwap ? {
        templateId: templateToSwap.templateId,
        templateName: templateToSwap.templateName,
        slotsCount: templateToSwap.slots.length
      } : null
    });

    if (showTemplateSwapper && templateToSwap && availableTemplates.length > 0) {
      console.log('🔍 Starting template matching process...');
      console.log('📋 Available templates:', availableTemplates.map(t => ({
        id: t.id,
        name: t.name,
        template_type: t.template_type,
        print_size: t.print_size
      })));

      console.log('🎯 Template to match:', {
        originalName: templateToSwap.templateName,
        templateId: templateToSwap.templateId,
        templateIdParts: templateToSwap.templateId.split('_'),
        templateType: templateToSwap.templateId.split('_')[0]
      });

      // Try to find the current template by name first, then by type
      const currentTemplate = availableTemplates.find(t => {
        // Remove "(Additional)" suffix for matching
        const cleanTemplateName = templateToSwap.templateName.replace(' (Additional)', '');
        const nameMatch = t.name === cleanTemplateName;
        const typeMatch = t.template_type === templateToSwap.templateId.split('_')[0];
        
        console.log('🔍 Checking template:', {
          availableTemplate: { id: t.id, name: t.name, type: t.template_type },
          cleanTemplateName,
          nameMatch,
          typeMatch,
          willMatch: nameMatch || typeMatch
        });
        
        return nameMatch || typeMatch;
      });
      
      console.log('🎯 Matching result:', currentTemplate ? {
        matched: true,
        template: { id: currentTemplate.id, name: currentTemplate.name, type: currentTemplate.template_type }
      } : { matched: false });

      if (currentTemplate) {
        console.log('✅ Setting selectedNewTemplate to:', currentTemplate.name);
        setSelectedNewTemplate(currentTemplate);
        setPreviewSlots(templateToSwap.slots);
      } else {
        console.log('❌ No match found, using first available template');
        if (availableTemplates.length > 0) {
          setSelectedNewTemplate(availableTemplates[0]);
          setPreviewSlots(templateToSwap.slots);
        }
      }
    } else if (!showTemplateSwapper) {
      console.log('🔄 Resetting template swapper states');
      setPreviewSlots([]);
      setSelectedNewTemplate(null);
    } else {
      console.log('⏳ Waiting for conditions:', {
        showTemplateSwapper,
        hasTemplateToSwap: !!templateToSwap,
        availableTemplatesCount: availableTemplates.length
      });
    }
  }, [showTemplateSwapper, templateToSwap, availableTemplates]);

  // Auto-select first empty placeholder when entering screen
  useEffect(() => {
    if (!selectedSlot && templateSlots.length > 0) {
      // Find the first empty slot (no photo assigned)
      const firstEmptySlot = templateSlots.find(slot => !slot.photoId);
      if (firstEmptySlot) {
        setSelectedSlot(firstEmptySlot);
      } else {
        // If all slots have photos, select the first slot anyway
        setSelectedSlot(templateSlots[0]);
      }
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

  const handleInlinePhotoSelect = (photo: Photo, slotId: string) => {
    const updatedSlots = templateSlots.map(s =>
      s.id === slotId ? { ...s, photoId: photo.id } : s
    );
    setTemplateSlots(updatedSlots);
    setEditingTemplate(updatedSlots.filter(s => s.templateId === editingTemplate?.[0].templateId));
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
    setSelectedPhotoForViewer(photo);
    setViewMode('photo-viewer');
  };

  const handleAddToTemplate = (photo: Photo) => {
    setSelectedPhotoForTemplate(photo);
    if (selectedSlot) {
      // If we have a selected slot, go directly to template editor
      setSelectedSlotForEditor(selectedSlot);
      setViewMode('template-editor');
    } else {
      // Fallback to sliding templates if no slot selected
      setViewMode('sliding-templates');
    }
  };

  const handleSlotSelectFromSlidingBar = (slot: TemplateSlot) => {
    setSelectedSlotForEditor(slot);
    setViewMode('template-editor');
  };

  // Template-first workflow  
  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplateForViewer(templateId);
    setViewMode('template-first');
  };

  const handleSlotSelectFromTemplate = (slot: TemplateSlot) => {
    setSelectedSlot(slot); // Just highlight the slot, stay in normal view
  };

  const handlePhotoSelectForSlot = (photo: Photo) => {
    setSelectedPhotoForTemplate(photo);
    setViewMode('template-editor');
  };

  // Template editor
  const handleApplyPhotoToSlot = (slotId: string, photoId: string, transform?: { scale: number; x: number; y: number }) => {
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
    
    // Auto-select next empty slot
    const nextEmptySlot = updatedSlots.find(slot => !slot.photoId && slot.id !== slotId);
    if (nextEmptySlot) {
      console.log('🔧 Auto-selecting next empty slot:', nextEmptySlot.id);
      setSelectedSlot(nextEmptySlot);
    }
    
    // Reset states and return to normal view
    console.log('🔧 Resetting view states and closing fullscreen editor');
    resetViewStates();
  };

  const resetViewStates = () => {
    setViewMode('normal');
    setSelectedPhotoForViewer(null);
    setSelectedPhotoForTemplate(null);
    setSelectedTemplateForViewer(null);
    setSelectedSlotForEditor(null);
  };

  // Template management handlers
  const handleViewTemplate = (template: { templateId: string; templateName: string; slots: TemplateSlot[] }) => {
    setTemplateToView(template);
    setShowTemplateViewer(true);
  };

  const handleSwapTemplate = (template: { templateId: string; templateName: string; slots: TemplateSlot[] }) => {
    console.log('🚀 handleSwapTemplate called with:', {
      templateId: template.templateId,
      templateName: template.templateName,
      availableTemplatesCount: availableTemplates.length
    });
    
    setTemplateToSwap(template);
    setShowTemplateSwapper(true);
    
    // Force auto-selection immediately after modal opens
    setTimeout(() => {
      console.log('⏰ Forcing auto-selection check...');
      if (availableTemplates.length > 0) {
        const cleanTemplateName = template.templateName.replace(' (Additional)', '');
        const currentTemplate = availableTemplates.find(t => {
          const nameMatch = t.name === cleanTemplateName;
          const typeMatch = t.template_type === template.templateId.split('_')[0];
          
          console.log('🔍 Force checking template:', {
            availableTemplate: { id: t.id, name: t.name, type: t.template_type },
            cleanTemplateName,
            nameMatch,
            typeMatch
          });
          
          return nameMatch || typeMatch;
        });
        
        if (currentTemplate) {
          console.log('✅ Force setting selectedNewTemplate to:', currentTemplate.name);
          setSelectedNewTemplate(currentTemplate);
          setPreviewSlots(template.slots);
        } else {
          console.log('❌ No match found, using first available');
          setSelectedNewTemplate(availableTemplates[0]);
          setPreviewSlots(template.slots);
        }
      }
    }, 100);
  };

  const handleTemplateSelect = (selectedTemplate: any) => {
    setSelectedNewTemplate(selectedTemplate);
    
    // Update ONLY the preview slots for the template bar display
    if (templateToSwap && selectedTemplate) {
      // Create new slots based on the selected template
      const newSlotCount = selectedTemplate.holes?.length || 1;
      const newPreviewSlots: TemplateSlot[] = Array.from({ length: newSlotCount }, (_, index) => ({
        id: `preview_${selectedTemplate.id}_${Date.now()}_${index}`,
        templateId: templateToSwap.templateId, // Keep same templateId to maintain position
        templateName: `${selectedTemplate.name || selectedTemplate.template_type}`,
        templateType: selectedTemplate.template_type,
        slotIndex: index,
        photoId: templateToSwap.slots[index]?.photoId || undefined, // Keep existing photos if possible
        transform: templateToSwap.slots[index]?.transform || undefined, // Keep transforms if possible
        printSize: templateToSwap.slots[0]?.printSize || '4R', // Keep same print size
      }));

      // Update ONLY the preview state - don't touch main templateSlots
      setPreviewSlots(newPreviewSlots);
    }
  };

  // Function to get the correct slots to display - use preview if available
  const getDisplaySlots = () => {
    if (showTemplateSwapper && templateToSwap && previewSlots.length > 0) {
      // During template swap modal, replace the swapping template with preview
      return templateSlots.map(slot => {
        if (slot.templateId === templateToSwap.templateId) {
          // Find matching preview slot by slot index
          return previewSlots.find(preview => preview.slotIndex === slot.slotIndex) || slot;
        }
        return slot;
      });
    }
    // Normal case - return original slots
    return templateSlots;
  };

  const confirmTemplateSwap = () => {
    if (!templateToSwap || !selectedNewTemplate) return;

    // Create new slots based on the new template
    const newSlots: TemplateSlot[] = Array.from({ length: selectedNewTemplate.holes?.length || 1 }, (_, index) => ({
      id: `${selectedNewTemplate.id}_${Date.now()}_${index}`,
      templateId: `${selectedNewTemplate.template_type}_${Date.now()}`,
      templateName: `${selectedNewTemplate.name || selectedNewTemplate.template_type}`,
      templateType: selectedNewTemplate.template_type,
      slotIndex: index,
      photoId: templateToSwap.slots[index]?.photoId || undefined, // Keep existing photos if possible
      transform: templateToSwap.slots[index]?.transform || undefined, // Keep transforms if possible
    }));

    // Update template slots - replace old template with new one
    const updatedSlots = templateSlots.filter(slot => 
      slot.templateId !== templateToSwap.templateId
    ).concat(newSlots);

    setTemplateSlots(updatedSlots);
    
    // Close modal and reset state
    setShowTemplateSwapper(false);
    setTemplateToSwap(null);
    setSelectedNewTemplate(null);
  };

  const cancelTemplateSwap = () => {
    // Just restore the original template selection and preview
    if (templateToSwap) {
      // Find the current template in available templates to auto-select it again
      const currentTemplate = availableTemplates.find(t => 
        t.name === templateToSwap.templateName.replace(' (Additional)', '') || 
        t.template_type === templateToSwap.templateId.split('_')[0]
      );
      if (currentTemplate) {
        setSelectedNewTemplate(currentTemplate);
      }
      // Reset preview to original slots
      setPreviewSlots(templateToSwap.slots);
    } else {
      setSelectedNewTemplate(null);
      setPreviewSlots([]);
    }
  };

  const closeTemplateSwapper = () => {
    // Just close modal and reset states - template slots remain unchanged
    setShowTemplateSwapper(false);
    setTemplateToSwap(null);
    setSelectedNewTemplate(null);
    setPreviewSlots([]);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col lg:flex-row overflow-hidden" style={{ touchAction: 'manipulation' }}>
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        PhotoSelectionScreen.tsx
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Photo Grid Section */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Photo Grid - Scrollable area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4" onScroll={() => setHasScrolled(true)}>
            {!selectedSlot && !hasScrolled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-yellow-800 text-center font-medium text-sm">
                  👉 Select a print slot {/* Changed from down arrow to right arrow for desktop */}
                  <span className="lg:hidden">below</span>
                  <span className="hidden lg:inline">on the right</span>
                  {' '}to start choosing photos
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-0 pb-4">
              {photos.map((photo) => (
                <PhotoCard 
                  key={photo.id}
                  photo={photo}
                  onSelect={() => handlePhotoClick(photo)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Print Templates - Different layouts for mobile vs desktop */}
        {/* Mobile/Tablet: Horizontal bottom section */}
        <div className="lg:hidden bg-white shadow-lg border-t flex-shrink-0" style={{ height: '380px', touchAction: 'pan-x' }}>
          <div className="p-2 sm:p-3 h-full flex flex-col">
            <div className="flex-shrink-0 mb-2">
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
              <h2 className="text-sm font-bold text-gray-800 text-center">📷 {clientName} • {selectedPackage?.name} • {totalAllowedPrints} print(s)</h2>
              {selectedSlot && (
                <div className="mt-1 text-xs text-white bg-blue-600 px-2 py-0.5 rounded-full text-center">
                  📍 Selecting: {selectedSlot.templateName} - Slot {selectedSlot.slotIndex + 1}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex space-x-2 sm:space-x-3 overflow-x-auto h-full pb-2" style={{ touchAction: 'pan-x' }}>
                {Object.values(
                  getDisplaySlots().reduce((acc, slot) => {
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
                ).map(({ templateId, templateName, slots }) => (
                  <div key={templateId} className="flex-shrink-0 relative pt-4" style={{ width: '180px' }}>
                    {/* Action buttons row */}
                    <div className="absolute top-0 left-0 right-0 flex justify-end items-center z-30">
                      {/* View and Swap icons on right */}
                      <div className="flex space-x-1">
                        <button
                          onClick={() => handleViewTemplate({ templateId, templateName, slots })}
                          title="View Template"
                          className="bg-blue-600 text-white rounded-full p-1 shadow-lg hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleSwapTemplate({ templateId, templateName, slots })}
                          title="Change Template"
                          className="bg-green-600 text-white rounded-full p-1 shadow-lg hover:bg-green-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                          </svg>
                        </button>
                        {/* Delete button (only for additional prints) */}
                        {templateName.includes('(Additional)') && (
                          <button
                            onClick={() => handleDeletePrint(templateId)}
                            title="Delete Print"
                            className="bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <h3 className="font-semibold mb-2 text-center text-xs leading-tight truncate px-1 relative z-20">{templateName}</h3>
                    <div className="w-full rounded-lg overflow-hidden border border-gray-200">
                      <TemplateVisual
                        key={`${templateId}-${slots.map(s => `${s.photoId || 'empty'}-${s.transform?.scale || 0}-${s.transform?.x || 0}-${s.transform?.y || 0}`).join('-')}`} // Force re-render when photos or transforms change
                        template={{ id: templateId.split('_')[0], name: templateName, slots: slots.length }}
                        slots={slots}
                        onSlotClick={handleSlotSelectFromTemplate} // Direct slot selection - go straight to photo list
                        photos={photos}
                        selectedSlot={selectedSlot}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Vertical right sidebar */}
        <div className="hidden lg:flex bg-white shadow-lg border-l flex-shrink-0 flex-col" style={{ width: '320px' }}>
          {/* Desktop Header in Sidebar */}
          <div className="p-2 border-b">
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={openAddPrintModal} 
                className="bg-green-600 text-white px-2 py-1 rounded-lg font-medium hover:bg-green-700 flex items-center space-x-1 text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span>Add</span>
              </button>
            </div>
            <h2 className="text-sm font-bold text-gray-800 text-center">📷 {clientName} Templates</h2>
            <div className="text-xs text-gray-600 text-center">{selectedPackage?.name} • {totalAllowedPrints} print(s)</div>
            {selectedSlot && (
              <div className="mt-1 text-xs text-white bg-blue-600 px-2 py-0.5 rounded-full text-center">
                📍 Selecting: {selectedSlot.templateName} - Slot {selectedSlot.slotIndex + 1}
              </div>
            )}
          </div>

          {/* Templates List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
              {Object.values(
                getDisplaySlots().reduce((acc, slot) => {
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
              ).map(({ templateId, templateName, slots }) => (
                <div key={templateId} className="relative">
                  {/* Action buttons row */}
                  <div className="absolute top-0 left-0 right-0 flex justify-end items-center z-30">
                    {/* View and Swap icons on right */}
                    <div className="flex space-x-1">
                      <button
                        onClick={() => handleViewTemplate({ templateId, templateName, slots })}
                        title="View Template"
                        className="bg-blue-600 text-white rounded-full p-1 shadow-lg hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleSwapTemplate({ templateId, templateName, slots })}
                        title="Change Template"
                        className="bg-green-600 text-white rounded-full p-1 shadow-lg hover:bg-green-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </button>
                      {/* Delete button (only for additional prints) */}
                      {templateName.includes('(Additional)') && (
                        <button
                          onClick={() => handleDeletePrint(templateId)}
                          title="Delete Print"
                          className="bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                  <h3 className="font-semibold mb-2 text-center text-sm relative z-20">{templateName}</h3>
                  <div className="w-full rounded-lg overflow-hidden border border-gray-200" style={{ height: '400px' }}>
                    <TemplateVisual
                      key={`${templateId}-${slots.map(s => `${s.photoId || 'empty'}-${s.transform?.scale || 0}-${s.transform?.x || 0}-${s.transform?.y || 0}`).join('-')}`} // Force re-render when photos or transforms change
                      template={{ id: templateId.split('_')[0], name: templateName, slots: slots.length }}
                      slots={slots}
                      onSlotClick={handleSlotSelectFromTemplate} // Direct slot selection - go straight to photo list
                      photos={photos}
                      selectedSlot={selectedSlot}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

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
        photos={photos}
        onClose={resetViewStates}
        onAddToTemplate={handleAddToTemplate}
        isVisible={(viewMode === 'photo-viewer' || viewMode === 'sliding-templates') && !!selectedPhotoForViewer}
        isDimmed={viewMode === 'sliding-templates'}
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

      {/* Fullscreen Template Editor */}
      <FullscreenTemplateEditor
        templateSlots={templateSlots}
        selectedSlot={selectedSlotForEditor!}
        selectedPhoto={selectedPhotoForTemplate!}
        photos={photos}
        onApply={handleApplyPhotoToSlot}
        onClose={resetViewStates}
        isVisible={viewMode === 'template-editor' && !!selectedSlotForEditor && !!selectedPhotoForTemplate}
      />

      {/* Template Viewer Modal */}
      <Transition appear show={showTemplateViewer} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowTemplateViewer(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      {templateToView?.templateName}
                    </Dialog.Title>
                    <button
                      onClick={() => setShowTemplateViewer(false)}
                      className="bg-gray-200 hover:bg-gray-300 rounded-full p-2 text-gray-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {templateToView && (
                    <div className="flex justify-center">
                      <div style={{ width: '600px', height: '800px' }}>
                        <TemplateVisual
                          template={{ id: templateToView.templateId.split('_')[0], name: templateToView.templateName, slots: templateToView.slots.length }}
                          slots={templateToView.slots}
                          onSlotClick={() => {}} // No slot interaction in viewer
                          photos={photos}
                          selectedSlot={null}
                        />
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Template Swapper Modal */}
      <Transition appear show={showTemplateSwapper} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={closeTemplateSwapper}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-6xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <div className="flex justify-between items-center mb-4">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Change Template: {templateToSwap?.templateName}
                    </Dialog.Title>
                    <button
                      onClick={closeTemplateSwapper}
                      className="bg-gray-200 hover:bg-gray-300 rounded-full p-2 text-gray-600"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  {templateToSwap && (
                    <div>
                      <p className="text-sm text-gray-600 mb-4">
                        Select a new template of the same print size to replace "{templateToSwap.templateName}". Photos will be preserved where possible.
                      </p>
                      
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-h-[75vh] overflow-y-auto p-3">
                        {availableTemplates
                          .filter(template => {
                            // Get current template's print size from slots
                            const currentSlot = templateToSwap.slots[0];
                            if (!currentSlot) return false;
                            
                            // Get print size from current slot (should have printSize or default to 4R)
                            const currentPrintSize = currentSlot.printSize || '4R';
                            
                            console.log('🔍 Filtering templates:', {
                              templateName: template.name,
                              templatePrintSize: template.print_size,
                              currentPrintSize: currentPrintSize,
                              matches: template.print_size === currentPrintSize
                            });
                            
                            // Only show templates with same print size
                            return template.print_size === currentPrintSize;
                          })
                          .map((template) => {
                            const isSelected = selectedNewTemplate?.id === template.id;
                            console.log('🎨 Rendering template:', {
                              templateId: template.id,
                              templateName: template.name,
                              selectedNewTemplateId: selectedNewTemplate?.id,
                              selectedNewTemplateName: selectedNewTemplate?.name,
                              isSelected,
                              className: isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-blue-300 cursor-pointer'
                            });
                            
                            return (
                            <div
                              key={template.id}
                              className={`border rounded-lg p-3 md:p-4 transition-colors ${
                                isSelected
                                  ? 'border-blue-500 bg-blue-50' 
                                  : 'border-gray-200 hover:border-blue-300 cursor-pointer'
                              }`}
                              onClick={() => !isSelected ? handleTemplateSelect(template) : null}
                            >
                              <h4 className="font-medium text-sm md:text-base mb-2 md:mb-3 text-center">{template.name}</h4>
                              <div className="w-full bg-gray-100 rounded overflow-hidden relative flex items-center justify-center h-64 md:h-80 lg:h-64">
                                {template.sample_image_url ? (
                                  // Show sample image if available
                                  <img
                                    src={(() => {
                                      let url = template.sample_image_url;
                                      // Convert Google Drive sharing URL to direct image URL
                                      if (url.includes('drive.google.com')) {
                                        const fileId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
                                        if (fileId) {
                                          url = `https://lh3.googleusercontent.com/d/${fileId}`;
                                        }
                                      }
                                      console.log('🖼️ Loading sample image:', template.name, url);
                                      return url;
                                    })()}
                                    alt={`${template.name} sample`}
                                    className="max-w-full max-h-full object-contain"
                                    onLoad={() => console.log('✅ Sample image loaded:', template.name)}
                                    onError={(e) => {
                                      console.log('❌ Sample image failed:', template.name);
                                      // Fallback to template visual if sample image fails to load
                                      e.currentTarget.style.display = 'none';
                                      const fallback = e.currentTarget.parentElement?.querySelector('.template-fallback') as HTMLElement;
                                      if (fallback) fallback.style.display = 'block';
                                    }}
                                  />
                                ) : null}
                                {/* Fallback template visual */}
                                <div className={`template-fallback w-full h-full flex items-center justify-center ${template.sample_image_url ? "hidden" : "block"}`}>
                                  <TemplateVisual
                                    template={{ id: template.template_type, name: template.name, slots: template.holes?.length || 1 }}
                                    slots={Array.from({ length: template.holes?.length || 1 }, (_, index) => ({
                                      id: `preview_${index}`,
                                      templateId: template.template_type,
                                      templateName: template.name,
                                      templateType: template.template_type,
                                      slotIndex: index,
                                      photoId: undefined,
                                    }))}
                                    onSlotClick={() => {}} // No interaction in preview
                                    photos={[]}
                                    selectedSlot={null}
                                  />
                                </div>
                              </div>
                              <p className="text-xs md:text-sm text-gray-500 text-center mt-1 md:mt-2">
                                {template.print_size} • {template.holes?.length || 1} photos
                                {template.sample_image_url && <span className="text-green-600"> • Sample</span>}
                              </p>
                              
                              {/* Show confirmation buttons when this template is selected */}
                              {isSelected && (
                                <div className="mt-3 md:mt-4 pt-2 md:pt-3 border-t border-gray-200">
                                  <p className="text-xs md:text-sm text-gray-700 text-center mb-2 md:mb-3">
                                    Replace "<span className="font-medium">{templateToSwap.templateName}</span>" with "<span className="font-medium">{template.name}</span>"?
                                  </p>
                                  <div className="flex justify-center space-x-2 md:space-x-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        cancelTemplateSwap();
                                      }}
                                      className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        confirmTemplateSwap();
                                      }}
                                      className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                      Use This Template
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

    </div>
  );
}

// Simple PhotoCard component
function PhotoCard({ photo, onSelect }: { photo: Photo; onSelect: () => void }) {
  console.log(`📷 PhotoCard rendering: ${photo.name}`, {
    url: photo.url,
    thumbnailUrl: photo.thumbnailUrl,
    googleDriveId: photo.googleDriveId
  });

  // Use higher resolution thumbnail for better quality
  // Google Drive thumbnail sizes: s220, s400, s600, s800
  let imageUrl = photo.thumbnailUrl || photo.url;
  
  // Upgrade thumbnail size for better quality (s220 -> s600)
  if (imageUrl && imageUrl.includes('=s220')) {
    imageUrl = imageUrl.replace('=s220', '=s600');
  } else if (imageUrl && imageUrl.includes('=s400')) {
    imageUrl = imageUrl.replace('=s400', '=s600');
  }

  return (
    <div
      onClick={onSelect}
      className="relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-200"
    >
      <div className="w-full relative" style={{ aspectRatio: '2/3' }}>
        <img 
          src={imageUrl} 
          alt={photo.name} 
          className="w-full h-full object-cover"
          onLoad={() => console.log(`✅ Image loaded: ${photo.name}`)}
          onError={(e) => {
            console.error(`❌ Image failed: ${photo.name}`, photo.url);
            // Try fallback URL if thumbnail fails
            const fallbackUrl = photo.url !== imageUrl ? photo.url : null;
            if (fallbackUrl) {
              e.currentTarget.src = fallbackUrl;
            } else {
              e.currentTarget.style.display = 'none';
            }
          }}
        />
        
        {/* Filename overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white px-2 py-1">
          <p className="text-xs truncate">{photo.name}</p>
        </div>
      </div>
    </div>
  );
} 