import React from 'react';
import { TemplateSlot as Slot, Photo, PhotoTransform, ContainerTransform } from '../types';
import { PngTemplate } from '../services/pngTemplateService';
import TemplateSlot from './TemplateSlot';

interface PngTemplateVisualProps {
  pngTemplate: PngTemplate;
  templateSlots: Slot[];
  onSlotClick: (slot: Slot) => void;
  photos: Photo[];
  selectedSlot: Slot | null;
  // Inline editing props
  inlineEditingSlot?: Slot | null;
  inlineEditingPhoto?: Photo | null;
  onInlineApply?: (slotId: string, photoId: string, transform: PhotoTransform) => void;
  onInlineCancel?: () => void;
  // Drag and drop props
  isActiveTemplate?: boolean;
  onDropPhoto?: (slot: Slot, photoId: string) => void;
}

export default function PngTemplateVisual({
  pngTemplate,
  templateSlots,
  onSlotClick,
  photos,
  selectedSlot,
  inlineEditingSlot,
  inlineEditingPhoto,
  onInlineApply,
  onInlineCancel,
  isActiveTemplate = false,
  onDropPhoto
}: PngTemplateVisualProps) {
  const templateUrl = (pngTemplate as any)?.templateUrl || (pngTemplate as any)?.url;
  
  if (!templateUrl || !pngTemplate?.holes) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-500">
        No template available
      </div>
    );
  }

  // Extract file ID from Google Drive URL
  const getTemplateImageUrl = (url: string) => {
    const fileIdMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (fileIdMatch) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
    return url;
  };

  // Helper to get photo URLs
  const getPhotoUrl = (photoId: string | undefined): string | null => {
    if (!photoId) return null;
    const photo = photos.find(p => p.id === photoId);
    return photo?.thumbnailUrl || photo?.url || null;
  };

  // Filter template slots for the current template
  const thisTemplateSlots = templateSlots.filter(
    slot => slot.templateType === pngTemplate.id
  );

  // Check if any slot is being edited
  const isEditingMode = !!inlineEditingSlot;

  console.log('🖼️ PngTemplateVisual render:', {
    pngTemplateId: pngTemplate.id,
    templateUrl: templateUrl,
    holesCount: pngTemplate.holes.length,
    slotsToRender: thisTemplateSlots.length,
    holesAvailable: pngTemplate.holes?.length || 0,
    slotIds: thisTemplateSlots.map(s => s.id),
    slotTemplateTypes: [...new Set(templateSlots.map(s => s.templateType))],
    firstSlotData: templateSlots[0] ? {
      id: templateSlots[0].id,
      templateType: templateSlots[0].templateType,
      templateTypeMatch: templateSlots[0].templateType === pngTemplate.id
    } : null,
    isActiveTemplate,
    isEditingMode,
    inlineEditingSlotId: inlineEditingSlot?.id,
    selectedSlotId: selectedSlot?.id
  });

  const templateImageUrl = getTemplateImageUrl(templateUrl);

  return (
    <div className="relative w-full h-full">
      {/* PNG Background with proper aspect ratio */}
      <div 
        className="relative mx-auto"
        style={{
          width: '800px',
          height: 'auto',
          aspectRatio: `${pngTemplate.dimensions.width} / ${pngTemplate.dimensions.height}`,
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      >
        {/* Template Background */}
        <img
          src={templateImageUrl}
          alt="Template"
          className="w-full h-full"
          style={{
            display: 'block'
          }}
        />
        
        {/* Photo Holes Overlay */}
        {pngTemplate.holes.map((hole, holeIndex) => {
          const slot = thisTemplateSlots[holeIndex];
          
          return (
            <TemplateSlot
              key={hole.id}
              hole={hole}
              holeIndex={holeIndex}
              slot={slot}
              pngTemplate={pngTemplate}
              getPhotoUrl={getPhotoUrl}
              selectedSlot={selectedSlot}
              inlineEditingSlot={inlineEditingSlot || null}
              inlineEditingPhoto={inlineEditingPhoto || null}
              isEditingMode={isEditingMode}
              isActiveTemplate={isActiveTemplate}
              onDropPhoto={onDropPhoto}
              onSlotClick={onSlotClick}
              onInlineApply={onInlineApply ? (slot, transform) => {
                if (slot.transform && 'version' in slot.transform) {
                  // It's a PhotoTransform
                  onInlineApply(slot.id, slot.photoId || '', slot.transform as PhotoTransform);
                } else {
                  // Convert ContainerTransform to PhotoTransform
                  const photoTransform: PhotoTransform = {
                    photoScale: transform.scale,
                    photoCenterX: 0.5 - (transform.x / 100),
                    photoCenterY: 0.5 - (transform.y / 100),
                    version: 'photo-centric'
                  };
                  onInlineApply(slot.id, slot.photoId || '', photoTransform);
                }
              } : undefined}
              onInlineCancel={onInlineCancel}
              photos={photos}
            />
          );
        })}
      </div>
    </div>
  );
}