import React from 'react';
import { TemplateSlot, Photo, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform } from '../types';
import { PngTemplate } from '../services/pngTemplateService';
import PhotoRenderer from './PhotoRenderer';

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

  // Since TemplateVisual already filtered and passed only relevant slots, use them directly
  const thisTemplateSlots = templateSlots;
  
  console.log('🔍 PngTemplateVisual slot mapping:', {
    pngTemplateId: pngTemplate.id,
    pngTemplateType: pngTemplate.templateType,
    pngTemplateName: pngTemplate.name,
    slotsReceived: templateSlots.length,
    slotsToRender: thisTemplateSlots.length,
    holesAvailable: pngTemplate.holes?.length || 0,
    slotIds: thisTemplateSlots.map(s => s.id),
    slotTemplateTypes: [...new Set(templateSlots.map(s => s.templateType))],
    firstSlotData: templateSlots[0] ? {
      id: templateSlots[0].id,
      templateId: templateSlots[0].templateId,
      templateType: templateSlots[0].templateType,
      slotIndex: templateSlots[0].slotIndex,
      hasPhoto: !!templateSlots[0].photoId
    } : null
  });

  // Get the PNG URL from the correct property
  const driveFileId = (pngTemplate as any).drive_file_id || pngTemplate.driveFileId;
  const fileId = driveFileId?.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  const pngUrl = pngTemplate.pngUrl || 
                 (pngTemplate as any).thumbnail_url || 
                 (pngTemplate as any).base64_preview ||
                 (fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : null);
  
  console.log('🖼️ PngTemplateVisual DEBUG:', {
    templateName: pngTemplate.name,
    templateType: pngTemplate.templateType,
    finalPngUrl: pngUrl,
    base64_preview: (pngTemplate as any).base64_preview?.substring(0, 50) + '...',
    drive_file_id: driveFileId,
    thumbnail_url: (pngTemplate as any).thumbnail_url,
    extractedFileId: fileId,
    allTemplateProperties: Object.keys(pngTemplate),
    slotsConnected: thisTemplateSlots.length,
    firstSlotTemplateType: thisTemplateSlots[0]?.templateType,
    holesCount: pngTemplate.holes?.length
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
          if (isPhotoTransform(slot.transform)) {
            console.log(`🔧 Slot ${holeIndex} photo-centric transform:`, {
              photoScale: slot.transform.photoScale,
              photoCenterX: slot.transform.photoCenterX,
              photoCenterY: slot.transform.photoCenterY,
              photoUrl: photoUrl?.substring(0, 50) + '...'
            });
          } else if (isContainerTransform(slot.transform)) {
            console.log(`🔧 Slot ${holeIndex} container transform:`, {
              scale: slot.transform.scale,
              x: slot.transform.x,
              y: slot.transform.y,
              photoUrl: photoUrl?.substring(0, 50) + '...'
            });
          }
        }
        
        return (
          <div
            key={hole.id}
            className={`absolute cursor-pointer transition-all duration-200 ${
              isSelected ? 'border-4 border-blue-500 border-opacity-90 z-10' : 'hover:border-2 hover:border-blue-300 hover:border-opacity-60'
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
              <PhotoRenderer
                photoUrl={photoUrl}
                photoAlt={`Photo ${holeIndex + 1}`}
                transform={slot.transform}
                interactive={false}
                className="w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center relative overflow-hidden border-2 border-dashed border-gray-400">
                {/* Visible placeholder with icon */}
                <div className="text-center text-gray-500">
                  <div className="text-lg mb-1">+</div>
                  <div className="text-xs font-medium">Tap to Add</div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}