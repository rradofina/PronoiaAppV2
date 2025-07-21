import { useState, useRef, useEffect } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { TemplateSlot, Photo } from '../types';

interface FullscreenTemplateEditorProps {
  templateSlots: TemplateSlot[];
  selectedSlot: TemplateSlot;
  selectedPhoto: Photo;
  photos: Photo[];
  onApply: (slotId: string, photoId: string, transform?: { scale: number; x: number; y: number }) => void;
  onClose: () => void;
  isVisible: boolean;
}

export default function FullscreenTemplateEditor({
  templateSlots,
  selectedSlot,
  selectedPhoto,
  photos,
  onApply,
  onClose,
  isVisible
}: FullscreenTemplateEditorProps) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [templateBlobUrl, setTemplateBlobUrl] = useState<string | null>(null);
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const transformRef = useRef<any>();

  // Get PNG templates and find the one for this slot (with null checks)
  const pngTemplates = (window as any).pngTemplates || [];
  const templateId = selectedSlot?.templateId?.split('_')[0]; // Get base template ID
  const pngTemplate = selectedSlot ? pngTemplates.find((t: any) => 
    t.id === templateId || 
    t.templateType === selectedSlot.templateType
  ) : null;

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

  // Load selected photo URL - use blob to avoid CORS issues
  useEffect(() => {
    if (selectedPhoto && isVisible) {
      const loadPhoto = async () => {
        try {
          const { googleDriveService } = await import('../services/googleDriveService');
          const photoId = selectedPhoto.googleDriveId || selectedPhoto.id;
          const blob = await googleDriveService.downloadPhoto(photoId);
          const url = URL.createObjectURL(blob);
          setSelectedPhotoUrl(url);
        } catch (error) {
          console.error('Failed to download selected photo:', error);
          // Fallback to original URL
          setSelectedPhotoUrl(selectedPhoto.url);
        }
      };
      loadPhoto();
    }

    return () => {
      if (selectedPhotoUrl && selectedPhotoUrl.startsWith('blob:')) {
        URL.revokeObjectURL(selectedPhotoUrl);
      }
    };
  }, [selectedPhoto, isVisible]);

  // Debug photos array and templateSlots
  console.log('🔍 FullscreenTemplateEditor state:', {
    isVisible,
    selectedSlot: selectedSlot?.id,
    selectedPhoto: selectedPhoto?.id,
    photosCount: photos.length,
    templateSlotsCount: templateSlots.length,
    templateSlots: templateSlots.map(s => ({ id: s.id, photoId: s.photoId }))
  });

  // Early return after all hooks
  if (!isVisible || !selectedSlot) return null;

  const handleApply = () => {
    onApply(selectedSlot.id, selectedPhoto.id, transform);
  };

  const handleTransformChange = (ref: any, state: any) => {
    setTransform({
      scale: state.scale,
      x: state.positionX,
      y: state.positionY
    });
  };

  const getPhotoUrl = (photoId?: string | null) => {
    if (!photoId) return null;
    const photo = photos.find((p: any) => p.id === photoId);
    console.log('🔍 getPhotoUrl debug:', { photoId, photo, photoUrl: photo?.url });
    return photo?.url || null;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <button
          onClick={onClose}
          className="flex items-center space-x-2 text-white hover:text-gray-300"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Close</span>
        </button>
        
        <div className="text-center">
          <h3 className="font-medium">{selectedSlot.templateName}</h3>
          <p className="text-sm text-gray-300">Editing Slot {selectedSlot.slotIndex + 1}</p>
        </div>
        
        <button
          onClick={handleApply}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
        >
          Apply Photo
        </button>
      </div>

      {/* Full Template Display */}
      <div className="flex-1 flex items-center justify-center p-2">
        {!templateBlobUrl || !pngTemplate ? (
          <div className="text-white text-center">
            <div className="text-4xl mb-4">📐</div>
            <p>Loading template...</p>
          </div>
        ) : (
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative" 
                 style={{ 
                   aspectRatio: `${pngTemplate.dimensions.width}/${pngTemplate.dimensions.height}`,
                   width: '800px',
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
                    isEditingSlot ? 'ring-4 ring-yellow-400' : ''
                  }`}
                  style={{
                    left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
                    top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
                    width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
                    height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`,
                    // backgroundColor: isEditingSlot ? 'rgba(255, 0, 0, 0.2)' : 'rgba(0, 255, 0, 0.1)', // Debug colors removed
                  }}
                >
                  {isEditingSlot ? (
                    // Editing slot - fills the exact hole area
                    selectedPhotoUrl ? (
                      <TransformWrapper
                        ref={transformRef}
                        initialScale={0.5}
                        minScale={0.1}
                        maxScale={10}
                        centerOnInit={true}
                        limitToBounds={false}
                        wheel={{ step: 0.1 }}
                        doubleClick={{ disabled: false, step: 0.5 }}
                        onTransformed={handleTransformChange}
                      >
                        <TransformComponent>
                          <img
                            src={selectedPhotoUrl}
                            alt={selectedPhoto.name}
                            style={{ 
                              maxWidth: 'none',
                              maxHeight: 'none', 
                              width: 'auto',
                              height: 'auto',
                              display: 'block',
                              // border: '2px solid magenta' // Debug border removed
                            }}
                          />
                        </TransformComponent>
                      </TransformWrapper>
                    ) : (
                      <div className="w-full h-full bg-gray-200 border border-gray-300 border-dashed flex items-center justify-center">
                        <span className="text-gray-500 text-xs">Loading...</span>
                      </div>
                    )
                  ) : (
                    // Other slots - show existing photos or placeholder
                    slot.photoId ? (
                      <img
                        src={photos.find(p => p.id === slot.photoId)?.url || ''}
                        alt={`Photo ${holeIndex + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          console.log('❌ Image failed to load:', { 
                            slotId: slot.id, 
                            photoId: slot.photoId, 
                            photoUrl,
                            originalUrl: photos.find(p => p.id === slot.photoId)?.url,
                            errorTarget: e.currentTarget.src
                          });
                        }}
                        onLoad={() => {
                          console.log('✅ Image loaded successfully:', {
                            slotId: slot.id,
                            photoId: slot.photoId,
                            url: photos.find(p => p.id === slot.photoId)?.url
                          });
                        }}
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
          <p className="font-medium text-yellow-400">📝 {selectedPhoto.name}</p>
          <p>Pinch to zoom • Drag to position • Yellow border shows your editing area</p>
        </div>
      </div>
    </div>
  );
}