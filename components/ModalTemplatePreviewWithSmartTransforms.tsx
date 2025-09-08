import React, { useState, useEffect } from 'react';
import { ManualTemplate, Photo, TemplateSlot } from '../types';
import { AnimatedTemplateItem } from './animations/AnimatedTemplateReveal';
import PngTemplateVisual from './PngTemplateVisual';
import { getSamplePhotosForTemplate } from '../utils/samplePhotoUtils';
import { createPhotoTransform, createSmartPhotoTransformFromSlot } from '../types';
import { getPrintSizeDimensions } from '../utils/printSizeDimensions';

interface ModalTemplatePreviewWithSmartTransformsProps {
  template: ManualTemplate;
  index: number;
  availablePhotos: Photo[];
  isCurrent: boolean;
  isSelected: boolean;
  onTemplateSelect: (template: ManualTemplate) => void;
}

export default function ModalTemplatePreviewWithSmartTransforms({
  template,
  index,
  availablePhotos,
  isCurrent,
  isSelected,
  onTemplateSelect
}: ModalTemplatePreviewWithSmartTransformsProps) {
  const [sampleSlots, setSampleSlots] = useState<TemplateSlot[]>([]);
  const [isLoadingTransforms, setIsLoadingTransforms] = useState(true);

  useEffect(() => {
    const calculateSmartTransforms = async () => {
      setIsLoadingTransforms(true);

      // Generate sample photos for this template
      const samplePhotos = getSamplePhotosForTemplate(
        availablePhotos.length > 0 ? availablePhotos : [],
        template.holes_data?.length || 0,
        template.id.toString()
      );

      if (process.env.NODE_ENV === 'development') console.log(`🧠 MODAL - Calculating smart transforms for ${template.name}:`, {
        templateId: template.id,
        samplePhotosGenerated: samplePhotos.length,
        holesCount: template.holes_data?.length || 0
      });

      // Create slots with smart transforms
      const smartSlots = await Promise.all(samplePhotos.map(async (photo, slotIndex) => {
        const baseSlot: TemplateSlot = {
          id: `modal-slot-${template.id}-${slotIndex}`,
          templateId: template.id.toString(),
          templateName: template.name,
          templateType: template.id.toString(),
          printSize: template.print_size,
          slotIndex,
          photoId: photo.id,
          transform: createPhotoTransform(1.0, 0.5, 0.5)
        };

        try {
          const smartTransform = await createSmartPhotoTransformFromSlot(photo, baseSlot);
          
          if (process.env.NODE_ENV === 'development') console.log(`🎯 MODAL SMART TRANSFORM - ${template.name}, Slot ${slotIndex}:`, {
            photoId: photo.id,
            smartTransform
          });
          
          return {
            ...baseSlot,
            transform: smartTransform
          };
        } catch (error) {
          if (process.env.NODE_ENV === 'development') console.log(`⚠️ Modal smart transform failed for slot ${slotIndex}:`, error);
          return baseSlot;
        }
      }));

      setSampleSlots(smartSlots);
      setIsLoadingTransforms(false);
    };

    calculateSmartTransforms();
  }, [template.id, availablePhotos.length]);

  // Generate sample photos for display
  const samplePhotos = getSamplePhotosForTemplate(
    availablePhotos.length > 0 ? availablePhotos : [],
    template.holes_data?.length || 0,
    template.id.toString()
  );

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
        onClick={() => !isCurrent && onTemplateSelect(template)}
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
                {isLoadingTransforms && !isCurrent && (
                  <span className="ml-1 text-blue-600">• Auto-aligning...</span>
                )}
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
              templateSlots={sampleSlots} // Use smart-calculated slots
              onSlotClick={() => {}} // No interaction in modal
              photos={samplePhotos}
              selectedSlot={null}
              isActiveTemplate={false} // Non-interactive preview
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
}