import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { ManualTemplate, Photo, PrintSize } from '../types';
import { manualTemplateService } from '../services/manualTemplateService';
import { getSamplePhotosForTemplate } from '../utils/samplePhotoUtils';
import { createPhotoTransform, PhotoTransform } from '../types';
import { AnimatedTemplateItem } from './animations/AnimatedTemplateReveal';
import PngTemplateVisual from './PngTemplateVisual';
import { getPrintSizeDimensions } from '../utils/printSizeDimensions';

// Create smart preview transform that optimizes photo for hole aspect ratio with gap-free auto-fit
function createPreviewTransform(holeAspectRatio: number, photoAspectRatio: number | null = null): PhotoTransform {
  // For preview mode, we want photos to completely fill holes with no gaps (object-cover behavior)
  // Calculate the scale needed to ensure no empty space in holes
  let previewScale = 1.0; // Start with base scale
  
  // If we know the photo aspect ratio, calculate exact scale for gap-free fit
  if (photoAspectRatio) {
    if (photoAspectRatio > holeAspectRatio) {
      // Photo is wider than hole - need to scale by height to fill completely
      // This ensures height fills hole completely, width may overflow (no gaps)
      previewScale = 1.0; // PhotoRenderer with object-cover handles this automatically
    } else {
      // Photo is taller than hole - need to scale by width to fill completely  
      // This ensures width fills hole completely, height may overflow (no gaps)
      previewScale = 1.0; // PhotoRenderer with object-cover handles this automatically
    }
  } else {
    // No photo aspect ratio available, use safe auto-fit scale
    previewScale = 1.0; // Let object-cover behavior handle gap elimination
  }
  
  // Center the photo by default for preview - object-cover will handle proper scaling
  return createPhotoTransform(previewScale, 0.5, 0.5);
}

interface TemplateSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTemplate: {template: ManualTemplate, index: number};
  availablePhotos: Photo[];
  onTemplateSelect: (template: ManualTemplate) => void;
}

export default function TemplateSelectionModal({
  isOpen,
  onClose,
  currentTemplate,
  availablePhotos,
  onTemplateSelect
}: TemplateSelectionModalProps) {
  const [availableTemplates, setAvailableTemplates] = useState<ManualTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ManualTemplate | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load templates when modal opens
  useEffect(() => {
    const loadTemplates = async () => {
      if (!isOpen || !currentTemplate) return;
      
      setIsLoading(true);
      try {
        console.log('🔄 TemplateSelectionModal - Loading templates for print size:', currentTemplate.template.print_size);
        
        // Get all templates with same print size in natural database order
        const printSizeTemplates = await manualTemplateService.getTemplatesByPrintSize(currentTemplate.template.print_size);
        
        // Use natural database ordering (sort_order ASC, created_at DESC)
        // Current template will appear in its proper position and be visually distinguished
        const allTemplates = printSizeTemplates;
        
        console.log('📋 Available templates for', currentTemplate.template.print_size + ':', {
          totalFound: printSizeTemplates.length,
          currentTemplateId: currentTemplate.template.id,
          templateNames: allTemplates.map(t => t.name),
          naturalOrdering: true
        });
        
        setAvailableTemplates(allTemplates);
        setSelectedTemplate(null); // Reset selection
      } catch (error) {
        console.error('❌ Error loading templates:', error);
        setAvailableTemplates([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTemplates();
  }, [isOpen, currentTemplate]);

  const handleTemplateSelect = (template: ManualTemplate) => {
    setSelectedTemplate(template);
  };

  const handleConfirm = () => {
    if (!selectedTemplate) {
      console.log('⚠️ No template selected for replacement');
      return;
    }

    console.log('🔄 SIMPLE TEMPLATE CONFIRM:', {
      selectedTemplateId: selectedTemplate.id,
      selectedTemplateName: selectedTemplate.name,
      currentTemplateId: currentTemplate.template.id,
      currentTemplateIndex: currentTemplate.index
    });

    onTemplateSelect(selectedTemplate);
    onClose();
  };

  const handleCancel = () => {
    setSelectedTemplate(null);
    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleCancel}>
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
              <Dialog.Panel className="w-full max-w-6xl mx-auto transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900 mb-4">
                  Change Template - {currentTemplate.template.print_size} Templates
                </Dialog.Title>

                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <span className="ml-3 text-gray-600">Loading templates...</span>
                  </div>
                ) : availableTemplates.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    <div className="text-lg mb-2">No other templates available</div>
                    <div className="text-sm">No other {currentTemplate.template.print_size} templates found</div>
                  </div>
                ) : (
                  <>
                    <div className="text-sm text-gray-600 mb-4 text-center">
                      Select a different {currentTemplate.template.print_size} template ({availableTemplates.length} templates available)
                    </div>

                    {/* Templates Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6 max-h-[75vh] overflow-y-auto">
                      {availableTemplates.map((template, index) => {
                        // Generate sample photos for this template
                        const samplePhotos = getSamplePhotosForTemplate(
                          availablePhotos,
                          template.holes_data?.length || 0,
                          template.id.toString()
                        );

                        // Create mock template slots for sample photos with smart preview transforms
                        const sampleSlots = samplePhotos.map((photo, slotIndex) => {
                          // Calculate hole aspect ratio for this slot
                          const hole = template.holes_data?.[slotIndex];
                          const holeAspectRatio = hole ? hole.width / hole.height : 1.0;

                          // Estimate photo aspect ratio (assume typical photo ratios if not available)
                          // Most photos are either 4:3, 3:2, or 16:9 - we'll use 3:2 as default
                          const photoAspectRatio = 3/2; // Can be refined with actual photo dimensions later

                          // Create smart preview transform for this hole
                          const previewTransform = createPreviewTransform(holeAspectRatio, photoAspectRatio);

                          return {
                            id: `modal-slot-${template.id}-${slotIndex}`,
                            templateId: template.id.toString(),
                            templateName: template.name,
                            templateType: template.template_type,
                            slotIndex,
                            photoId: photo.id,
                            transform: previewTransform
                          };
                        });

                        // Create photo filename assignments for this template's holes
                        const holePhotoAssignments = (template.holes_data || []).map((hole, holeIndex) => {
                          const assignedPhoto = availablePhotos[holeIndex % availablePhotos.length];
                          return assignedPhoto?.name || `Photo ${holeIndex + 1}`;
                        });

                        const isSelected = selectedTemplate?.id === template.id;
                        const isCurrent = template.id === currentTemplate.template.id;

                        return (
                          <AnimatedTemplateItem key={template.id} index={index}>
                            <div 
                              className={`rounded-lg p-3 border-2 transition-all ${
                                isCurrent 
                                  ? 'bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed' 
                                  : isSelected 
                                  ? 'bg-blue-50 border-blue-500 cursor-pointer hover:shadow-md' 
                                  : 'bg-gray-50 border-gray-200 cursor-pointer hover:border-gray-300 hover:shadow-md'
                              }`}
                              onClick={() => !isCurrent && handleTemplateSelect(template)}
                            >
                              {/* Template Header */}
                              <div className="mb-2">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <h4 className={`font-medium text-sm truncate ${isCurrent ? 'text-gray-600' : 'text-gray-900'}`}>
                                      {template.name}
                                    </h4>
                                    <div className={`text-xs mt-1 ${isCurrent ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {template.holes_data?.length || 0} photo slot{(template.holes_data?.length || 0) !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                  {isCurrent && (
                                    <span className="ml-2 px-2 py-1 text-xs font-medium bg-gray-200 text-gray-600 rounded-full whitespace-nowrap">
                                      Current
                                    </span>
                                  )}
                                  {isSelected && !isCurrent && (
                                    <span className="ml-2 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full whitespace-nowrap">
                                      Selected
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Template Visual Preview */}
                              <div 
                                className="bg-white rounded border border-gray-200 overflow-hidden mb-1 flex items-center justify-center"
                                style={{
                                  aspectRatio: template.dimensions 
                                    ? `${template.dimensions.width}/${template.dimensions.height}`
                                    : template.print_size === 'A4' ? '2480/3508'
                                    : template.print_size === '5R' ? '1500/2100'
                                    : '1200/1800', // Default to 4R
                                  minHeight: '220px',
                                  maxHeight: '350px',
                                  width: '100%'
                                }}
                              >
                                {template.drive_file_id ? (
                                  <PngTemplateVisual
                                    pngTemplate={{
                                      id: template.id.toString(),
                                      name: template.name,
                                      templateType: template.template_type,
                                      driveFileId: template.drive_file_id,
                                      holes: template.holes_data || [],
                                      dimensions: template.dimensions || getPrintSizeDimensions(template.print_size),
                                      printSize: template.print_size,
                                      pngUrl: (() => {
                                        // Robust PNG URL construction
                                        const fileId = template.drive_file_id?.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || template.drive_file_id;
                                        const cleanFileId = fileId?.replace(/[^a-zA-Z0-9-_]/g, '');
                                        return cleanFileId ? `https://lh3.googleusercontent.com/d/${cleanFileId}` : '';
                                      })(),
                                      hasInternalBranding: false,
                                      lastUpdated: new Date(),
                                      createdAt: new Date()
                                    }}
                                    templateSlots={sampleSlots}
                                    onSlotClick={() => {}} // No interaction in modal
                                    photos={samplePhotos}
                                    selectedSlot={null}
                                    isEditingMode={false}
                                    isActiveTemplate={false} // Non-interactive preview
                                    debugHoles={false} // Show actual photos
                                    holePhotoAssignments={holePhotoAssignments}
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                    Preview unavailable
                                  </div>
                                )}
                              </div>

                            </div>
                          </AnimatedTemplateItem>
                        );
                      })}
                    </div>
                  </>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    onClick={handleCancel}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    disabled={!selectedTemplate}
                    className={`px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                      selectedTemplate
                        ? 'text-white bg-blue-600 hover:bg-blue-700'
                        : 'text-gray-500 bg-gray-300 cursor-not-allowed'
                    }`}
                  >
                    Change Template
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}