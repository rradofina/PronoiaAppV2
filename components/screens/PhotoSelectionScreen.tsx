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

  // Load available templates for add print modal
  useEffect(() => {
    const loadTemplates = async () => {
      try {
        // Get package-configured templates (from manual packages only)
        const packageTemplates = (window as any).pngTemplates || [];
        
        console.log('📋 Using package-configured templates for Add Print modal');
        setAvailableTemplates(packageTemplates);
      } catch (error) {
        console.error('❌ Error loading templates for add print modal:', error);
      }
    };
    loadTemplates();
  }, [selectedPackage]);

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
                ).map(({ templateId, templateName, slots }) => (
                  <div key={templateId} className="flex-shrink-0 relative pt-4" style={{ width: '180px' }}>
                    {templateName.includes('(Additional)') && (
                      <button
                        onClick={() => handleDeletePrint(templateId)}
                        title="Delete Print"
                        className="absolute top-0 right-0 z-10 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <h3 className="font-semibold mb-2 text-center text-xs leading-tight truncate px-1">{templateName}</h3>
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
              ).map(({ templateId, templateName, slots }) => (
                <div key={templateId} className="relative">
                  {templateName.includes('(Additional)') && (
                    <button
                      onClick={() => handleDeletePrint(templateId)}
                      title="Delete Print"
                      className="absolute top-0 right-0 z-10 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  <h3 className="font-semibold mb-2 text-center text-sm">{templateName}</h3>
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

  return (
    <div
      onClick={onSelect}
      className="relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-200"
    >
      <div className="w-full relative" style={{ aspectRatio: '2/3' }}>
        <img 
          src={photo.url} 
          alt={photo.name} 
          className="w-full h-full object-cover"
          onLoad={() => console.log(`✅ Image loaded: ${photo.name}`)}
          onError={(e) => {
            console.error(`❌ Image failed: ${photo.name}`, photo.url);
            e.currentTarget.style.display = 'none';
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