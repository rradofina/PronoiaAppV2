import React, { useRef, useEffect } from 'react';
import { TemplateSlot, Photo, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform } from '../types';
import { PngTemplate } from '../services/pngTemplateService';
import PhotoRenderer from './PhotoRenderer';
import InlinePhotoEditor from './InlinePhotoEditor';
import { getHighResPhotoUrls } from '../utils/photoUrlUtils';
import { getPrintSizeDimensions } from '../utils/printSizeDimensions';
import { createPhotoTransform } from '../utils/transformUtils';
import { templateSyncService } from '../services/templateSyncService';

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
  // Editing mode detection
  isEditingMode?: boolean;
  // Active template restriction
  isActiveTemplate?: boolean;
  // Debug mode - shows only holes with borders, hides photos
  debugHoles?: boolean;
  // Photo filename assignments for each hole (for debug mode)
  holePhotoAssignments?: string[];
  // Edit button state and handler
  slotShowingEditButton?: TemplateSlot | null;
  onEditButtonClick?: (slot: TemplateSlot) => void;
  onChangeButtonClick?: (slot: TemplateSlot) => void;
  // Remove confirmation state and handlers
  slotShowingRemoveConfirmation?: TemplateSlot | null;
  onRemoveButtonClick?: (slot: TemplateSlot) => void;
  onConfirmRemove?: (slot: TemplateSlot) => void;
  onCancelRemove?: () => void;
  // Drag and drop handlers
  onDropPhoto?: (slot: TemplateSlot, photoId: string) => void;
  isDraggingPhoto?: boolean;
  // Preview state
  previewSlotId?: string | null;
  previewPhotoId?: string | null;
  onSetPreviewSlot?: (slotId: string | null) => void;
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
  isEditingMode = false,
  isActiveTemplate = true,
  debugHoles = false,
  holePhotoAssignments = [],
  slotShowingEditButton = null,
  onEditButtonClick,
  onChangeButtonClick,
  slotShowingRemoveConfirmation = null,
  onRemoveButtonClick,
  onConfirmRemove,
  onCancelRemove,
  onDropPhoto,
  isDraggingPhoto = false,
  previewSlotId,
  previewPhotoId,
  onSetPreviewSlot
}: PngTemplateVisualProps) {
  
  const getPhotoUrl = (photoId?: string | null) => {
    if (!photoId) return null;
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return null;
    
    // Use the same high-resolution URL strategy as InlinePhotoEditor
    // This ensures consistent quality between editing and display modes
    const highResUrls = getHighResPhotoUrls(photo);
    return highResUrls[0] || photo.url;
  };

  // Since TemplateVisual already filtered and passed only relevant slots, use them directly
  const thisTemplateSlots = templateSlots;
  
  // Create refs for each slot for mobile drag and drop
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  
  // Create finalization refs for auto-snap functionality
  const finalizationRefs = useRef<((() => Promise<PhotoTransform>) | null)[]>([]);
  

  // Get the PNG URL from the correct property
  const driveFileId = (pngTemplate as any).drive_file_id || pngTemplate.driveFileId;
  const fileId = driveFileId?.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
  const pngUrl = pngTemplate.pngUrl || 
                 (pngTemplate as any).thumbnail_url || 
                 (pngTemplate as any).base64_preview ||
                 (fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : null);
  
  // Calculate aspect ratios and container behavior
  const expectedDimensions = getPrintSizeDimensions(pngTemplate.printSize);
  const expectedAspectRatio = expectedDimensions.width / expectedDimensions.height;
  const actualAspectRatio = pngTemplate.dimensions.width / pngTemplate.dimensions.height;
  const aspectRatioMatch = Math.abs(actualAspectRatio - expectedAspectRatio) < 0.01;
  
  // Determine object-contain behavior
  const containerWiderThanPNG = actualAspectRatio < expectedAspectRatio;
  const objectContainBehavior = containerWiderThanPNG 
    ? '📐 PNG fits to HEIGHT, padded on SIDES (left/right)'
    : '📐 PNG fits to WIDTH, padded on TOP/BOTTOM';
  

  // Setup custom drop event listeners for mobile drag and drop
  useEffect(() => {
    const handleCustomDrop = (index: number) => (e: CustomEvent) => {
      const slot = thisTemplateSlots[index];
      if (!slot || !onDropPhoto) return;
      
      // Only block if not active template
      const isInactiveTemplate = !isActiveTemplate;
      if (isInactiveTemplate) return;
      
      const photo = e.detail.photo;
      if (photo) {
        onDropPhoto(slot, photo.id);
      }
    };
    
    // Attach listeners to all slot refs
    slotRefs.current.forEach((ref, index) => {
      if (ref) {
        const handler = handleCustomDrop(index) as EventListener;
        ref.addEventListener('customdrop', handler);
        // Store handler for cleanup
        (ref as any)._customDropHandler = handler;
      }
    });
    
    // Cleanup
    return () => {
      slotRefs.current.forEach((ref) => {
        if (ref && (ref as any)._customDropHandler) {
          ref.removeEventListener('customdrop', (ref as any)._customDropHandler);
          delete (ref as any)._customDropHandler;
        }
      });
    };
  }, [thisTemplateSlots, onDropPhoto, isEditingMode, isActiveTemplate, inlineEditingSlot]);

  return (
    <div 
      className="relative w-full h-full overflow-visible"
      style={{ 
        aspectRatio: `${pngTemplate.dimensions.width}/${pngTemplate.dimensions.height}`,
        maxWidth: '100%',
        maxHeight: '100%'
      }}
    >
      {/* Photo Holes - Render FIRST so they appear BEHIND the template */}
      {pngTemplate.holes.map((hole, holeIndex) => {
        const slot = thisTemplateSlots[holeIndex];
        
        
        // Always show holes, even without slots (for debugging/preview)
        const photoUrl = slot ? getPhotoUrl(slot.photoId) : null;
        const isSelected = slot && selectedSlot?.id === slot.id;
        const isInlineEditing = slot && inlineEditingSlot?.id === slot.id;
        const hasInlinePhoto = isInlineEditing && inlineEditingPhoto;
        
        
        
        // Simple check - only block if not active template
        const isInactiveTemplate = !isActiveTemplate;
        const isPreviewMode = !isActiveTemplate;
        
        // Handle drag enter - set preview
        const handleDragEnter = (e: React.DragEvent) => {
          if (!slot || isInactiveTemplate) return;
          e.preventDefault();
          if (onSetPreviewSlot) {
            onSetPreviewSlot(slot.id);
          }
        };
        
        // Handle drag leave - clear preview
        const handleDragLeave = (e: React.DragEvent) => {
          if (!slot || isPreviewMode) return;
          // Only clear if leaving the actual slot, not child elements
          const rect = e.currentTarget.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
            if (onSetPreviewSlot) {
              onSetPreviewSlot(null);
            }
          }
        };
        
        // Handle drag over
        const handleDragOver = (e: React.DragEvent) => {
          if (!slot || isPreviewMode) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = slot.photoId ? 'move' : 'copy';
        };
        
        // Handle drop
        const handleDrop = (e: React.DragEvent) => {
          if (!slot || isPreviewMode) return;
          e.preventDefault();
          
          // Clear preview first
          if (onSetPreviewSlot) {
            onSetPreviewSlot(null);
          }
          
          const photoId = e.dataTransfer.getData('photoId');
          if (photoId && onDropPhoto) {
            onDropPhoto(slot, photoId);
          }
        };
        
        return (
          <div
            key={hole.id}
            ref={(el) => { slotRefs.current[holeIndex] = el; }}
            className={`absolute ${
              isPreviewMode
                ? ''
                : isDraggingPhoto && slot?.photoId === previewPhotoId && previewSlotId === slot?.id
                ? 'border-2 border-gray-400 border-dashed'
                : isDraggingPhoto && slot?.photoId && previewSlotId === slot?.id
                ? 'border-2 border-orange-400 border-dashed'
                : isDraggingPhoto && !slot?.photoId
                ? 'border-2 border-green-400 border-dashed'
                : ''
            }`}
            style={{
              left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
              top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
              width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
              height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`,
            }}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            title={
              !slot
                ? "Template hole - no slot assigned"
                : isPreviewMode
                ? "Template preview - no interaction available"
                : isInactiveTemplate
                ? "Navigate to this template first to edit placeholders"
                : slot.photoId 
                ? "Click to edit this photo" 
                : "Drag and drop a photo here"
            }
          >
            {debugHoles ? (
              // Debug mode - show photo filename with enhanced borders, no photos
              <div className="w-full h-full flex items-center justify-center bg-blue-100 border-4 border-blue-500 border-dashed">
                <div className="text-center text-blue-800 font-mono text-xs">
                  <div className="font-bold text-sm mb-1">
                    {holePhotoAssignments[holeIndex] || `HOLE ${holeIndex + 1}`}
                  </div>
                  <div className="text-xs text-gray-600 mb-1">
                    {Math.round(hole.width)}×{Math.round(hole.height)}
                  </div>
                  <div className="text-xs mb-1">AR: {(hole.width/hole.height).toFixed(2)}</div>
                  {slot ? (
                    <div className="text-green-600 text-xs">✓ HAS SLOT</div>
                  ) : (
                    <div className="text-red-600 text-xs">✗ NO SLOT</div>
                  )}
                </div>
              </div>
            /* Commented out - using direct manipulation instead
            ) : hasInlinePhoto && onInlineApply && onInlineCancel ? (
              // Inline editing mode - show InlinePhotoEditor
              <>
                <div className="w-full h-full overflow-hidden">
                  <InlinePhotoEditor
                    slot={slot}
                    photo={inlineEditingPhoto}
                    photos={photos}
                    onApply={onInlineApply}
                    onCancel={onInlineCancel}
                    className="w-full h-full"
                  />
                </div>
              </>
            */
            ) : photoUrl ? (
              // Normal mode - show photo with high-resolution fallbacks
              <>
                <div className="w-full h-full overflow-hidden">
                  <PhotoRenderer
                    photoUrl={photoUrl}
                    photoAlt={`Photo ${holeIndex + 1}`}
                    transform={slot?.transform}
                    interactive={!!photoUrl && !isPreviewMode}
                    onTransformChange={(newTransform) => {
                      // Update slot transform immediately during interaction for smooth feedback
                      // This provides real-time visual updates without triggering parent re-renders
                      if (slot && slot.photoId) {
                        // Update only the local slot state, not the parent template state
                        slot.transform = newTransform;
                      }
                    }}
                    onInteractionStart={() => {
                      // Pause background sync during photo manipulation
                      templateSyncService.setUserInteracting(true);
                    }}
                    onInteractionEnd={(finalTransform) => {
                      // Resume background sync after manipulation
                      templateSyncService.setUserInteracting(false);
                      
                      // Save finalized transform with auto-snap applied
                      if (slot && onInlineApply && finalTransform) {
                        onInlineApply(slot.id, slot.photoId!, finalTransform);
                      }
                    }}
                    previewMode={false}
                    className="w-full h-full"
                    fallbackUrls={slot && photos.find(p => p.id === slot.photoId) ? getHighResPhotoUrls(photos.find(p => p.id === slot.photoId)!) : []}
                    finalizationRef={{
                      get current() {
                        return finalizationRefs.current[holeIndex];
                      },
                      set current(value: (() => Promise<PhotoTransform>) | null) {
                        finalizationRefs.current[holeIndex] = value;
                      }
                    }}
                    onSmartReset={async () => {
                      // Smart reset for optimal photo placement
                      const photo = photos.find(p => p.id === slot?.photoId);
                      if (photo && slot) {
                        const { createSmartPhotoTransformFromSlot } = await import('../types');
                        return createSmartPhotoTransformFromSlot(photo, slot);
                      }
                      return createPhotoTransform(1, 0.5, 0.5);
                    }}
                  />
                </div>
                
              </>
            ) : slot && previewSlotId === slot.id && previewPhotoId ? (
              // Preview mode - show preview photo while dragging
              (() => {
                const previewPhoto = photos.find(p => p.id === previewPhotoId);
                const previewUrl = previewPhoto ? (previewPhoto.thumbnailUrl || previewPhoto.url) : null;
                const isReplacement = !!slot.photoId;
                const isSamePhoto = slot.photoId === previewPhotoId;
                
                return previewUrl ? (
                  <div className="w-full h-full overflow-hidden relative">
                    {/* For same photo, just show the existing photo with indicator */}
                    {isSamePhoto && photoUrl ? (
                      <>
                        <PhotoRenderer
                          photoUrl={photoUrl}
                          photoAlt={`Current Photo`}
                          transform={slot?.transform}
                          interactive={false}
                          previewMode={true}
                          className="w-full h-full"
                          fallbackUrls={slot && photos.find(p => p.id === slot.photoId) ? getHighResPhotoUrls(photos.find(p => p.id === slot.photoId)!) : []}
                        />
                        <div className="absolute inset-0 border-4 border-gray-400 border-dashed pointer-events-none" />
                        <div className="absolute top-2 left-2 bg-gray-600 text-white px-2 py-1 rounded text-xs font-semibold pointer-events-none flex items-center gap-1">
                          <span>ℹ️</span>
                          <span>Same Photo</span>
                        </div>
                      </>
                    ) : isSamePhoto ? (
                      // Edge case: same photo but no URL (shouldn't happen but handle gracefully)
                      <div className="absolute inset-0 border-4 border-gray-400 border-dashed pointer-events-none" />
                    ) : (
                      <>
                        {/* Show existing photo if replacing */}
                        {isReplacement && photoUrl && (
                          <div className="absolute inset-0">
                            <PhotoRenderer
                              photoUrl={photoUrl}
                              photoAlt={`Current Photo`}
                              transform={slot?.transform}
                              interactive={false}
                              previewMode={true}
                              className="w-full h-full"
                              fallbackUrls={slot && photos.find(p => p.id === slot.photoId) ? getHighResPhotoUrls(photos.find(p => p.id === slot.photoId)!) : []}
                            />
                          </div>
                        )}
                        <PhotoRenderer
                          photoUrl={previewUrl}
                          photoAlt={`Preview`}
                          transform={createPhotoTransform(1.0, 0.5, 0.5)}
                          interactive={false}
                          previewMode={true}
                          className="w-full h-full"
                          fallbackUrls={previewPhoto ? getHighResPhotoUrls(previewPhoto) : []}
                        />
                        <div className={`absolute inset-0 border-4 ${isReplacement ? 'border-orange-400' : 'border-green-400'} border-dashed pointer-events-none`} />
                        <div className={`absolute top-2 left-2 ${isReplacement ? 'bg-orange-600' : 'bg-green-600'} text-white px-2 py-1 rounded text-xs font-semibold pointer-events-none`}>
                          {isReplacement ? 'Replace?' : 'Preview'}
                        </div>
                      </>
                    )}
                  </div>
                ) : null;
              })()
            ) : (
              // Empty slot - show placeholder for drag and drop
              <div className={`w-full h-full flex items-center justify-center relative overflow-hidden border-2 ${
                isInlineEditing 
                  ? 'bg-yellow-50 border-yellow-400'
                  : isDraggingPhoto && previewSlotId === slot?.id
                  ? 'bg-green-50 border-green-400 border-dashed'
                  : isDraggingPhoto
                  ? 'bg-green-50 border-green-400 border-dashed'
                  : isPreviewMode
                  ? 'bg-gray-100 border-gray-300'
                  : 'bg-gray-200 border-gray-400 border-dashed'
              }`}>
                
                {/* Visible placeholder with drag and drop instruction */}
                <div className={`text-center pointer-events-none ${
                  isInlineEditing 
                    ? 'text-yellow-600 font-bold' 
                    : isDraggingPhoto
                    ? 'text-green-600 font-semibold'
                    : isPreviewMode
                    ? 'text-gray-500 font-medium'
                    : 'text-gray-500'
                }`}>
                  <div className="text-lg mb-1">
                    {isDraggingPhoto ? '📥' : '🗃️'}
                  </div>
                  <div className="text-xs font-medium">
                    {isInlineEditing 
                      ? 'Select Photo Below' 
                      : isDraggingPhoto
                      ? 'Drop here'
                      : 'Drag photo here'
                    }
                  </div>
                </div>
              </div>
            )}
            
            {/* All buttons removed - using pure direct manipulation */}

            {/* Remove confirmation dialog - keep overlay for this since it's temporary */}
            {slot && slot.photoId && slotShowingRemoveConfirmation?.id === slot.id && onConfirmRemove && onCancelRemove && (
              <div className="absolute inset-0 bg-black bg-opacity-60 flex flex-col items-center justify-center gap-4 z-60 p-4">
                <div className="text-white text-center">
                  <div className="font-semibold text-lg mb-2">Remove Photo?</div>
                  <div className="text-sm opacity-90">This will remove the photo from this slot</div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmRemove(slot);
                    }}
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 shadow-lg"
                  >
                    Yes, Remove
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelRemove();
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 shadow-lg"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      
      {/* PNG Template Overlay - Render LAST so it appears ON TOP of photos */}
      <img 
        src={pngUrl}
        alt={pngTemplate.name}
        className="absolute inset-0 w-full h-full z-10 pointer-events-none object-contain"
        onLoad={() => {}}
        onError={(e) => {
          console.error('❌ PNG failed to load:', pngTemplate.name, pngUrl);
          console.error('❌ Image error details:', e);
        }}
        style={{
          backgroundColor: !isActiveTemplate ? 'transparent' : undefined
        }}
      />
    </div>
  );
}