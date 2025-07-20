import React from 'react';
import { TemplateSlot, Photo } from '../types';
import { PngTemplate } from '../services/pngTemplateService';

interface PngTemplateVisualProps {
  pngTemplate: PngTemplate;
  templateSlots: TemplateSlot[];
  onSlotClick: (slot: TemplateSlot) => void;
  photos: Photo[];
  selectedSlot: TemplateSlot | null;
}

export default function PngTemplateVisual({
  pngTemplate,
  templateSlots,
  onSlotClick,
  photos,
  selectedSlot
}: PngTemplateVisualProps) {
  
  const getPhotoUrl = (photoId?: string | null) => {
    if (!photoId) return null;
    return photos.find(p => p.id === photoId)?.url || null;
  };

  // Find all slots for this template
  const thisTemplateSlots = templateSlots.filter(slot => 
    slot.templateId.startsWith(pngTemplate.id)
  );

  return (
    <div className="relative w-full h-full">
      {/* Background PNG Template */}
      <img 
        src={pngTemplate.pngUrl}
        alt={pngTemplate.name}
        className="w-full h-full object-contain"
        style={{ aspectRatio: `${pngTemplate.dimensions.width}/${pngTemplate.dimensions.height}` }}
      />
      
      {/* Photo Holes Overlay */}
      {pngTemplate.holes.map((hole, holeIndex) => {
        const slot = thisTemplateSlots[holeIndex];
        if (!slot) return null;
        
        const photoUrl = getPhotoUrl(slot.photoId);
        const isSelected = selectedSlot?.id === slot.id;
        
        return (
          <div
            key={hole.id}
            className={`absolute cursor-pointer transition-all duration-200 ${
              isSelected ? 'ring-4 ring-blue-500 ring-opacity-75' : 'hover:ring-2 hover:ring-blue-300'
            }`}
            style={{
              left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
              top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
              width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
              height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`,
            }}
            onClick={() => onSlotClick(slot)}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`Photo ${holeIndex + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center relative" style={{ outline: '2px dashed #9ca3af', outlineOffset: '-2px' }}>
                <span className="text-gray-500 text-xs font-medium">
                  {holeIndex + 1}
                </span>
                {/* Debug info for hole dimensions */}
                <div className="absolute top-0 right-0 bg-green-500 text-white text-xs px-1 leading-tight">
                  {pngTemplate.holes[holeIndex]?.width}×{pngTemplate.holes[holeIndex]?.height}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}