import React, { useRef, useEffect } from 'react';
import { TemplateSlot as Slot, Photo, ContainerTransform, PhotoTransform } from '../types';
import PhotoRenderer from './PhotoRenderer';
import InlinePhotoEditor from './InlinePhotoEditor';
import { isPhotoTransform, isContainerTransform } from '../types';

interface TemplateSlotProps {
  hole: any; // PngTemplateHole
  holeIndex: number;
  slot: Slot | undefined;
  pngTemplate: any; // PngTemplate
  getPhotoUrl: (photoId: string | undefined) => string | null;
  selectedSlot: Slot | null;
  inlineEditingSlot: Slot | null;
  inlineEditingPhoto: Photo | null;
  isEditingMode: boolean;
  isActiveTemplate: boolean;
  onDropPhoto?: (slot: Slot, photoId: string) => void;
  onSlotClick?: (slot: Slot) => void;
  onInlineApply?: (slot: Slot, transform: ContainerTransform) => void;
  onInlineCancel?: () => void;
  photos: Photo[];
}

export default function TemplateSlot({
  hole,
  holeIndex,
  slot,
  pngTemplate,
  getPhotoUrl,
  selectedSlot,
  inlineEditingSlot,
  inlineEditingPhoto,
  isEditingMode,
  isActiveTemplate,
  onDropPhoto,
  onSlotClick,
  onInlineApply,
  onInlineCancel,
  photos
}: TemplateSlotProps) {
  // Always show holes, even without slots (for debugging/preview)
  const photoUrl = slot ? getPhotoUrl(slot.photoId) : null;
  const isSelected = slot && selectedSlot?.id === slot.id;
  const isInlineEditing = slot && inlineEditingSlot?.id === slot.id;
  const hasInlinePhoto = isInlineEditing && inlineEditingPhoto;
  
  // Debug logging
  console.log(`🕳️ HOLE DEBUG ${holeIndex + 1}/${pngTemplate.holes.length}:`, {
    holeId: hole.id,
    position: { x: hole.x, y: hole.y },
    size: { width: hole.width, height: hole.height },
    templateDimensions: pngTemplate.dimensions,
    percentages: {
      left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
      top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
      width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
      height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`
    },
    hasSlot: !!slot,
    slotId: slot?.id
  });
  
  // DEBUG: Log ALL slots to identify multiple editor issue
  if (slot) {
    console.log(`🔧 SLOT ${holeIndex + 1} (${slot.id}) EDITING CHECK:`, {
      slotId: slot.id,
      isSelected,
      isInlineEditing,
      hasInlinePhoto,
      inlineEditingSlotId: inlineEditingSlot?.id,
      inlineEditingPhotoName: inlineEditingPhoto?.name,
      hasOnInlineApply: !!onInlineApply,
      hasOnInlineCancel: !!onInlineCancel,
      willShowInlineEditor: hasInlinePhoto && onInlineApply && onInlineCancel,
      photoUrl: photoUrl ? photoUrl.substring(0, 50) + '...' : 'none'
    });
  }
  
  // Debug transform values
  if (slot?.transform) {
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
  
  // Check if this slot should be blocked during editing mode or inactive template
  const isOtherSlotDuringEditing = isEditingMode && !isInlineEditing;
  const isInactiveTemplate = !isActiveTemplate;
  const shouldBlockSlot = isOtherSlotDuringEditing || isInactiveTemplate;
  
  // For preview mode (non-interactive), never apply darkening effects
  const isPreviewMode = !isActiveTemplate && !isEditingMode;
  const shouldApplyDarkening = shouldBlockSlot && !isPreviewMode;
  
  // Ref for touch drop handling
  const slotRef = useRef<HTMLDivElement>(null);
  
  // Handle custom drop event (from pointer events)
  useEffect(() => {
    const handleCustomDrop = (e: CustomEvent) => {
      if (!slot || shouldBlockSlot || isPreviewMode) return;
      
      const photo = e.detail.photo;
      if (photo && onDropPhoto) {
        onDropPhoto(slot, photo.id);
        console.log('🎯 Custom drop photo on slot:', { 
          slotId: slot.id, 
          photoId: photo.id,
          isReplacement: !!slot.photoId 
        });
      }
    };
    
    const element = slotRef.current;
    if (element) {
      element.addEventListener('customdrop', handleCustomDrop as EventListener);
      return () => {
        element.removeEventListener('customdrop', handleCustomDrop as EventListener);
      };
    }
  }, [slot, shouldBlockSlot, isPreviewMode, onDropPhoto]);
  
  // Handle drag enter - set preview
  const handleDragEnter = (e: React.DragEvent) => {
    if (!slot || shouldBlockSlot || isPreviewMode) return;
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag entered slot:', slot.id);
  };
  
  // Handle drag over
  const handleDragOver = (e: React.DragEvent) => {
    if (!slot || shouldBlockSlot || isPreviewMode) return;
    e.preventDefault();
    e.stopPropagation();
  };
  
  // Handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    if (!slot || shouldBlockSlot || isPreviewMode) return;
    e.preventDefault();
    e.stopPropagation();
    console.log('Drag left slot:', slot.id);
  };
  
  // Handle drop
  const handleDrop = (e: React.DragEvent) => {
    if (!slot || shouldBlockSlot || isPreviewMode) return;
    e.preventDefault();
    e.stopPropagation();
    
    const photoId = e.dataTransfer.getData('photoId');
    console.log('Desktop drop on slot:', { slotId: slot.id, photoId });
    
    if (photoId && onDropPhoto) {
      onDropPhoto(slot, photoId);
    }
  };
  
  // Calculate hole position using template dimensions
  const holeStyle = {
    position: 'absolute' as const,
    left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
    top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
    width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
    height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`
  };
  
  // Find the actual photo object
  const actualPhoto = slot?.photoId ? photos.find(p => p.id === slot.photoId) : null;
  
  return (
    <div 
      key={hole.id}
      ref={slotRef}
      className={`
        ${slot ? 'cursor-pointer' : ''}
        ${isInlineEditing ? 'z-20' : 'z-10'}
        ${shouldApplyDarkening ? 'opacity-50' : ''}
      `}
      style={holeStyle}
      onClick={() => slot && onSlotClick && !shouldBlockSlot && !isPreviewMode && onSlotClick(slot)}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Debug outline for hole visualization */}
      <div className="absolute inset-0 border border-blue-500 opacity-30 pointer-events-none" />
      
      {slot && photoUrl && actualPhoto && (
        <>
          {/* Photo Content - use PhotoRenderer for consistent display */}
          <PhotoRenderer
            photoUrl={photoUrl}
            photoAlt={actualPhoto.name}
            transform={slot.transform}
            interactive={!!photoUrl && !isInlineEditing && !shouldBlockSlot && !isPreviewMode}
            onTransformChange={(newTransform) => {
              // Auto-save transform changes
              if (onInlineApply) {
                console.log('🔧 Auto-saving transform change from TemplateSlot');
                const containerTransform: ContainerTransform = {
                  scale: newTransform.photoScale,
                  x: (0.5 - newTransform.photoCenterX) * 100,
                  y: (0.5 - newTransform.photoCenterY) * 100
                };
                onInlineApply(slot, containerTransform);
              }
            }}
          />
          
          {/* Inline Editor - Commented out, using direct manipulation instead
          {hasInlinePhoto && onInlineApply && onInlineCancel && (
            <div className="absolute inset-0 z-30">
              <InlinePhotoEditor
                slot={slot}
                photo={inlineEditingPhoto}
                photos={photos}
                onApply={(slotId, photoId, transform) => {
                  const foundSlot = slot;
                  if (foundSlot && onInlineApply) {
                    // Convert PhotoTransform to ContainerTransform
                    const containerTransform: ContainerTransform = {
                      scale: transform.photoScale,
                      x: (0.5 - transform.photoCenterX) * 100,
                      y: (0.5 - transform.photoCenterY) * 100
                    };
                    onInlineApply(foundSlot, containerTransform);
                  }
                }}
                onCancel={onInlineCancel}
              />
            </div>
          )}
          */}
        </>
      )}
      
      {/* Empty slot indicator */}
      {slot && !photoUrl && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-500 text-xs">
          Slot {holeIndex + 1}
        </div>
      )}
    </div>
  );
}