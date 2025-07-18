import { useState } from 'react';
import { Photo, TemplateSlot } from '../types';

interface FullscreenPhotoViewerProps {
  photo: Photo;
  photos: Photo[];
  onClose: () => void;
  onAddToTemplate: (photo: Photo) => void;
  isVisible: boolean;
}

export default function FullscreenPhotoViewer({
  photo,
  photos,
  onClose,
  onAddToTemplate,
  isVisible
}: FullscreenPhotoViewerProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(() => 
    photo ? photos.findIndex(p => p.id === photo.id) : 0
  );
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  
  // Generate fallback URLs for fullscreen viewer - prioritize high resolution
  const getFallbackUrls = (photo: Photo) => {
    const fallbacks = [];
    
    // For fullscreen, prioritize high resolution first
    if (photo.thumbnailUrl) {
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s1600')); // =s1600 (high res for fullscreen)
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s1200')); // =s1200 (good quality)
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s800')); // =s800 (medium quality)
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s600')); // =s600 (lower quality)
    }
    
    // Try direct Google Drive link (often highest quality)
    fallbacks.push(`https://drive.google.com/uc?id=${photo.googleDriveId}&export=view`);
    
    // Use the original URL as final fallback
    if (photo.url && !fallbacks.includes(photo.url)) {
      fallbacks.push(photo.url);
    }
    
    // Only use thumbnail as last resort
    if (photo.thumbnailUrl) {
      fallbacks.push(photo.thumbnailUrl); // =s220 (last resort)
    }
    
    return fallbacks.filter(Boolean);
  };
  
  const getCurrentUrl = () => {
    const fallbackUrls = getFallbackUrls(currentPhoto);
    if (currentUrlIndex < fallbackUrls.length) {
      return fallbackUrls[currentUrlIndex];
    }
    return currentPhoto.url; // Final fallback
  };

  if (!isVisible || !photo) return null;

  const currentPhoto = photos[currentPhotoIndex] || photo;

  const handlePrevious = () => {
    setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : photos.length - 1);
    setImageLoaded(false);
    setImageError(false);
    setCurrentUrlIndex(0); // Reset URL index for new photo
  };

  const handleNext = () => {
    setCurrentPhotoIndex(prev => prev < photos.length - 1 ? prev + 1 : 0);
    setImageLoaded(false);
    setImageError(false);
    setCurrentUrlIndex(0); // Reset URL index for new photo
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <button
          onClick={onClose}
          className="flex items-center space-x-2 text-white hover:text-gray-300"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="text-center">
          <h3 className="font-medium">{currentPhoto.name}</h3>
          <p className="text-sm text-gray-300">{currentPhotoIndex + 1} of {photos.length}</p>
        </div>
        
        <div className="w-6" /> {/* Spacer */}
      </div>

      {/* Photo Display */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          className="absolute left-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Photo */}
        <div className="relative w-full h-full flex items-center justify-center">
          <img
            key={`${currentPhoto.id}-${currentUrlIndex}`} // Force re-render when photo or URL changes
            src={getCurrentUrl()}
            alt={currentPhoto.name}
            className="max-w-full max-h-full object-contain"
            onLoad={() => {
              const fallbackUrls = getFallbackUrls(currentPhoto);
              console.log(`✅ Photo loaded successfully: ${currentPhoto.name} (URL ${currentUrlIndex + 1}/${fallbackUrls.length})`);
              setImageLoaded(true);
              setImageError(false);
            }}
            onError={() => {
              const fallbackUrls = getFallbackUrls(currentPhoto);
              console.error(`❌ Failed to load ${currentPhoto.name} with URL ${currentUrlIndex + 1}/${fallbackUrls.length}:`, {
                url: getCurrentUrl()
              });
              
              // Try next fallback URL
              if (currentUrlIndex < fallbackUrls.length - 1) {
                console.log(`🔄 Trying fallback URL ${currentUrlIndex + 2}/${fallbackUrls.length} for ${currentPhoto.name}`);
                setCurrentUrlIndex(prev => prev + 1);
                setImageLoaded(false);
                setImageError(false);
              } else {
                // All URLs failed
                console.error(`💥 All URLs failed for ${currentPhoto.name}`);
                setImageError(true);
                setImageLoaded(false);
              }
            }}
            style={{ display: imageLoaded && !imageError ? 'block' : 'none' }}
            crossOrigin="anonymous"
          />
          
          {/* Loading/Error state */}
          {(!imageLoaded || imageError) && (
            <div className="flex items-center justify-center text-white">
              <div className="text-center">
                <div className="text-4xl mb-4">
                  {imageError ? '❌' : '⏳'}
                </div>
                <p className="text-lg">
                  {imageError ? 'Failed to load image' : 'Loading...'}
                </p>
                {imageError && (
                  <div className="mt-4 text-sm text-gray-400">
                    <p>Photo: {currentPhoto.name}</p>
                    <p>All {getFallbackUrls(currentPhoto).length} URLs failed</p>
                    <button 
                      onClick={() => {
                        setImageError(false);
                        setImageLoaded(false);
                        setCurrentUrlIndex(0); // Start over with first URL
                      }}
                      className="mt-2 px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                    >
                      Retry
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="absolute right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="p-4">
        <button
          onClick={() => onAddToTemplate(currentPhoto)}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Add to Print Template
        </button>
      </div>
    </div>
  );
}