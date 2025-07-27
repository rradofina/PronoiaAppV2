import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { TemplateSlot, Photo } from '../types';
import { HybridTemplate } from '../services/hybridTemplateService';
import { manualTemplateService } from '../services/manualTemplateService';

interface TemplateSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  templateToSwap: { templateId: string; templateName: string; slots: TemplateSlot[] } | null;
  templateSlots: TemplateSlot[];
  photos: Photo[];
  onConfirmSwap: (newTemplate: HybridTemplate, updatedSlots: TemplateSlot[]) => void;
  TemplateVisual: React.ComponentType<any>;
}

export default function TemplateSwapModal({
  isOpen,
  onClose,
  templateToSwap,
  templateSlots,
  photos,
  onConfirmSwap,
  TemplateVisual
}: TemplateSwapModalProps) {
  const [availableTemplates, setAvailableTemplates] = useState<HybridTemplate[]>([]);
  const [selectedNewTemplate, setSelectedNewTemplate] = useState<HybridTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load available templates when modal opens
  useEffect(() => {
    const loadTemplates = async () => {
      if (!isOpen || !templateToSwap) return;
      
      setIsLoading(true);
      try {
        const allManualTemplates = await manualTemplateService.getAllTemplates();
        const hybridTemplates: HybridTemplate[] = allManualTemplates.map(manual => ({
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
        }));
        
        setAvailableTemplates(hybridTemplates);
      } catch (error) {
        console.error('❌ Error loading templates:', error);
        setAvailableTemplates([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, [isOpen, templateToSwap]);

  // Auto-select current template when templates are loaded
  useEffect(() => {
    if (!isOpen || !templateToSwap || availableTemplates.length === 0) {
      setSelectedNewTemplate(null);
      return;
    }

    // Find exact match by template type and print size
    const currentSlot = templateToSwap.slots[0];
    if (!currentSlot) return;

    const currentTemplateType = currentSlot.templateType || templateToSwap.templateId.split('_')[0];
    const currentPrintSize = currentSlot.printSize || '4R';

    const exactMatch = availableTemplates.find(t => 
      t.template_type === currentTemplateType && t.print_size === currentPrintSize
    );

    if (exactMatch) {
      setSelectedNewTemplate(exactMatch);
    } else {
      // Fallback to first available template
      setSelectedNewTemplate(availableTemplates[0] || null);
    }
  }, [isOpen, templateToSwap, availableTemplates]);

  const handleTemplateSelect = (template: HybridTemplate) => {
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
        holesCount: selectedNewTemplate.holes?.length
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

    // Create new slots based on the new template
    const newSlots: TemplateSlot[] = Array.from({ length: selectedNewTemplate.holes?.length || 1 }, (_, index) => ({
      id: `${selectedNewTemplate.id}_${Date.now()}_${index}`,
      templateId: templateToSwap.templateId, // Keep same templateId to maintain position
      templateName: newTemplateName,
      templateType: selectedNewTemplate.template_type,
      slotIndex: index,
      photoId: templateToSwap.slots[index]?.photoId || undefined, // Keep existing photos if possible
      transform: templateToSwap.slots[index]?.transform || undefined, // Keep transforms if possible
      printSize: templateToSwap.slots[0]?.printSize || '4R',
    }));

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

  // Filter templates by current print size
  const currentSlot = templateToSwap.slots[0];
  const currentPrintSize = currentSlot?.printSize || '4R';
  const filteredTemplates = availableTemplates.filter(template => 
    template.print_size === currentPrintSize
  );

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
                  Select a new template of the same print size ({currentPrintSize}) to replace "{templateToSwap.templateName}". Photos will be preserved where possible.
                </p>
                
                {isLoading ? (
                  <div className="flex justify-center items-center h-64">
                    <div className="text-gray-500">Loading templates...</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 max-h-[75vh] overflow-y-auto p-3">
                    {filteredTemplates.map((template) => {
                      const isSelected = selectedNewTemplate?.id === template.id;
                      
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
                                  return url;
                                })()}
                                alt={`${template.name} sample`}
                                className="max-w-full max-h-full object-contain"
                                onError={(e) => {
                                  // Fallback to template visual if sample image fails
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
                                    handleCancel();
                                  }}
                                  className="px-3 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-medium text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                >
                                  Cancel
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleConfirmSwap();
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
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}