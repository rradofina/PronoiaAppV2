import React from 'react';
import { TemplateSlot, Photo, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform } from '../types';
import { PngTemplate } from '../services/pngTemplateService';
import PhotoRenderer from './PhotoRenderer';
import InlinePhotoEditor from './InlinePhotoEditor';

interface PngTemplateVisualProps {
  pngTemplate: PngTemplate;
  templateSlots: TemplateSlot[];
  onSlotClick: (slot: TemplateSlot) => void;
  photos: Photo[];
  selectedSlot: TemplateSlot | null;
  // Inline editing props
  inlineEditingSlot?: TemplateSlot | null;
  inlineEditingPhoto?: Photo | null;
  onInlineApply?: (slotId: string, photoId: string, transform: PhotoTransform) => void;
  onInlineCancel?: () => void;
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
  onInlineCancel
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
    <div 
      className="relative w-full h-full overflow-hidden"
      style={{ 
        aspectRatio: `${pngTemplate.dimensions.width}/${pngTemplate.dimensions.height}`,
        maxWidth: '100%',
        maxHeight: '100%'
      }}
    >
      {/* Background PNG Template */}
      <img 
        src={pngUrl}
        alt={pngTemplate.name}
        className="absolute inset-0 w-full h-full object-fill"
        onLoad={() => console.log('✅ PNG loaded successfully:', pngTemplate.name)}
        onError={() => console.error('❌ PNG failed to load:', pngUrl)}
      />
      
      {/* Photo Holes Overlay */}
      {pngTemplate.holes.map((hole, holeIndex) => {
        const slot = thisTemplateSlots[holeIndex];
        if (!slot) return null;
        
        const photoUrl = getPhotoUrl(slot.photoId);
        const isSelected = selectedSlot?.id === slot.id;
        const isInlineEditing = inlineEditingSlot?.id === slot.id;
        const hasInlinePhoto = isInlineEditing && inlineEditingPhoto;
        
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
            className={`absolute transition-all duration-200 overflow-hidden ${
              isInlineEditing 
                ? 'border-4 border-yellow-400 shadow-lg shadow-yellow-400/50 z-50 ring-2 ring-yellow-300' // Enhanced highlighting for inline editing
                : isSelected 
                ? 'border-4 border-blue-500 border-opacity-90 z-10 cursor-pointer shadow-md' 
                : 'hover:border-2 hover:border-blue-300 hover:border-opacity-60 cursor-pointer'
            }`}
            style={{
              left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
              top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
              width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
              height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`,
            }}
            onClick={() => !isInlineEditing && onSlotClick(slot)}
          >
            {hasInlinePhoto && onInlineApply && onInlineCancel ? (
              // Inline editing mode - show InlinePhotoEditor
              <InlinePhotoEditor
                slot={slot}
                photo={inlineEditingPhoto}
                photos={photos}
                onApply={onInlineApply}
                onCancel={onInlineCancel}
                className="w-full h-full"
              />
            ) : photoUrl ? (
              // Normal mode - show photo
              <PhotoRenderer
                photoUrl={photoUrl}
                photoAlt={`Photo ${holeIndex + 1}`}
                transform={slot.transform}
                interactive={false}
                className="w-full h-full"
              />
            ) : (
              // Empty slot - show placeholder with enhanced highlighting when selected
              <div className={`w-full h-full flex items-center justify-center relative overflow-hidden border-2 border-dashed ${
                isInlineEditing 
                  ? 'bg-yellow-50 border-yellow-400 animate-pulse shadow-lg shadow-yellow-400/30' // Enhanced highlighting for inline editing
                  : isSelected 
                  ? 'bg-blue-50 border-blue-400' 
                  : 'bg-gray-200 border-gray-400'
              }`}>
                {/* Visible placeholder with icon */}
                <div className={`text-center ${
                  isInlineEditing 
                    ? 'text-yellow-600 font-bold' 
                    : isSelected 
                    ? 'text-blue-600 font-semibold' 
                    : 'text-gray-500'
                }`}>
                  <div className="text-lg mb-1">+</div>
                  <div className="text-xs font-medium">
                    {isInlineEditing ? 'Select Photo Below' : 'Tap to Add'}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}