import React, { useState, useEffect } from 'react';
import { ManualTemplate, Photo, TemplateSlot } from '../types';
import { AnimatedTemplateItem } from './animations/AnimatedTemplateReveal';
import PngTemplateVisual from './PngTemplateVisual';
import { getSamplePhotosForTemplate } from '../utils/samplePhotoUtils';
import { createPhotoTransform, createSmartPhotoTransformFromSlot } from '../types';
import { getPrintSizeDimensions } from '../utils/printSizeDimensions';

interface PreviewTemplateWithSmartTransformsProps {
  template: ManualTemplate;
  index: number;
  availablePhotos: Photo[];
  originalTemplateCount: number;
  onChangeTemplate: (template: ManualTemplate, index: number) => void;
  onDeleteClick?: (index: number, templateName: string) => void;
  globalHoleOffset: number;
  createGlobalPhotoAssignment: (globalHoleIndex: number) => string;
}

export default function PreviewTemplateWithSmartTransforms({
  template,
  index,
  availablePhotos,
  originalTemplateCount,
  onChangeTemplate,
  onDeleteClick,
  globalHoleOffset,
  createGlobalPhotoAssignment
}: PreviewTemplateWithSmartTransformsProps) {
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

      if (process.env.NODE_ENV === 'development') console.log(`🧠 CALCULATING SMART TRANSFORMS - Template ${template.name}:`, {
        templateId: template.id,
        samplePhotosGenerated: samplePhotos.length,
        holesCount: template.holes_data?.length || 0
      });

      // Create slots with smart transforms
      const smartSlots = await Promise.all(samplePhotos.map(async (photo, slotIndex) => {
        const baseSlot: TemplateSlot = {
          id: `preview-smart-slot-${template.id}-${slotIndex}`,
          templateId: template.id.toString(),
          templateName: template.name,
          templateType: template.id.toString(),
          printSize: template.print_size,
          slotIndex,
          photoId: photo.id,
          transform: createPhotoTransform(1.0, 0.5, 0.5)
        };

        try {
          // Calculate smart transform for auto-alignment
          const smartTransform = await createSmartPhotoTransformFromSlot(photo, baseSlot);
          
          if (process.env.NODE_ENV === 'development') console.log(`🎯 SMART TRANSFORM - Template ${template.name}, Slot ${slotIndex}:`, {
            photoId: photo.id,
            baseTransform: baseSlot.transform,
            smartTransform
          });
          
          return {
            ...baseSlot,
            transform: smartTransform
          };
        } catch (error) {
          if (process.env.NODE_ENV === 'development') console.log(`⚠️ Smart transform failed for slot ${slotIndex}, using default:`, error);
          return baseSlot;
        }
      }));

      setSampleSlots(smartSlots);
      setIsLoadingTransforms(false);
    };

    calculateSmartTransforms();
  }, [template.id, availablePhotos.length]);

  if (process.env.NODE_ENV === 'development') console.log(`🎨 RENDERING SMART PREVIEW TEMPLATE ${index + 1}:`, {
    templateId: template.id,
    templateName: template.name,
    sampleSlotsReady: sampleSlots.length,
    isLoadingTransforms
  });

  // Generate sample photos for display (same as used in smart calculation)
  const samplePhotos = getSamplePhotosForTemplate(
    availablePhotos.length > 0 ? availablePhotos : [],
    template.holes_data?.length || 0,
    template.id.toString()
  );

  // Create photo filename assignments for this template's holes
  const holePhotoAssignments = (template.holes_data || []).map((hole, holeIndex) => {
    const globalHoleIndex = globalHoleOffset + holeIndex;
    return createGlobalPhotoAssignment(globalHoleIndex);
  });

  return (
    <AnimatedTemplateItem key={`${template.id}-${index}`} index={index}>
      <div className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:shadow-md transition-shadow">
        {/* Template Header with Name and Change Button */}
        <div className="flex justify-between items-start mb-2">
          <div className="flex-1 min-w-0">
            {/* Additional Print Badge */}
            {index >= originalTemplateCount && (
              <div className="mb-1">
                <span className="inline-block bg-blue-100 text-blue-700 text-xs font-medium px-2 py-0.5 rounded-full">
                  Additional Print
                </span>
              </div>
            )}
            <h4 className="font-medium text-gray-900 text-sm truncate">
              {template.name}
            </h4>
            <div className="text-xs text-gray-500 mt-1">
              {template.holes_data?.length || 0} photo slot{(template.holes_data?.length || 0) !== 1 ? 's' : ''}
              {isLoadingTransforms && (
                <span className="ml-1 text-blue-600">• Auto-aligning...</span>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-1 flex-shrink-0">
            <button
              onClick={() => onChangeTemplate(template, index)}
              className="bg-gray-500 text-white px-2 py-1 rounded text-xs font-medium hover:bg-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1"
            >
              <span className="hidden sm:inline">Change Template</span>
              <span className="sm:hidden">Change</span>
            </button>
            {/* Delete button for additional templates only */}
            {index >= originalTemplateCount && onDeleteClick && (
              <button
                onClick={() => onDeleteClick(index, template.name)}
                className="text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-1 rounded p-0.5"
                title="Remove this added template"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Template Visual Preview with Smart Auto-Aligned Photos */}
        <div 
          className="bg-white rounded border border-gray-200 overflow-hidden mb-1 flex items-center justify-center"
          style={{
            aspectRatio: template.dimensions 
              ? `${template.dimensions.width}/${template.dimensions.height}`
              : template.print_size === 'A4' ? '2480/3508'
              : template.print_size === '5R' ? '1500/2100'
              : '1200/1800', // Default to 4R
            minHeight: '250px',
            maxHeight: '500px'
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
              onSlotClick={() => {}} // No interaction in preview
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