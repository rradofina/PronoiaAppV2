import React, { useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { ManualTemplate, Photo, PrintSize, TemplateSlot } from '../types';
import { manualTemplateService } from '../services/manualTemplateService';
import { getSamplePhotosForTemplate } from '../utils/samplePhotoUtils';
import { createPhotoTransform, PhotoTransform, createSmartPhotoTransformFromSlot } from '../types';
import { AnimatedTemplateItem } from './animations/AnimatedTemplateReveal';
import PngTemplateVisual from './PngTemplateVisual';
import { getPrintSizeDimensions } from '../utils/printSizeDimensions';
import ModalTemplatePreviewWithSmartTransforms from './ModalTemplatePreviewWithSmartTransforms';

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
        if (process.env.NODE_ENV === 'development') console.log('🔄 TemplateSelectionModal - Loading templates for print size:', currentTemplate.template.print_size);
        
        // Get all templates with same print size in natural database order
        const printSizeTemplates = await manualTemplateService.getTemplatesByPrintSize(currentTemplate.template.print_size);
        
        // Use natural database ordering (sort_order ASC, created_at DESC)
        // Current template will appear in its proper position and be visually distinguished
        const allTemplates = printSizeTemplates;
        
        if (process.env.NODE_ENV === 'development') console.log('📋 Available templates for', currentTemplate.template.print_size + ':', {
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

  // Modal previews should also show sample photos - keep simple for better performance

  const handleTemplateSelect = (template: ManualTemplate) => {
    setSelectedTemplate(template);
  };

  const handleConfirm = () => {
    if (!selectedTemplate) {
      if (process.env.NODE_ENV === 'development') console.log('⚠️ No template selected for replacement');
      return;
    }

    if (process.env.NODE_ENV === 'development') console.log('🔄 SIMPLE TEMPLATE CONFIRM:', {
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
                        const isSelected = selectedTemplate?.id === template.id;
                        const isCurrent = template.id === currentTemplate.template.id;

                        return (
                          <ModalTemplatePreviewWithSmartTransforms
                            key={template.id}
                            template={template}
                            index={index}
                            availablePhotos={availablePhotos}
                            isCurrent={isCurrent}
                            isSelected={isSelected}
                            onTemplateSelect={handleTemplateSelect}
                          />
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