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

  // Get the PNG URL from the correct property
  const fileId = pngTemplate.drive_file_id?.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  const pngUrl = pngTemplate.pngUrl || 
                 pngTemplate.thumbnail_url || 
                 pngTemplate.base64_preview ||
                 (fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : null);
  
  console.log('🖼️ PngTemplateVisual DEBUG:', {
    templateName: pngTemplate.name,
    finalPngUrl: pngUrl,
    base64_preview: pngTemplate.base64_preview,
    drive_file_id: pngTemplate.drive_file_id,
    thumbnail_url: pngTemplate.thumbnail_url,
    allTemplateProperties: Object.keys(pngTemplate),
    fullTemplate: pngTemplate
  });

  return (
    <div className="relative w-full h-full">
      {/* Background PNG Template */}
      <img 
        src={pngUrl}
        alt={pngTemplate.name}
        className="w-full h-full object-contain"
        style={{ aspectRatio: `${pngTemplate.dimensions.width}/${pngTemplate.dimensions.height}` }}
        onLoad={() => console.log('✅ PNG loaded successfully:', pngTemplate.name)}
        onError={() => console.error('❌ PNG failed to load:', pngUrl)}
      />
      
      {/* Photo Holes Overlay */}
      {pngTemplate.holes.map((hole, holeIndex) => {
        const slot = thisTemplateSlots[holeIndex];
        if (!slot) return null;
        
        const photoUrl = getPhotoUrl(slot.photoId);
        const isSelected = selectedSlot?.id === slot.id;
        
        // Debug transform values
        if (slot.transform) {
          console.log(`🔧 Slot ${holeIndex} transform:`, {
            scale: slot.transform.scale,
            x: slot.transform.x,
            y: slot.transform.y,
            photoUrl: photoUrl?.substring(0, 50) + '...'
          });
        }
        
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
              <div className="w-full h-full bg-gray-200 flex items-center justify-center relative overflow-hidden">
                {/* Completely clean placeholder - no outline or icons */}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}