import { useState, useRef } from 'react';
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
  TemplateVisual: React.FC<any>;
}

export default function FullscreenTemplateEditor({
  templateSlots,
  selectedSlot,
  selectedPhoto,
  photos,
  onApply,
  onClose,
  isVisible,
  TemplateVisual
}: FullscreenTemplateEditorProps) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const [mainPhotoLoading, setMainPhotoLoading] = useState(true);
  const [mainPhotoError, setMainPhotoError] = useState(false);
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('');
  const transformRef = useRef<any>();

  if (!isVisible) return null;

  // Generate fallback URLs for main photo
  const getMainPhotoUrl = () => {
    const urls = [];
    
    if (selectedPhoto.thumbnailUrl) {
      urls.push(selectedPhoto.thumbnailUrl.replace('=s220', '=s1200')); // High res first
      urls.push(selectedPhoto.thumbnailUrl.replace('=s220', '=s800'));  // Medium res
      urls.push(selectedPhoto.thumbnailUrl.replace('=s220', '=s600'));  // Lower res
      urls.push(selectedPhoto.thumbnailUrl); // Original thumbnail
    }
    
    if (selectedPhoto.url) {
      urls.push(selectedPhoto.url); // Original URL
    }
    
    // Try direct Google Drive link
    if (selectedPhoto.googleDriveId) {
      urls.push(`https://drive.google.com/uc?id=${selectedPhoto.googleDriveId}&export=view`);
    }
    
    return urls;
  };

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

  // Create a temporary slot array with the photo assigned
  const tempSlots = templateSlots.map(slot => 
    slot.id === selectedSlot.id 
      ? { ...slot, photoId: selectedPhoto.id }
      : slot
  );

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
          <span>Cancel</span>
        </button>
        
        <div className="text-center">
          <h3 className="font-medium">{selectedSlot.templateName}</h3>
          <p className="text-sm text-gray-300">Slot {selectedSlot.slotIndex + 1}</p>
        </div>
        
        <button
          onClick={handleApply}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
        >
          Apply
        </button>
      </div>

      {/* Photo Info */}
      <div className="px-4 pb-4 border-b border-gray-800">
        <div className="text-white text-center">
          <p className="font-medium text-sm">{selectedPhoto.name}</p>
          <p className="text-xs text-gray-400">Pinch to zoom, drag to position</p>
        </div>
      </div>

      {/* Photo Editor with Pinch/Zoom */}
      <div className="flex-1 flex flex-col">
        {/* Template Preview (Small) */}
        <div className="px-4 py-2 bg-gray-900">
          <p className="text-gray-400 text-xs mb-2 text-center">Template Preview:</p>
          <div className="w-24 mx-auto" style={{ aspectRatio: '2/3' }}>
            <TemplateVisual
              template={{ 
                id: selectedSlot.templateType, 
                name: selectedSlot.templateName, 
                slots: templateSlots.filter(s => s.templateId === selectedSlot.templateId).length 
              }}
              slots={tempSlots.filter(s => s.templateId === selectedSlot.templateId)}
              photos={photos}
              selectedSlot={selectedSlot}
              onSlotClick={() => {}} // Disabled in editor mode
            />
          </div>
        </div>

        {/* Main Photo Editor */}
        <div className="flex-1 flex items-center justify-center bg-gray-800 p-4">
          <div className="relative w-full max-w-sm bg-white rounded-lg overflow-hidden" style={{ aspectRatio: '2/3', maxHeight: '400px' }}>
            {mainPhotoError ? (
              // Error state - show photo info and retry button
              <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-4">
                <div className="text-4xl mb-4">📷</div>
                <p className="text-sm text-center mb-2">{selectedPhoto.name}</p>
                <p className="text-xs text-center mb-4">Failed to load photo</p>
                <button
                  onClick={() => {
                    setMainPhotoError(false);
                    setMainPhotoLoading(true);
                  }}
                  className="px-3 py-1 bg-blue-600 text-white rounded text-xs"
                >
                  Retry
                </button>
                <div className="mt-4 text-xs text-gray-400 max-w-xs">
                  <p>Tried URLs:</p>
                  {getMainPhotoUrl().map((url, i) => (
                    <p key={i} className="truncate">• {url.substring(0, 50)}...</p>
                  ))}
                </div>
              </div>
            ) : (
              <TransformWrapper
                ref={transformRef}
                initialScale={1}
                minScale={0.5}
                maxScale={3}
                centerOnInit={true}
                onTransformed={handleTransformChange}
              >
                <TransformComponent
                  wrapperClass="w-full h-full"
                  contentClass="w-full h-full"
                >
                  <MainPhotoComponent
                    photo={selectedPhoto}
                    onLoad={() => {
                      setMainPhotoLoading(false);
                      setMainPhotoError(false);
                    }}
                    onError={() => {
                      setMainPhotoLoading(false);
                      setMainPhotoError(true);
                    }}
                    onUrlChange={setCurrentPhotoUrl}
                  />
                </TransformComponent>
              </TransformWrapper>
            )}
            
            {/* Loading overlay */}
            {mainPhotoLoading && !mainPhotoError && (
              <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90">
                <div className="text-center">
                  <div className="text-2xl mb-2">⏳</div>
                  <p className="text-sm text-gray-600">Loading photo...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Transform Controls */}
        <div className="px-4 py-3 bg-gray-900">
          <div className="flex items-center justify-between text-white text-sm mb-2">
            <span>Zoom: {(transform.scale * 100).toFixed(0)}%</span>
            <button
              onClick={() => {
                if (transformRef.current) {
                  transformRef.current.resetTransform();
                  setTransform({ scale: 1, x: 0, y: 0 });
                }
              }}
              className="text-blue-400 hover:text-blue-300 px-3 py-1 rounded border border-blue-400"
            >
              Reset
            </button>
          </div>
          {currentPhotoUrl && (
            <div className="text-xs text-gray-400 truncate">
              URL: {currentPhotoUrl.substring(0, 60)}...
            </div>
          )}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-gray-900 text-center">
        <p className="text-gray-400 text-sm">
          Use pinch gestures to zoom and drag to reposition the photo. Tap "Apply" when satisfied.
        </p>
      </div>
    </div>
  );
}

// Separate component for better photo loading control
function MainPhotoComponent({ 
  photo, 
  onLoad, 
  onError, 
  onUrlChange 
}: { 
  photo: Photo; 
  onLoad: () => void; 
  onError: () => void; 
  onUrlChange: (url: string) => void; 
}) {
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  
  const fallbackUrls = (() => {
    const urls = [];
    
    if (photo.thumbnailUrl) {
      urls.push(photo.thumbnailUrl.replace('=s220', '=s1200'));
      urls.push(photo.thumbnailUrl.replace('=s220', '=s800'));
      urls.push(photo.thumbnailUrl.replace('=s220', '=s600'));
      urls.push(photo.thumbnailUrl);
    }
    
    if (photo.url) {
      urls.push(photo.url);
    }
    
    if (photo.googleDriveId) {
      urls.push(`https://drive.google.com/uc?id=${photo.googleDriveId}&export=view`);
    }
    
    return urls.filter(Boolean);
  })();

  const getCurrentUrl = () => {
    if (currentUrlIndex < fallbackUrls.length) {
      return fallbackUrls[currentUrlIndex];
    }
    return photo.url || '';
  };

  const handleImageLoad = () => {
    const url = getCurrentUrl();
    console.log(`✅ Main photo loaded successfully: ${photo.name} (URL ${currentUrlIndex + 1}/${fallbackUrls.length})`, url);
    onUrlChange(url);
    onLoad();
  };

  const handleImageError = () => {
    const url = getCurrentUrl();
    console.error(`❌ Failed to load main photo: ${photo.name} with URL ${currentUrlIndex + 1}/${fallbackUrls.length}:`, url);
    
    // Try next fallback URL
    if (currentUrlIndex < fallbackUrls.length - 1) {
      console.log(`🔄 Trying fallback URL ${currentUrlIndex + 2}/${fallbackUrls.length} for ${photo.name}`);
      setCurrentUrlIndex(prev => prev + 1);
    } else {
      // All URLs failed
      console.error(`💥 All URLs failed for main photo: ${photo.name}`);
      onError();
    }
  };

  return (
    <img
      key={`${photo.id}-${currentUrlIndex}`}
      src={getCurrentUrl()}
      alt={photo.name}
      className="w-full h-full object-cover"
      onLoad={handleImageLoad}
      onError={handleImageError}
      crossOrigin="anonymous"
    />
  );
}