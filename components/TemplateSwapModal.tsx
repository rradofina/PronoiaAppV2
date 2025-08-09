import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { TemplateSlot, Photo, ManualPackage, ManualTemplate } from '../types';
import { manualTemplateService } from '../services/manualTemplateService';
import { manualPackageService } from '../services/manualPackageService';

interface TemplateSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateToSwap: { templateId: string; templateName: string; slots: TemplateSlot[] } | null;
  templateSlots: TemplateSlot[];
  photos: Photo[];
  selectedPackage: ManualPackage | null;
  onConfirmSwap: (newTemplate: ManualTemplate, updatedSlots: TemplateSlot[]) => void;
  TemplateVisual: React.ComponentType<any>;
}

export default function TemplateSwapModal({
  isOpen,
  onClose,
  templateToSwap,
  templateSlots,
  photos,
  selectedPackage,
  onConfirmSwap,
  TemplateVisual
}: TemplateSwapModalProps) {
  const [availableTemplates, setAvailableTemplates] = useState<ManualTemplate[]>([]);
  const [selectedNewTemplate, setSelectedNewTemplate] = useState<ManualTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load available templates when modal opens
  useEffect(() => {
    const loadTemplates = async () => {
      if (!isOpen || !templateToSwap || !selectedPackage) return;
      
      setIsLoading(true);
      try {
        console.log('🔄 TemplateSwapModal - Loading ALL templates for print size comparison');
        
        // Get current template's print size for filtering
        const currentSlot = templateToSwap.slots[0];
        const currentPrintSize = currentSlot?.printSize || selectedPackage?.print_size || '4R';
        
        console.log('📏 Loading all templates for print size:', currentPrintSize);
        
        // Load ALL templates directly from database - simple and reliable
        const printSizeTemplates = await manualTemplateService.getTemplatesByPrintSize(currentPrintSize);
        
        if (!printSizeTemplates || printSizeTemplates.length === 0) {
          console.warn('❌ No templates found for print size:', currentPrintSize);
          setAvailableTemplates([]);
          return;
        }
        
        console.log('🔄 TEMPLATE SWAP - Database templates for', currentPrintSize + ':', {
          templatesFound: printSizeTemplates.length,
          currentPrintSize,
          templateTypes: [...new Set(printSizeTemplates.map(t => t.template_type))],
          templateNames: printSizeTemplates.map(t => t.name),
          templateDetails: printSizeTemplates.map(t => ({
            name: t.name,
            template_type: t.template_type,
            print_size: t.print_size,
            is_active: t.is_active
          }))
        });
        
        // Use database templates directly - no conversion needed
        setAvailableTemplates(printSizeTemplates);
      } catch (error) {
        console.error('❌ Error loading package templates:', error);
        setAvailableTemplates([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, [isOpen, templateToSwap, selectedPackage]);

  // Auto-select current template when templates are loaded
  useEffect(() => {
    if (!isOpen || !templateToSwap || availableTemplates.length === 0) {
      setSelectedNewTemplate(null);
      return;
    }

    console.log('🎯 Auto-selecting current template');
    
    // Find current template by matching template type and print size
    const currentSlot = templateToSwap.slots[0];
    if (!currentSlot) {
      console.log('❌ No current slot found for auto-selection');
      return;
    }

    const currentTemplateType = currentSlot.templateType;
    const currentPrintSize = currentSlot.printSize || '4R';

    console.log('🔍 Looking for template:', { 
      currentTemplateType, 
      currentPrintSize,
      availableCount: availableTemplates.length 
    });

    // Find exact match by template type (this should be the current template)
    const currentTemplate = availableTemplates.find(template => 
      template.template_type === currentTemplateType
    );

    if (currentTemplate) {
      console.log('✅ Auto-selected current template:', currentTemplate.name);
      setSelectedNewTemplate(currentTemplate);
    } else {
      console.log('⚠️ Current template not found, selecting first available');
      setSelectedNewTemplate(availableTemplates[0] || null);
    }
  }, [isOpen, templateToSwap, availableTemplates]);

  const handleTemplateSelect = (template: ManualTemplate) => {
    setSelectedNewTemplate(template);
  };

  const handleConfirmSwap = () => {
    if (!templateToSwap || !selectedNewTemplate) return;

    console.log('🔄 TEMPLATE SWAP DEBUG - Starting swap process:', {
      templateToSwap: {
        templateId: templateToSwap.templateId,
        templateName: templateToSwap.templateName,
        oldTemplateType: templateToSwap.slots[0]?.templateType,
        slotsCount: templateToSwap.slots.length
      },
      selectedNewTemplate: {
        id: selectedNewTemplate.id,
        name: selectedNewTemplate.name,
        template_type: selectedNewTemplate.template_type,
        holesCount: selectedNewTemplate.holes_data?.length
      }
    });

    // Calculate template position for naming
    const allTemplateGroups = Object.values(
      templateSlots.reduce((acc, slot) => {
        if (!acc[slot.templateId]) {
          acc[slot.templateId] = { templateId: slot.templateId, templateName: slot.templateName, slots: [] };
        }
        acc[slot.templateId].slots.push(slot);
        return acc;
      }, {} as Record<string, { templateId: string; templateName: string; slots: TemplateSlot[] }>)
    );
    
    const currentGroupIndex = allTemplateGroups.findIndex(group => group.templateId === templateToSwap.templateId);
    const printNumber = currentGroupIndex + 1;
    const firstSlotIndex = templateSlots.findIndex(slot => slot.templateId === templateToSwap.templateId);
    const isAdditional = templateToSwap.templateName.includes('(Additional)');
    
    // Store indices of all slots to be removed for proper insertion calculation
    const slotIndicesToRemove = templateSlots
      .map((slot, index) => slot.templateId === templateToSwap.templateId ? index : -1)
      .filter(index => index !== -1)
      .sort((a, b) => a - b); // Sort ascending for proper insertion index calculation
    
    console.log('🔄 TEMPLATE SWAP DEBUG - Position calculations:', {
      currentGroupIndex,
      printNumber,
      firstSlotIndex,
      isAdditional,
      slotIndicesToRemove
    });
    
    // Create new template name
    const newTemplateName = isAdditional 
      ? `${selectedNewTemplate.name} (Additional Print #${printNumber})`
      : `${selectedNewTemplate.name} (Print #${printNumber})`;

    // Create new slots based on the new template with smart photo preservation
    const newSlotsCount = selectedNewTemplate.holes_data?.length || 1;
    const oldSlotsCount = templateToSwap.slots.length;
    
    console.log('🔄 SLOT CONVERSION DEBUG:', {
      oldTemplateType: templateToSwap.slots[0]?.templateType,
      newTemplateType: selectedNewTemplate.template_type,
      oldSlotsCount,
      newSlotsCount,
      photoMapping: templateToSwap.slots.map(s => ({ index: s.slotIndex, hasPhoto: !!s.photoId }))
    });
    
    const newSlots: TemplateSlot[] = Array.from({ length: newSlotsCount }, (_, index) => {
      // Smart photo preservation logic - preserve photo but NOT transform
      let preservedPhoto = templateToSwap.slots[index]?.photoId;
      // IMPORTANT: Set transform to undefined to trigger auto-fit recalculation
      // This ensures the 2-step auto-fit runs for the new template's aspect ratio
      
      // If new template has fewer slots than old, try to preserve the first photos
      if (newSlotsCount < oldSlotsCount && !preservedPhoto && index === 0) {
        // For solo template (1 slot), try to use first available photo from old template
        const firstPhotoSlot = templateToSwap.slots.find(s => s.photoId);
        if (firstPhotoSlot) {
          preservedPhoto = firstPhotoSlot.photoId;
          console.log(`📸 Preserving first photo from slot ${firstPhotoSlot.slotIndex} to new slot 0 (transform will be recalculated)`);
        }
      }
      
      return {
        id: `${selectedNewTemplate.id}_${Date.now()}_${index}`,
        templateId: templateToSwap.templateId, // Keep same templateId to maintain position
        templateName: newTemplateName,
        templateType: selectedNewTemplate.template_type,
        slotIndex: index,
        photoId: preservedPhoto,
        transform: undefined, // Set to undefined to trigger auto-fit recalculation
        printSize: templateToSwap.slots[0]?.printSize || '4R',
      };
    });

    console.log('🔄 TEMPLATE SWAP DEBUG - New slots created:', {
      newSlotsCount: newSlots.length,
      newSlots: newSlots.map(s => ({ 
        id: s.id, 
        templateId: s.templateId, 
        templateType: s.templateType, 
        photoId: s.photoId 
      }))
    });

    // Replace slots at the exact same position
    const updatedSlots = [...templateSlots];
    
    console.log('🔄 TEMPLATE SWAP DEBUG - Before removal:', {
      totalSlotsCount: updatedSlots.length,
      slotsToRemove: updatedSlots.filter(s => s.templateId === templateToSwap.templateId).length
    });
    
    // Remove old slots (backwards to avoid index issues)
    for (let i = updatedSlots.length - 1; i >= 0; i--) {
      if (updatedSlots[i].templateId === templateToSwap.templateId) {
        console.log('🔄 TEMPLATE SWAP DEBUG - Removing slot at index', i, ':', {
          id: updatedSlots[i].id,
          templateType: updatedSlots[i].templateType
        });
        updatedSlots.splice(i, 1);
      }
    }
    
    // Calculate the correct insertion index after removals
    // The insertion index is the first slot index minus the number of slots removed before it
    const slotsRemovedBeforeInsertion = slotIndicesToRemove.filter(index => index < firstSlotIndex).length;
    const correctedInsertionIndex = firstSlotIndex - slotsRemovedBeforeInsertion;
    
    console.log('🔄 TEMPLATE SWAP DEBUG - After removal, before insertion:', {
      totalSlotsCount: updatedSlots.length,
      originalFirstSlotIndex: firstSlotIndex,
      slotsRemovedBeforeInsertion,
      correctedInsertionIndex
    });
    
    // Insert new slots at the corrected position
    updatedSlots.splice(correctedInsertionIndex, 0, ...newSlots);

    console.log('🔄 TEMPLATE SWAP DEBUG - Final result:', {
      totalSlotsCount: updatedSlots.length,
      insertedSlots: newSlots.map(s => ({ 
        id: s.id, 
        templateType: s.templateType, 
        templateId: s.templateId 
      }))
    });

    onConfirmSwap(selectedNewTemplate, updatedSlots);
    onClose();
  };

  const handleCancel = () => {
    setSelectedNewTemplate(null);
    onClose();
  };

  if (!templateToSwap) return null;

  // Get current template info for display
  const currentSlot = templateToSwap.slots[0];
  const currentPrintSize = currentSlot?.printSize || '4R';
  
  // Show ALL templates of the same print size (including current template)
  const filteredTemplates = availableTemplates;
  

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
                    Change Template: {templateToSwap.templateName}
                  </Dialog.Title>
                  <button
                    onClick={onClose}
                    className="bg-gray-200 hover:bg-gray-300 rounded-full p-2 text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <p className="text-sm text-gray-600 mb-4">
                  Select a template to replace "{templateToSwap.templateName}". 
                  <span className="font-medium text-blue-600">
                    Showing all {currentPrintSize} templates (Solo, Collage, Photo Cards, Photo Strip).
                  </span>
                  {templateToSwap.slots.some(s => s.photoId) && (
                    <span className="block mt-1 text-orange-600">
                      ⚠️ Photos will be automatically repositioned to fit the new template layout.
                    </span>
                  )}
                </p>
                
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="text-gray-500">Loading templates...</div>
                  </div>
                ) : (
                  <div className="max-h-[75vh] overflow-y-auto">
                    {filteredTemplates.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <div className="text-lg mb-2">No templates available</div>
                        <div className="text-sm">
                          No {currentPrintSize} templates found in the template catalog.
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 p-4">
                        {filteredTemplates.map((template) => {
                          const isSelected = selectedNewTemplate?.id === template.id;
                          const isCurrent = template.template_type === templateToSwap.slots[0]?.templateType;
                          const slotCountDiff = template.holes_data?.length !== templateToSwap.slots.length;
                            
                            return (
                              <div
                                key={template.id}
                                className={`bg-white rounded-lg p-6 transition-all duration-200 shadow-sm ${
                                  isCurrent
                                    ? 'ring-2 ring-gray-400 bg-gray-100 opacity-75 cursor-not-allowed'
                                    : isSelected
                                    ? 'ring-2 ring-blue-500 bg-blue-50 hover:shadow-md' 
                                    : 'hover:bg-gray-50 hover:shadow-md cursor-pointer'
                                }`}
                                onClick={() => !isCurrent && !isSelected ? handleTemplateSelect(template) : null}
                              >
                                <div className="text-center mb-4">
                                  <h4 className="font-semibold text-gray-900 text-lg">
                                    {template.name}
                                  </h4>
                                  {isCurrent && (
                                    <span className="inline-block mt-2 px-2 py-1 bg-gray-300 text-gray-700 text-xs font-medium rounded">
                                      Current Template
                                    </span>
                                  )}
                                </div>
                                
                                {slotCountDiff && template.holes_data?.length! < templateToSwap.slots.length && (
                                  <div className="mb-3 p-2 bg-orange-50 border border-orange-200 rounded-lg">
                                    <div className="text-xs text-orange-700 font-medium">
                                      ⚠️ Some photos will be removed
                                    </div>
                                    <div className="text-xs text-orange-600 mt-1">
                                      This template has {template.holes_data?.length || 1} slot{(template.holes_data?.length || 1) !== 1 ? 's' : ''}, but you have {templateToSwap.slots.length} photos
                                    </div>
                                  </div>
                                )}
                                <div className="w-full bg-gray-50 rounded-lg overflow-hidden relative flex items-center justify-center aspect-[2/3] mb-4">
                            {/* Always show template visual with actual photos */}
                            <div className="w-full h-full flex items-center justify-center">
                              <TemplateVisual
                                template={{ id: template.template_type, name: template.name, slots: template.holes_data?.length || 1 }}
                                slots={Array.from({ length: template.holes_data?.length || 1 }, (_, index) => {
                                  // Use actual photos from the folder for preview
                                  // Similar to how Package Selection shows sample photos
                                  const photoId = photos.length > 0 
                                    ? photos[index % photos.length].id
                                    : undefined;
                                  
                                  return {
                                    id: `preview_${index}`,
                                    templateId: template.template_type,
                                    templateName: template.name,
                                    templateType: template.template_type,
                                    slotIndex: index,
                                    photoId: photoId,
                                  };
                                })}
                                onSlotClick={() => {}} // No interaction in preview
                                photos={photos}
                                selectedSlot={null}
                              />
                            </div>
                          </div>
                          {/* Show buttons as a separate row when selected */}
                          {isSelected && (
                            <div className="mt-4">
                              <p className="text-sm text-gray-700 text-center mb-3">
                                Confirm template change?
                                <span className="block text-blue-600 text-xs mt-1">
                                  ✨ Photos will auto-fit to new layout
                                </span>
                              </p>
                              <div className="flex justify-center space-x-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedNewTemplate(null);
                                  }}
                                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmSwap();
                                  }}
                                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  Use Template
                                </button>
                              </div>
                            </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                    )}
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}