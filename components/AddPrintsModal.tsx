import React, { useState, useEffect } from 'react';
import { ManualTemplate, Photo, PrintSize } from '../types';
import { manualTemplateService } from '../services/manualTemplateService';
import { printSizeService } from '../services/printSizeService';
import PngTemplateVisual from './PngTemplateVisual';
import { getSamplePhotosForTemplate } from '../utils/samplePhotoUtils';
import { createPhotoTransform } from '../types';
import { PRINT_SIZE_ORDER } from '../utils/constants';

interface AddPrintsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateAdd: (template: ManualTemplate) => void;
  availablePhotos?: Photo[];
}

interface GroupedTemplates {
  [printSize: string]: ManualTemplate[];
}

export default function AddPrintsModal({
  isOpen,
  onClose,
  onTemplateAdd,
  availablePhotos = []
}: AddPrintsModalProps) {
  const [loading, setLoading] = useState(true);
  const [groupedTemplates, setGroupedTemplates] = useState<GroupedTemplates>({});
  const [printSizes, setPrintSizes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load templates grouped by print size
  useEffect(() => {
    if (!isOpen) return;

    const loadTemplates = async () => {
      try {
        setLoading(true);
        setError(null);

        console.log('🔄 Loading templates for Add Prints modal...');

        // Get all available print sizes from database
        const printSizeConfigs = await printSizeService.getAvailablePrintSizes();
        const availablePrintSizes = printSizeConfigs.map(config => config.name);
        
        console.log('📏 Available print sizes:', availablePrintSizes);

        // Load templates for each print size
        const grouped: GroupedTemplates = {};
        
        for (const printSize of availablePrintSizes) {
          const templates = await manualTemplateService.getTemplatesByPrintSize(printSize);
          if (templates.length > 0) {
            grouped[printSize] = templates;
          }
        }

        console.log('📋 Grouped templates:', {
          printSizes: Object.keys(grouped),
          totalTemplates: Object.values(grouped).flat().length,
          templateCounts: Object.entries(grouped).reduce((acc, [size, templates]) => {
            acc[size] = templates.length;
            return acc;
          }, {} as Record<string, number>)
        });

        setGroupedTemplates(grouped);
        
        // Sort print sizes according to PRINT_SIZE_ORDER configuration
        const availableSizes = Object.keys(grouped);
        const sortedSizes = [
          ...PRINT_SIZE_ORDER.filter(size => availableSizes.includes(size)), // First: ordered sizes that exist
          ...availableSizes.filter(size => !PRINT_SIZE_ORDER.includes(size)).sort() // Then: any additional sizes alphabetically
        ];
        setPrintSizes(sortedSizes);
      } catch (error) {
        console.error('❌ Error loading templates for Add Prints modal:', error);
        setError('Failed to load available templates. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    loadTemplates();
  }, [isOpen]);

  const handleTemplateSelect = (template: ManualTemplate) => {
    console.log('➕ Adding template to package:', {
      templateId: template.id,
      templateName: template.name,
      printSize: template.print_size
    });
    
    onTemplateAdd(template);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Add More Prints</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors text-2xl font-light"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Loading available templates...</span>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <div className="text-red-600 mb-4">{error}</div>
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : printSizes.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 mb-4">No additional templates available</div>
              <button
                onClick={onClose}
                className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          ) : (
            <div className="space-y-8">
              {printSizes.map(printSize => {
                const templates = groupedTemplates[printSize] || [];
                
                return (
                  <div key={printSize} className="border border-gray-200 rounded-lg p-4">
                    {/* Print Size Header */}
                    <div className="mb-4">
                      <h3 className="text-lg font-medium text-gray-900 mb-1">
                        {printSize} Templates
                      </h3>
                      <div className="text-sm text-gray-600">
                        {templates.length} template{templates.length !== 1 ? 's' : ''} available
                      </div>
                    </div>

                    {/* Templates Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {templates.map(template => {
                        // Generate sample photos for preview
                        const samplePhotos = getSamplePhotosForTemplate(
                          availablePhotos,
                          template.holes_data?.length || 0,
                          template.id.toString()
                        );

                        // Create sample slots for preview
                        const sampleSlots = samplePhotos.map((photo, slotIndex) => ({
                          id: `add-prints-slot-${template.id}-${slotIndex}`,
                          templateId: template.id.toString(),
                          templateName: template.name,
                          templateType: template.template_type,
                          slotIndex,
                          photoId: photo.id,
                          transform: createPhotoTransform(1.0, 0.5, 0.5)
                        }));

                        return (
                          <div
                            key={template.id}
                            className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:shadow-md transition-all cursor-pointer hover:border-green-300"
                            onClick={() => handleTemplateSelect(template)}
                          >
                            {/* Template Header */}
                            <div className="mb-2">
                              <h4 className="font-medium text-gray-900 text-sm truncate">
                                {template.name}
                              </h4>
                              <div className="text-xs text-gray-500">
                                {template.holes_data?.length || 0} photo slot{(template.holes_data?.length || 0) !== 1 ? 's' : ''}
                              </div>
                            </div>

                            {/* Template Preview */}
                            <div 
                              className="bg-white rounded border border-gray-200 overflow-hidden mb-2 flex items-center justify-center"
                              style={{
                                aspectRatio: '1200/1800',
                                minHeight: '180px',
                                maxHeight: '220px'
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
                                    dimensions: template.dimensions || {
                                      width: 1200,
                                      height: 1800
                                    },
                                    printSize: template.print_size,
                                    pngUrl: (() => {
                                      const fileId = template.drive_file_id?.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1] || template.drive_file_id;
                                      const cleanFileId = fileId?.replace(/[^a-zA-Z0-9-_]/g, '');
                                      return cleanFileId ? `https://lh3.googleusercontent.com/d/${cleanFileId}` : '';
                                    })(),
                                    hasInternalBranding: false,
                                    lastUpdated: new Date(),
                                    createdAt: new Date()
                                  }}
                                  templateSlots={sampleSlots}
                                  onSlotClick={() => {}}
                                  photos={samplePhotos}
                                  selectedSlot={null}
                                  isEditingMode={false}
                                  isActiveTemplate={false}
                                  debugHoles={false}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
                                  Preview unavailable
                                </div>
                              )}
                            </div>

                            {/* Add Button */}
                            <button className="w-full bg-green-600 text-white py-1.5 px-3 rounded text-sm font-medium hover:bg-green-700 transition-colors">
                              Add Template
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}