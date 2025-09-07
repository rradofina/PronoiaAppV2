import { useState } from 'react';
import { TemplateSlot, Photo } from '../types';

interface PhotoSelectionModeProps {
  photos: Photo[];
  selectedSlot: TemplateSlot;
  onPhotoSelect: (photo: Photo) => void;
  onBack: () => void;
  isVisible: boolean;
}

export default function PhotoSelectionMode({
  photos,
  selectedSlot,
  onPhotoSelect,
  onBack,
  isVisible
}: PhotoSelectionModeProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      {/* <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        PhotoSelectionMode.tsx
      </div> */}
      {/* Header with template indicator */}
      <div className="bg-white shadow-sm p-3 border-b">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>
          
          <div className="text-center">
            <h3 className="font-medium text-gray-800">{selectedSlot.templateName}</h3>
            <p className="text-xs text-gray-500">Select photo for Slot {selectedSlot.slotIndex + 1}</p>
          </div>
          
          <div className="w-16" /> {/* Spacer */}
        </div>
      </div>

      {/* Template Indicator - Small version in corner */}
      <div className="absolute top-20 right-4 z-10 bg-white rounded-lg shadow-lg p-2 border">
        <div className="w-16 h-24 bg-gray-100 rounded flex items-center justify-center">
          <div className={`w-3 h-3 rounded border-2 ${
            selectedSlot ? 'border-blue-500 bg-blue-100' : 'border-gray-300'
          }`} />
        </div>
        <p className="text-xs text-center mt-1 text-gray-600">Slot {selectedSlot.slotIndex + 1}</p>
      </div>

      {/* Photo Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-0">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => onPhotoSelect(photo)}
              className="relative overflow-hidden cursor-pointer hover:opacity-75 transition-opacity aspect-[2/3] xl:aspect-auto"
            >
              <TemplateFirstPhotoCard 
                photo={photo}
              />
              
              {/* Filename overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white px-2 py-1">
                <p className="text-xs truncate">{photo.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-3 bg-gray-50 border-t">
        <p className="text-center text-gray-600 text-sm">
          Tap a photo to place it in the highlighted slot
        </p>
      </div>
    </div>
  );
}

// Photo card component with better error handling for template-first workflow
function TemplateFirstPhotoCard({ photo }: { photo: Photo }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  
  const fallbackUrls = (() => {
    const urls = [];
    
    if (photo.thumbnailUrl) {
      urls.push(photo.thumbnailUrl.replace('=s220', '=s400')); // Good quality for grid
      urls.push(photo.thumbnailUrl.replace('=s220', '=s600')); // Higher quality fallback
      urls.push(photo.thumbnailUrl); // Original thumbnail
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
    if (process.env.NODE_ENV === 'development') console.log(`✅ Template-first photo loaded: ${photo.name} (URL ${currentUrlIndex + 1}/${fallbackUrls.length})`);
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    console.error(`❌ Template-first photo failed: ${photo.name} (URL ${currentUrlIndex + 1}/${fallbackUrls.length}):`, getCurrentUrl());
    
    // Try next fallback URL
    if (currentUrlIndex < fallbackUrls.length - 1) {
      if (process.env.NODE_ENV === 'development') console.log(`🔄 Trying fallback URL ${currentUrlIndex + 2}/${fallbackUrls.length} for ${photo.name}`);
      setCurrentUrlIndex(prev => prev + 1);
      setImageLoaded(false);
      setImageError(false);
    } else {
      // All URLs failed
      console.error(`💥 All URLs failed for template-first photo: ${photo.name}`);
      setImageError(true);
      setImageLoaded(false);
    }
  };

  return (
    <>
      <img 
        key={`${photo.id}-${currentUrlIndex}`}
        src={getCurrentUrl()}
        alt={photo.name} 
        className="w-full h-full object-cover"
        onLoad={handleImageLoad}
        onError={handleImageError}
        style={{ display: imageLoaded && !imageError ? 'block' : 'none' }}
        crossOrigin="anonymous"
      />
      
      {/* Loading/Error placeholder */}
      {(!imageLoaded || imageError) && (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
          <div className="text-center p-2">
            <div className="text-lg mb-1">
              {imageError ? '❌' : '⏳'}
            </div>
            <div className="text-xs">
              {imageError ? 'Failed' : 'Loading...'}
            </div>
          </div>
        </div>
      )}
    </>
  );
}