import React from 'react';
import { TemplateSlot, Photo, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform } from '../types';
import { PngTemplate } from '../services/pngTemplateService';
import PhotoRenderer from './PhotoRenderer';
import InlinePhotoEditor from './InlinePhotoEditor';
import { getHighResPhotoUrls } from '../utils/photoUrlUtils';

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
  holePhotoAssignments = []
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
  const expectedAspectRatio = 2/3; // 1200/1800 for 4R
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
    correctDimensions: { width: 1200, height: 1800 },
    
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
      `Change stored dimensions from ${pngTemplate.dimensions.width}×${pngTemplate.dimensions.height} to 1200×1800` :
      'No fix needed',
    
    slotsConnected: thisTemplateSlots.length,
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
        
        return (
          <div
            key={hole.id}
            className={`absolute transition-all duration-200 overflow-hidden ${
              isInlineEditing 
                ? 'border-4 border-blue-400 shadow-lg shadow-blue-400/50 z-50 ring-2 ring-blue-300' // Enhanced highlighting for inline editing (changed to blue)
                : isSelected 
                ? 'border-4 border-blue-500 border-opacity-90 z-40 cursor-pointer shadow-md' // Above overlay (z-30)
                : shouldApplyDarkening
                ? 'pointer-events-none cursor-not-allowed' // Block interaction during editing (but keep photos fully visible)
                : isPreviewMode
                ? '' // No effects for preview mode - clean display
                : 'hover:border-2 hover:border-blue-300 hover:border-opacity-60 cursor-pointer'
            }`}
            style={{
              left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
              top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
              width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
              height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`,
            }}
            onClick={() => slot && !shouldBlockSlot && !isPreviewMode && onSlotClick(slot)}
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
                : "Click to select slot"
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
                <InlinePhotoEditor
                  slot={slot}
                  photo={inlineEditingPhoto}
                  photos={photos}
                  onApply={onInlineApply}
                  onCancel={onInlineCancel}
                  className="w-full h-full"
                />
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
                <PhotoRenderer
                  photoUrl={photoUrl}
                  photoAlt={`Photo ${holeIndex + 1}`}
                  transform={slot?.transform}
                  interactive={false}
                  previewMode={isPreviewMode}
                  className="w-full h-full"
                  fallbackUrls={slot && photos.find(p => p.id === slot.photoId) ? getHighResPhotoUrls(photos.find(p => p.id === slot.photoId)!) : []}
                />
              </>
            ) : (
              // Empty slot - show placeholder with enhanced highlighting when selected
              <div className={`w-full h-full flex items-center justify-center relative overflow-hidden border-2 border-solid ${
                isInlineEditing 
                  ? 'bg-yellow-50 border-yellow-400 animate-pulse shadow-lg shadow-yellow-400/30' // Enhanced highlighting for inline editing
                  : isSelected 
                  ? 'bg-blue-50 border-blue-400' 
                  : isPreviewMode
                  ? 'bg-blue-50 border-blue-500' // Visible preview placeholder
                  : shouldApplyDarkening
                  ? 'bg-gray-100 border-gray-300' // Dimmed background during editing
                  : 'bg-gray-200 border-gray-400'
              }`}>
                {/* Visible placeholder with debug info */}
                <div className={`text-center ${
                  isInlineEditing 
                    ? 'text-yellow-600 font-bold' 
                    : isSelected 
                    ? 'text-blue-600 font-semibold' 
                    : isPreviewMode
                    ? 'text-blue-600 font-medium' // Visible preview text
                    : shouldApplyDarkening
                    ? 'text-gray-400' // Grayed out during editing
                    : 'text-gray-500'
                }`}>
                  <div className="text-sm mb-1">
                    {isPreviewMode ? `H${holeIndex + 1}` : (shouldBlockSlot ? '·' : '+')}
                  </div>
                  <div className="text-xs font-medium">
                    {isPreviewMode 
                      ? `${Math.round(hole.width)}×${Math.round(hole.height)}`
                      : isInlineEditing 
                      ? 'Select Photo Below' 
                      : 'Tap to Add'
                    }
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