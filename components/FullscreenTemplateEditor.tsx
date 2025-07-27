import { useState, useRef, useEffect } from 'react';
import { TemplateSlot, Photo, PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform, createPhotoTransform } from '../types';
import PhotoRenderer from './PhotoRenderer';
import { getBestPhotoUrl, addCacheBuster, getHighResPhotoUrls } from '../utils/photoUrlUtils';
import { photoCacheService } from '../services/photoCacheService';

interface FullscreenTemplateEditorProps {
  templateSlots: TemplateSlot[];
  selectedSlot: TemplateSlot;
  selectedPhoto?: Photo | null;
  photos: Photo[];
  onApply: (slotId: string, photoId: string, transform?: PhotoTransform | ContainerTransform) => void;
  onClose: () => void;
  isVisible: boolean;
  // New props for multi-slot viewing mode
  viewMode?: 'single-slot' | 'multi-slot';
  templateToView?: { templateId: string; templateName: string; slots: TemplateSlot[] } | null;
  onSlotSelect?: (slot: TemplateSlot) => void;
  onRemovePhoto?: (slot: TemplateSlot) => void;
}

export default function FullscreenTemplateEditor({
  templateSlots,
  selectedSlot,
  selectedPhoto,
  photos,
  onApply,
  onClose,
  isVisible,
  viewMode = 'single-slot',
  templateToView,
  onSlotSelect,
  onRemovePhoto
}: FullscreenTemplateEditorProps) {
  const [templateBlobUrl, setTemplateBlobUrl] = useState<string | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [currentTransform, setCurrentTransform] = useState<PhotoTransform>(createPhotoTransform(1, 0.5, 0.5));
  const [currentPhotoId, setCurrentPhotoId] = useState<string | null>(null);
  const [photoKey, setPhotoKey] = useState<string>(''); // Force re-render key
  
  // Cleanup function for blob URLs
  const cleanupPhotoUrl = () => {
    if (selectedPhotoUrl && selectedPhotoUrl.startsWith('blob:')) {
      console.log('🧹 Cleaning up blob URL:', selectedPhotoUrl);
      URL.revokeObjectURL(selectedPhotoUrl);
    }
  };
  
  // State for multi-slot viewing mode
  const [originalTransforms, setOriginalTransforms] = useState<Record<string, PhotoTransform | ContainerTransform | undefined>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Initialize original transforms for multi-slot mode
  useEffect(() => {
    if (viewMode === 'multi-slot' && templateToView && isVisible) {
      const initialTransforms: Record<string, PhotoTransform | ContainerTransform | undefined> = {};
      templateToView.slots.forEach(slot => {
        initialTransforms[slot.id] = slot.transform;
      });
      setOriginalTransforms(initialTransforms);
      setHasUnsavedChanges(false);
      console.log('🔧 Multi-slot mode - Captured original transforms:', initialTransforms);
    }
  }, [viewMode, templateToView, isVisible]);

  // Handle transform changes from PhotoRenderer
  const handleTransformChange = (newTransform: PhotoTransform) => {
    setCurrentTransform(newTransform);
    
    // Check if this differs from original for unsaved changes detection
    if (viewMode === 'multi-slot' && selectedSlot) {
      const original = originalTransforms[selectedSlot.id];
      const isDifferent = !original || 
        (isPhotoTransform(original) && isPhotoTransform(newTransform) && 
         (original.photoScale !== newTransform.photoScale || 
          original.photoCenterX !== newTransform.photoCenterX || 
          original.photoCenterY !== newTransform.photoCenterY));
      
      if (isDifferent !== hasUnsavedChanges) {
        setHasUnsavedChanges(isDifferent);
      }
    }
    
    console.log('🔧 FullscreenTemplateEditor - Transform updated:', newTransform);
  };

  // Initialize transform when selectedSlot changes
  useEffect(() => {
    console.log('🔧 TRANSFORM DEBUG - useEffect triggered for slot change:', {
      slotId: selectedSlot?.id,
      hasExistingTransform: !!selectedSlot?.transform,
      existingTransform: selectedSlot?.transform
    });
    
    // Cleanup previous photo URL to prevent memory leaks
    cleanupPhotoUrl();
    
    // Force re-render with new key to clear any cached images
    setPhotoKey(`slot-${selectedSlot?.id}-${Date.now()}`);
    
    // If the slot already has a transform, use it; otherwise use default
    if (selectedSlot?.transform && isPhotoTransform(selectedSlot.transform)) {
      console.log('✅ TRANSFORM DEBUG - Using existing photo-centric transform');
      setCurrentTransform(selectedSlot.transform);
    } else if (selectedSlot?.transform && isContainerTransform(selectedSlot.transform)) {
      console.log('🔧 TRANSFORM DEBUG - Found legacy transform, using defaults for now');
      // Legacy transforms can't be easily converted without photo dimensions
      // Let PhotoRenderer handle it with backward compatibility
      setCurrentTransform(createPhotoTransform(1, 0.5, 0.5));
    } else {
      console.log('🔄 TRANSFORM DEBUG - No existing transform, using defaults');
      setCurrentTransform(createPhotoTransform(1, 0.5, 0.5));
    }
  }, [selectedSlot?.id, selectedPhotoUrl]);

  // Handle photo changes - preserve transform for same photo, reset for different photos
  useEffect(() => {
    const newPhotoId = selectedPhoto?.id || null;
    const slotPhotoId = selectedSlot?.photoId || null;
    
    console.log('🔧 TRANSFORM DEBUG - Photo change detected:', {
      newPhotoId,
      currentPhotoId,
      slotPhotoId,
      isReEditingSameSlotPhoto: newPhotoId === slotPhotoId,
      hasSlotTransform: !!selectedSlot?.transform
    });

    // If re-editing the same photo that's already in the slot, preserve its transform
    if (newPhotoId === slotPhotoId && selectedSlot?.transform && isPhotoTransform(selectedSlot.transform)) {
      console.log('✅ TRANSFORM DEBUG - Re-editing same photo, preserving transform');
      setCurrentTransform(selectedSlot.transform);
    }
    // If it's a different photo, reset to default
    else if (newPhotoId !== currentPhotoId && newPhotoId !== null) {
      console.log('🔄 TRANSFORM DEBUG - Different photo selected, resetting transform');
      setCurrentTransform(createPhotoTransform(1, 0.5, 0.5));
    }
    
    setCurrentPhotoId(newPhotoId);
  }, [selectedPhoto?.id, selectedSlot?.photoId, selectedSlot?.transform, currentPhotoId]);

  // Get PNG templates and find the one for this slot (with null checks)
  const pngTemplates = (window as any).pngTemplates || [];
  const templateId = selectedSlot?.templateId?.split('_')[0]; // Get base template ID
  const pngTemplate = selectedSlot ? pngTemplates.find((t: any) => {
    // First priority: exact template type match (this handles swapped templates correctly)
    const typeMatch = t.template_type === selectedSlot.templateType;
    
    // Second priority: exact ID match (for backward compatibility)
    const idMatch = t.id === templateId;
    
    // Third priority: template type matches legacy templateType property
    const legacyTypeMatch = t.templateType === selectedSlot.templateType;
    
    console.log('🔍 Template matching debug (prioritizing templateType):', { 
      templateId, 
      slotTemplateType: selectedSlot.templateType,
      pngTemplateId: t.id, 
      pngTemplateType: t.template_type,
      pngTemplateLegacyType: t.templateType,
      pngTemplateName: t.name,
      typeMatch,
      idMatch,
      legacyTypeMatch,
      finalMatch: typeMatch || legacyTypeMatch || idMatch
    });
    
    // Prioritize template type matches (handles swapped templates correctly)
    return typeMatch || legacyTypeMatch || idMatch;
  }) : null;

  // Debug: log what template was matched
  console.log('🎯 Final template match result:', {
    selectedSlotType: selectedSlot?.templateType,
    matchedTemplate: pngTemplate ? {
      id: pngTemplate.id,
      name: pngTemplate.name,
      type: pngTemplate.template_type
    } : 'NO MATCH FOUND'
  });

  // Get all slots for this template
  const thisTemplateSlots = selectedSlot ? templateSlots.filter(slot => 
    slot.templateId === selectedSlot.templateId
  ) : [];

  // Download PNG template as blob
  useEffect(() => {
    if (pngTemplate && isVisible) {
      const downloadTemplate = async () => {
        try {
          const { googleDriveService } = await import('../services/googleDriveService');
          const fileId = pngTemplate.driveFileId || pngTemplate.id;
          const blob = await googleDriveService.downloadTemplate(fileId);
          const url = URL.createObjectURL(blob);
          setTemplateBlobUrl(url);
        } catch (error) {
          console.error('Failed to download template for fullscreen editor:', error);
        }
      };
      downloadTemplate();
    }

    return () => {
      if (templateBlobUrl) {
        URL.revokeObjectURL(templateBlobUrl);
      }
    };
  }, [pngTemplate, isVisible]);

  // Load selected photo URL with instant display and cache optimization
  useEffect(() => {
    if (selectedPhoto && isVisible) {
      // Set immediate URL for instant display (no loading state)
      const immediateUrl = photoCacheService.getImmediateUrl(selectedPhoto);
      setSelectedPhotoUrl(immediateUrl);
      
      console.log('🚀 Instant display with immediate URL for', selectedPhoto.name);
      
      // Load high-quality blob in background and update when ready
      const loadOptimalPhoto = async () => {
        try {
          console.log('🔄 Loading optimal blob for template editor...');
          const blobUrl = await photoCacheService.getBlobUrl(selectedPhoto);
          
          // Only update if this is still the current photo
          if (selectedPhoto && isVisible) {
            setSelectedPhotoUrl(blobUrl);
            console.log('✅ Upgraded to optimal blob URL for', selectedPhoto.name);
          }
        } catch (error) {
          console.error('❌ Failed to load optimal photo:', error);
          // Keep the immediate URL that's already displayed
        }
      };
      
      // Start loading optimal version (don't await to avoid blocking)
      loadOptimalPhoto();
    } else {
      setSelectedPhotoUrl(null);
    }
    
    // Update photo key for forcing re-render
    setPhotoKey(`photo-${selectedPhoto?.id}-${Date.now()}`);
  }, [selectedPhoto?.id, isVisible]);

  // Debug photos array and templateSlots
  console.log('🔍 FullscreenTemplateEditor state:', {
    isVisible,
    selectedSlot: selectedSlot?.id,
    selectedPhoto: selectedPhoto?.id,
    photosCount: photos.length,
    templateSlotsCount: templateSlots.length,
    templateSlots: templateSlots.map(s => ({ id: s.id, photoId: s.photoId }))
  });

  // New handlers for multi-slot mode
  const handleApplyAll = () => {
    if (viewMode === 'multi-slot' && selectedSlot && selectedPhoto) {
      // Apply the current photo and transform to the selected slot
      onApply(selectedSlot.id, selectedPhoto.id, currentTransform);
      
      // Update original transforms to current state (no longer has unsaved changes)
      setOriginalTransforms(prev => ({
        ...prev,
        [selectedSlot.id]: currentTransform
      }));
      setHasUnsavedChanges(false);
    } else if (selectedSlot && selectedPhoto) {
      // Standard single-slot apply
      onApply(selectedSlot.id, selectedPhoto.id, currentTransform);
    }
  };

  const handleCancel = () => {
    if (viewMode === 'multi-slot' && selectedSlot) {
      // Revert to original transform
      const original = originalTransforms[selectedSlot.id];
      if (original && isPhotoTransform(original)) {
        setCurrentTransform(original);
        setHasUnsavedChanges(false);
      }
    }
  };

  const handleRemove = () => {
    if (viewMode === 'multi-slot' && selectedSlot && onRemovePhoto) {
      if (window.confirm('Remove this photo from the template?')) {
        onRemovePhoto(selectedSlot);
        setHasUnsavedChanges(false);
      }
    }
  };

  const handleSlotClick = (slot: TemplateSlot) => {
    if (viewMode === 'multi-slot' && onSlotSelect) {
      onSlotSelect(slot);
    }
  };

  // Early return after all hooks
  if (!isVisible || !selectedSlot) return null;

  const handleApply = () => {
    try {
      // Validate required props
      if (!selectedSlot?.id || !selectedPhoto?.id) {
        console.error('🚨 TRANSFORM FALLBACK - Missing required IDs:', { slotId: selectedSlot?.id, photoId: selectedPhoto?.id });
        return;
      }

      console.log('🔧 FullscreenTemplateEditor - Saving photo-centric transform:', {
        transform: currentTransform,
        photoId: selectedPhoto.id,
        slotId: selectedSlot.id
      });
      
      // Simply save the current photo-centric transform
      onApply(selectedSlot.id, selectedPhoto.id, currentTransform);
    } catch (error) {
      console.error('🚨 TRANSFORM FALLBACK - Error in handleApply:', error);
      // Fallback to basic photo-centric transform - only if we have valid IDs
      if (selectedSlot?.id && selectedPhoto?.id) {
        onApply(selectedSlot.id, selectedPhoto.id, createPhotoTransform(1, 0.5, 0.5));
      }
    }
  };


  const getPhotoUrl = (photoId?: string | null) => {
    if (!photoId) return null;
    const photo = photos.find((p: any) => p.id === photoId);
    console.log('🔍 getPhotoUrl debug:', { photoId, photo, photoUrl: photo?.url });
    return photo?.url || null;
  };


  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        FullscreenTemplateEditor.tsx
      </div>

      {/* Header - Top-Bottom Split Layout */}
      <div className="p-4 text-white">
        {/* Top Row: Title and Close */}
        <div className="flex items-center justify-between mb-2">
          <div className="text-center flex-1">
            <h3 className="font-medium">
              {viewMode === 'multi-slot' && templateToView 
                ? templateToView.templateName 
                : selectedSlot.templateName}
            </h3>
            <p className="text-sm text-gray-300">
              {viewMode === 'multi-slot' 
                ? `Slot ${selectedSlot.slotIndex + 1} of ${templateSlots.length}` 
                : `Editing Slot ${selectedSlot.slotIndex + 1}`}
            </p>
          </div>
          
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-300 bg-black bg-opacity-30 rounded-full p-2"
            title="Close"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Action Buttons Row */}
        <div className="flex justify-center space-x-3">
          {viewMode === 'multi-slot' ? (
            // Multi-slot mode buttons
            <>
              <button
                onClick={handleApplyAll}
                disabled={!selectedPhoto}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed"
              >
                Apply
              </button>
              
              {hasUnsavedChanges && (
                <button
                  onClick={handleCancel}
                  className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700"
                >
                  Cancel
                </button>
              )}
              
              {selectedSlot.photoId && (
                <button
                  onClick={handleRemove}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700"
                >
                  Remove
                </button>
              )}
            </>
          ) : (
            // Single-slot mode button (original)
            <button
              onClick={handleApply}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              Apply Photo
            </button>
          )}
        </div>
      </div>

      {/* Full Template Display */}
      <div className="flex-1 flex items-center justify-center p-2 min-h-0">
        {!pngTemplate ? (
          <div className="text-white text-center">
            <div className="text-4xl mb-4">❌</div>
            <p className="text-red-400 font-medium">No matching PNG template found</p>
            <p className="text-gray-400 text-sm mt-2">
              Looking for: {selectedSlot?.templateType} template with ID: {selectedSlot?.templateId?.split('_')[0]}
            </p>
            <p className="text-gray-400 text-xs mt-1">Available templates: {pngTemplates.length}</p>
          </div>
        ) : !templateBlobUrl ? (
          <div className="text-white text-center">
            <div className="text-4xl mb-4">📐</div>
            <p>Loading template...</p>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative" 
                 style={{ 
                   aspectRatio: `${pngTemplate.dimensions.width}/${pngTemplate.dimensions.height}`,
                   maxWidth: 'min(800px, 90vw)',
                   maxHeight: '85vh',
                   width: 'auto',
                   height: 'auto'
                 }}>
              {/* Full PNG Template Background */}
              <img 
                src={templateBlobUrl}
                alt={pngTemplate.name}
                className="w-full h-full"
              />
            
            {/* Photo Holes Overlay */}
            {pngTemplate.holes.map((hole: any, holeIndex: number) => {
              const slot = thisTemplateSlots[holeIndex];
              if (!slot) return null;
              
              const photoUrl = getPhotoUrl(slot.photoId);
              const isEditingSlot = slot.id === selectedSlot.id;
              
              // Debug slot state
              console.log(`🔍 Slot ${holeIndex + 1} debug:`, {
                slotId: slot.id,
                photoId: slot.photoId,
                isEditingSlot,
                photoUrl,
                hasPhotoInArray: !!photos.find(p => p.id === slot.photoId)
              });
              
              // Debug the first hole only
              if (holeIndex === 0) {
                console.log('🔍 HOLE vs TEMPLATE DIMENSIONS:', {
                  templateDimensions: pngTemplate.dimensions,
                  hole: { x: hole.x, y: hole.y, width: hole.width, height: hole.height },
                  holeAspectRatio: (hole.width / hole.height).toFixed(3),
                  templateAspectRatio: (pngTemplate.dimensions.width / pngTemplate.dimensions.height).toFixed(3),
                  percentages: {
                    left: ((hole.x / pngTemplate.dimensions.width) * 100).toFixed(1) + '%',
                    top: ((hole.y / pngTemplate.dimensions.height) * 100).toFixed(1) + '%',
                    width: ((hole.width / pngTemplate.dimensions.width) * 100).toFixed(1) + '%',
                    height: ((hole.height / pngTemplate.dimensions.height) * 100).toFixed(1) + '%'
                  }
                });
              }
              
              return (
                <div
                  key={hole.id}
                  className={`absolute transition-all duration-200 overflow-hidden ${
                    isEditingSlot ? 'ring-4 ring-yellow-400' : 
                    viewMode === 'multi-slot' ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : ''
                  }`}
                  style={{
                    left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
                    top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
                    width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
                    height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`,
                  }}
                  onClick={() => viewMode === 'multi-slot' && !isEditingSlot ? handleSlotClick(slot) : undefined}
                >
                  {isEditingSlot ? (
                    // Editing slot - interactive PhotoRenderer
                    selectedPhotoUrl ? (
                      <PhotoRenderer
                        key={photoKey} // Force re-render when photo or slot changes
                        photoUrl={selectedPhotoUrl}
                        photoAlt={selectedPhoto?.name || 'Selected photo'}
                        transform={currentTransform}
                        interactive={true}
                        onTransformChange={handleTransformChange}
                        className="w-full h-full"
                        debug={false} // Disable visual overlay but keep console logging
                        fallbackUrls={selectedPhoto ? getHighResPhotoUrls(selectedPhoto) : []}
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 border border-gray-300 border-dashed flex items-center justify-center">
                        <span className="text-gray-500 text-xs">Loading...</span>
                      </div>
                    )
                  ) : (
                    // Other slots - non-interactive PhotoRenderer for consistency
                    slot.photoId ? (
                      <PhotoRenderer
                        key={`slot-${slot.id}-${slot.photoId}`} // Unique key for each slot-photo combo
                        photoUrl={photoCacheService.getImmediateUrl(photos.find(p => p.id === slot.photoId) || { url: '', thumbnailUrl: '', googleDriveId: '' } as Photo)}
                        fallbackUrls={getHighResPhotoUrls(photos.find(p => p.id === slot.photoId) || { url: '', thumbnailUrl: '', googleDriveId: '' } as Photo)}
                        photoAlt={`Photo ${holeIndex + 1}`}
                        transform={slot.transform}
                        interactive={false}
                        className="w-full h-full"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 border border-gray-300 border-dashed flex items-center justify-center">
                        <span className="text-gray-500 text-xs">Empty</span>
                      </div>
                    )
                  )}
                </div>
              );
            })}
            </div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 border-t border-gray-800">
        <div className="text-center text-gray-400 text-sm">
          <p className="font-medium text-yellow-400">📝 {selectedPhoto?.name || 'No photo selected'}</p>
          <p>Pinch to zoom • Drag to position • Yellow border shows your editing area</p>
        </div>
      </div>
    </div>
  );
}