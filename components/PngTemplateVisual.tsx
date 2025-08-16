import React, { useEffect, useRef } from 'react';
import { TemplateSlot, Photo, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform } from '../types';
import { PngTemplate } from '../services/pngTemplateService';
import PhotoRenderer from './PhotoRenderer';
import InlinePhotoEditor from './InlinePhotoEditor';
import { getHighResPhotoUrls } from '../utils/photoUrlUtils';
import { getPrintSizeDimensions } from '../utils/printSizeDimensions';
import { createPhotoTransform } from '../utils/transformUtils';

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
  
  console.log('🖼️ PngTemplateVisual ASPECT RATIO DEBUG:', {
    templateName: pngTemplate.name,
    templateType: pngTemplate.templateType,
    
    // Dimensions
    storedDimensions: pngTemplate.dimensions,
    correctDimensions: expectedDimensions,
    
    // Aspect Ratios
    storedAspectRatio: actualAspectRatio.toFixed(3),
    correctAspectRatio: expectedAspectRatio.toFixed(3),
    aspectRatioMatch,
    
    // Container Behavior
    containerWiderThanPNG,
    objectContainBehavior,
    
    // Diagnosis
    diagnosis: !aspectRatioMatch ? 
      `🚨 PROBLEM: Container aspect ratio ${actualAspectRatio.toFixed(3)} ≠ PNG aspect ratio. ${objectContainBehavior}` :
      '✅ Container and PNG aspect ratios match perfectly',
    
    // Fix needed
    fixNeeded: !aspectRatioMatch ? 
      `Change stored dimensions from ${pngTemplate.dimensions.width}×${pngTemplate.dimensions.height} to ${expectedDimensions.width}×${expectedDimensions.height}` :
      'No fix needed',
    
    slotsConnected: thisTemplateSlots.length,
    holesCount: pngTemplate.holes?.length
  });

  return (
    <div 
      className="relative w-full h-full overflow-visible"
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
        className={`absolute inset-0 w-full h-full ${isActiveTemplate ? 'object-contain' : 'object-cover'}`}
        onLoad={() => console.log('✅ PNG loaded successfully:', pngTemplate.name, pngUrl)}
        onError={(e) => {
          console.error('❌ PNG failed to load:', pngTemplate.name, pngUrl);
          console.error('❌ Image error details:', e);
        }}
        style={{
          backgroundColor: !isActiveTemplate ? 'transparent' : undefined
        }}
      />
      
      {/* Template background darkening overlay during editing */}
      {isEditingMode && (
        <div className="absolute inset-0 bg-black bg-opacity-50 pointer-events-none transition-opacity duration-200" />
      )}
      
      {/* Photo Holes Overlay */}
      {pngTemplate.holes.map((hole, holeIndex) => {
        const slot = thisTemplateSlots[holeIndex];
        
        // Debug hole information using template dimensions
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
        
        // Always show holes, even without slots (for debugging/preview)
        const photoUrl = slot ? getPhotoUrl(slot.photoId) : null;
        const isSelected = slot && selectedSlot?.id === slot.id;
        const isInlineEditing = slot && inlineEditingSlot?.id === slot.id;
        const hasInlinePhoto = isInlineEditing && inlineEditingPhoto;
        
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
          if (onSetPreviewSlot) {
            onSetPreviewSlot(slot.id);
          }
        };
        
        // Handle drag leave - clear preview
        const handleDragLeave = (e: React.DragEvent) => {
          if (!slot || shouldBlockSlot || isPreviewMode) return;
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
          if (!slot || shouldBlockSlot || isPreviewMode) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = slot.photoId ? 'move' : 'copy';
        };
        
        // Handle drop
        const handleDrop = (e: React.DragEvent) => {
          if (!slot || shouldBlockSlot || isPreviewMode) return;
          e.preventDefault();
          
          // Clear preview first
          if (onSetPreviewSlot) {
            onSetPreviewSlot(null);
          }
          
          const photoId = e.dataTransfer.getData('photoId');
          console.log('📍 PngTemplateVisual handleDrop:', {
            slotId: slot?.id,
            currentPhotoId: slot?.photoId,
            droppedPhotoId: photoId,
            hasOnDropPhoto: !!onDropPhoto
          });
          
          if (photoId && onDropPhoto) {
            onDropPhoto(slot, photoId);
            console.log('🎯 Dropped photo on slot:', { 
              slotId: slot.id, 
              photoId,
              isReplacement: !!slot.photoId 
            });
          }
        };
        
        return (
          <div
            ref={slotRef}
            key={hole.id}
            className={`absolute transition-all duration-200 ${
              isInlineEditing 
                ? 'z-50'
                : isSelected 
                ? 'border-4 border-blue-500 border-opacity-90 z-40'
                : shouldApplyDarkening
                ? 'pointer-events-none cursor-not-allowed'
                : isPreviewMode
                ? ''
                : isDraggingPhoto && slot?.photoId && previewSlotId === slot?.id
                ? 'border-2 border-orange-400 border-dashed animate-pulse'
                : isDraggingPhoto && !slot?.photoId
                ? 'border-2 border-green-400 border-dashed animate-pulse'
                : slot?.photoId
                ? 'hover:border-2 hover:border-blue-300 hover:border-opacity-60 cursor-pointer'
                : ''
            }`}
            style={{
              left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
              top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
              width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
              height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`,
            }}
            onClick={() => slot && !shouldBlockSlot && !isPreviewMode && slot.photoId && onSlotClick(slot)}
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
                : shouldBlockSlot 
                ? "Editing in progress - complete current edit first" 
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
            ) : hasInlinePhoto && onInlineApply && onInlineCancel ? (
              // Inline editing mode - show InlinePhotoEditor
              <>
                {console.log('🔧 PngTemplateVisual - Rendering InlinePhotoEditor:', {
                  slotId: slot.id,
                  photoName: inlineEditingPhoto.name,
                  hasOnInlineApply: !!onInlineApply,
                  hasOnInlineCancel: !!onInlineCancel
                })}
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
            ) : photoUrl ? (
              // Normal mode - show photo with high-resolution fallbacks
              <>
                {console.log(`📸 RENDERING PHOTO in hole ${holeIndex + 1}:`, {
                  photoUrl: photoUrl.substring(0, 60) + '...',
                  slotId: slot?.id,
                  holeSize: { width: hole.width, height: hole.height },
                  holePosition: { x: hole.x, y: hole.y }
                })}
                <div className={`w-full h-full overflow-hidden transition-opacity duration-200 ${
                  isDraggingPhoto ? 'opacity-30' : ''
                }`}>
                  <PhotoRenderer
                    photoUrl={photoUrl}
                    photoAlt={`Photo ${holeIndex + 1}`}
                    transform={slot?.transform}
                    interactive={false}
                    previewMode={isPreviewMode}
                    className="w-full h-full"
                    fallbackUrls={slot && photos.find(p => p.id === slot.photoId) ? getHighResPhotoUrls(photos.find(p => p.id === slot.photoId)!) : []}
                  />
                </div>
                
                {/* Darkening overlay for non-selected slots during editing */}
                {shouldApplyDarkening && (
                  <div className="absolute inset-0 bg-black bg-opacity-60 transition-opacity duration-200 pointer-events-none" />
                )}
              </>
            ) : slot && previewSlotId === slot.id && previewPhotoId ? (
              // Preview mode - show preview photo while dragging
              (() => {
                const previewPhoto = photos.find(p => p.id === previewPhotoId);
                const previewUrl = previewPhoto ? (previewPhoto.thumbnailUrl || previewPhoto.url) : null;
                const isReplacement = !!slot.photoId;
                return previewUrl ? (
                  <div className="w-full h-full overflow-hidden relative">
                    {/* Show existing photo with overlay if replacing */}
                    {isReplacement && photoUrl && (
                      <div className="absolute inset-0 opacity-30">
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
                      className={`w-full h-full ${isReplacement ? 'opacity-80' : 'opacity-70'}`}
                      fallbackUrls={previewPhoto ? getHighResPhotoUrls(previewPhoto) : []}
                    />
                    <div className={`absolute inset-0 border-4 ${isReplacement ? 'border-orange-400' : 'border-green-400'} border-dashed animate-pulse pointer-events-none`} />
                    <div className={`absolute top-2 left-2 ${isReplacement ? 'bg-orange-600' : 'bg-green-600'} text-white px-2 py-1 rounded text-xs font-semibold pointer-events-none`}>
                      {isReplacement ? 'Replace?' : 'Preview'}
                    </div>
                  </div>
                ) : null;
              })()
            ) : (
              // Empty slot - show placeholder for drag and drop
              <div className={`w-full h-full flex items-center justify-center relative overflow-hidden border-2 ${
                isInlineEditing 
                  ? 'bg-yellow-50 border-yellow-400 animate-pulse shadow-lg shadow-yellow-400/30'
                  : isDraggingPhoto && !shouldBlockSlot && previewSlotId === slot?.id
                  ? 'bg-green-50 border-green-400 border-dashed animate-pulse'
                  : isDraggingPhoto && !shouldBlockSlot
                  ? 'bg-green-50 border-green-400 border-dashed'
                  : isPreviewMode
                  ? 'bg-gray-100 border-gray-300'
                  : shouldApplyDarkening
                  ? 'bg-gray-500 border-gray-600'
                  : 'bg-gray-200 border-gray-400 border-dashed'
              }`}>
                
                {/* Additional darkening overlay for empty slots during editing */}
                {shouldApplyDarkening && (
                  <div className="absolute inset-0 bg-black bg-opacity-40 transition-opacity duration-200 pointer-events-none" />
                )}
                {/* Visible placeholder with drag and drop instruction */}
                <div className={`text-center pointer-events-none ${
                  isInlineEditing 
                    ? 'text-yellow-600 font-bold' 
                    : isDraggingPhoto && !shouldBlockSlot
                    ? 'text-green-600 font-semibold'
                    : isPreviewMode
                    ? 'text-gray-500 font-medium'
                    : shouldApplyDarkening
                    ? 'text-gray-400'
                    : 'text-gray-500'
                }`}>
                  <div className="text-lg mb-1">
                    {isDraggingPhoto && !shouldBlockSlot ? '📥' : shouldBlockSlot ? '·' : '🗃️'}
                  </div>
                  <div className="text-xs font-medium">
                    {isInlineEditing 
                      ? 'Select Photo Below' 
                      : isDraggingPhoto && !shouldBlockSlot
                      ? 'Drop here'
                      : 'Drag photo here'
                    }
                  </div>
                </div>
              </div>
            )}
            
            {/* Edit, Change and Remove buttons positioned INSIDE placeholder (top-right) */}
            {slot && slot.photoId && slotShowingEditButton?.id === slot.id && onEditButtonClick && onRemoveButtonClick && (
              <div className="absolute top-2 right-2 flex gap-1 z-70">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditButtonClick(slot);
                  }}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700 shadow-lg transition-all duration-200"
                  title="Crop and zoom photo"
                >
                  Crop & Zoom
                </button>
                {onChangeButtonClick && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onChangeButtonClick(slot);
                    }}
                    className="px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 shadow-lg transition-all duration-200"
                    title="Change photo"
                  >
                    Change Photo
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveButtonClick(slot);
                  }}
                  className="px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 shadow-lg transition-all duration-200"
                  title="Remove photo"
                >
                  Remove Photo
                </button>
              </div>
            )}

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
                    className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 shadow-lg transition-all duration-200"
                  >
                    Yes, Remove
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCancelRemove();
                    }}
                    className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 shadow-lg transition-all duration-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}