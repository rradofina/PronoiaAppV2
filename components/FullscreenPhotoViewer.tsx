import { useState, useEffect, useRef } from 'react';
import { Photo, TemplateSlot } from '../types';
import { photoCacheService } from '../services/photoCacheService';
import { useSwipeGesture } from '../hooks/useSwipeGesture';

interface FullscreenPhotoViewerProps {
  photo: Photo;
  photos: Photo[];
  onClose: () => void;
  onAddToTemplate: (photo: Photo) => void;
  isVisible: boolean;
  isDimmed?: boolean; // New prop to control dimming when template bar is open
  // New props for mode-aware functionality
  selectionMode?: 'photo' | 'print';
  favoritedPhotos?: Set<string>; // Pass the entire favorites set instead of individual status
  onToggleFavorite?: (photoId: string) => void;
}

export default function FullscreenPhotoViewer({
  photo,
  photos,
  onClose,
  onAddToTemplate,
  isVisible,
  isDimmed = false,
  selectionMode = 'photo',
  favoritedPhotos = new Set(),
  onToggleFavorite
}: FullscreenPhotoViewerProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(() => 
    photo ? photos.findIndex(p => p.id === photo.id) : 0
  );
  
  // Image cache to store loaded URLs for instant switching
  const imageCache = useRef<Map<string, { url: string; loaded: boolean }>>(new Map());
  const preloadedImages = useRef<Map<string, HTMLImageElement>>(new Map());
  
  // Update photo index when a new photo is selected (only when photo prop changes)
  useEffect(() => {
    if (photo && isVisible) {
      const newIndex = photos.findIndex(p => p.id === photo.id);
      if (newIndex !== -1) {
        setCurrentPhotoIndex(newIndex);
        // Don't reset image state if we have this photo cached
        const cached = imageCache.current.get(photo.id);
        if (!cached || !cached.loaded) {
          setCurrentUrlIndex(0);
          setImageLoaded(false);
          setImageError(false);
        }
      }
    }
  }, [photo?.id, isVisible, photos]);
  
  // Aggressive preloading when viewer opens or photo changes
  useEffect(() => {
    if (!isVisible || photos.length === 0) return;
    
    // Always preload adjacent photos first (highest priority)
    const adjacentIndices = [
      currentPhotoIndex,
      currentPhotoIndex > 0 ? currentPhotoIndex - 1 : photos.length - 1,
      currentPhotoIndex < photos.length - 1 ? currentPhotoIndex + 1 : 0
    ];
    
    adjacentIndices.forEach(index => {
      const photoToPreload = photos[index];
      if (photoToPreload && !imageCache.current.has(photoToPreload.id)) {
        const img = new Image();
        const urls = getFallbackUrls(photoToPreload);
        if (urls.length > 0) {
          img.src = urls[0];
          img.onload = () => {
            imageCache.current.set(photoToPreload.id, { url: urls[0], loaded: true });
            console.log(`✅ Preloaded: ${photoToPreload.name}`);
          };
          preloadedImages.current.set(photoToPreload.id, img);
        }
        photoCacheService.preloadPhoto(photoToPreload);
      }
    });
    
    // Then preload wider radius
    const preloadRadius = 5;
    const preloadIndices: number[] = [];
    
    for (let i = -preloadRadius; i <= preloadRadius; i++) {
      if (Math.abs(i) <= 1) continue; // Skip adjacent ones, already loaded
      let index = currentPhotoIndex + i;
      if (index < 0) index = photos.length + index;
      if (index >= photos.length) index = index - photos.length;
      if (index >= 0 && index < photos.length) {
        preloadIndices.push(index);
      }
    }
    
    // Preload remaining nearby photos
    setTimeout(() => {
      preloadIndices.forEach(index => {
        const photoToPreload = photos[index];
        if (photoToPreload && !preloadedImages.current.has(photoToPreload.id)) {
          const img = new Image();
          const urls = getFallbackUrls(photoToPreload);
          if (urls.length > 0) {
            img.src = urls[0];
            img.onload = () => {
              imageCache.current.set(photoToPreload.id, { url: urls[0], loaded: true });
            };
            preloadedImages.current.set(photoToPreload.id, img);
          }
          photoCacheService.preloadPhoto(photoToPreload);
        }
      });
    }, 100);
    
    // Preload all remaining photos in background
    setTimeout(() => {
      photos.forEach((p, index) => {
        if (!preloadedImages.current.has(p.id)) {
          photoCacheService.preloadPhoto(p);
        }
      });
    }, 2000);
  }, [currentPhotoIndex, photos, isVisible]);
  
  // Don't reset image states on navigation to prevent flashing
  // Only reset URL index if we don't have the photo cached
  useEffect(() => {
    const currentPhoto = photos[currentPhotoIndex];
    if (currentPhoto) {
      const cached = imageCache.current.get(currentPhoto.id);
      if (!cached || !cached.loaded) {
        setCurrentUrlIndex(0);
        // Don't reset imageLoaded/imageError here - it causes flashing
      }
    }
  }, [currentPhotoIndex, photos]);

  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [swipeProgress, setSwipeProgress] = useState(0); // -1 to 1 for swipe animation
  const [isTransitioning, setIsTransitioning] = useState(false);
  
  // Navigation handlers (defined early for use in swipe hook)
  const handlePrevious = () => {
    const newIndex = currentPhotoIndex > 0 ? currentPhotoIndex - 1 : photos.length - 1;
    // Ensure the new index is valid before updating
    if (newIndex >= 0 && newIndex < photos.length && photos[newIndex]) {
      console.log(`📸 Previous: ${currentPhotoIndex} → ${newIndex} (${photos[newIndex]?.name || 'unknown'})`);
      setCurrentPhotoIndex(newIndex);
    } else {
      console.error('Invalid previous index:', newIndex);
    }
  };

  const handleNext = () => {
    const newIndex = currentPhotoIndex < photos.length - 1 ? currentPhotoIndex + 1 : 0;
    // Ensure the new index is valid before updating
    if (newIndex >= 0 && newIndex < photos.length && photos[newIndex]) {
      console.log(`📸 Next: ${currentPhotoIndex} → ${newIndex} (${photos[newIndex]?.name || 'unknown'})`);
      setCurrentPhotoIndex(newIndex);
    } else {
      console.error('Invalid next index:', newIndex);
    }
  };
  
  // Swipe gesture setup - MUST be before any conditional returns
  const { handlers: swipeHandlers, isSwiping } = useSwipeGesture({
    onSwipeLeft: () => {
      // Store current progress before changing
      const currentProgress = swipeProgress;
      
      // Change photo immediately
      handleNext();
      
      // Start from where the swipe ended, adjusted for new photo positions
      // After changing index, what was "next" is now "current", so adjust
      setSwipeProgress(currentProgress - 1); // Shift back by one photo width
      setIsTransitioning(true);
      
      // Animate to final position
      requestAnimationFrame(() => {
        setSwipeProgress(0);
        setTimeout(() => setIsTransitioning(false), 300);
      });
    },
    onSwipeRight: () => {
      // Store current progress before changing
      const currentProgress = swipeProgress;
      
      // Change photo immediately
      handlePrevious();
      
      // Start from where the swipe ended, adjusted for new photo positions
      // After changing index, what was "previous" is now "current", so adjust
      setSwipeProgress(currentProgress + 1); // Shift forward by one photo width
      setIsTransitioning(true);
      
      // Animate to final position
      requestAnimationFrame(() => {
        setSwipeProgress(0);
        setTimeout(() => setIsTransitioning(false), 300);
      });
    },
    onSwipeProgress: (progress) => {
      setSwipeProgress(progress);
    },
    onSwipeStart: () => {
      setIsTransitioning(false); // Disable transitions during swipe
    },
    onSwipeEnd: () => {
      // Check if swipe didn't trigger navigation (cancelled swipe)
      if (Math.abs(swipeProgress) > 0 && Math.abs(swipeProgress) < 0.25) {
        // Animate back to center
        setIsTransitioning(true);
        requestAnimationFrame(() => {
          setSwipeProgress(0);
          setTimeout(() => setIsTransitioning(false), 300);
        });
      }
    },
    swipeThreshold: 0.25, // 25% of screen width to trigger navigation
  });
  
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
  
  const getPhotoUrl = (photo: Photo, urlIndex: number = 0) => {
    // Try to get from cache first
    const cached = imageCache.current.get(photo.id);
    if (cached && cached.loaded) {
      return cached.url;
    }
    // Otherwise get from fallback URLs
    const fallbackUrls = getFallbackUrls(photo);
    if (urlIndex < fallbackUrls.length) {
      return fallbackUrls[urlIndex];
    }
    return photo.url; // Final fallback
  };

  if (!isVisible || !photo || photos.length === 0) return null;

  // Use photo from array at currentPhotoIndex, fallback to originally selected photo
  const currentPhoto = photos[currentPhotoIndex] || photo;
  
  // Calculate current photo's favorite status
  const currentPhotoFavorited = currentPhoto ? favoritedPhotos.has(currentPhoto.id) : false;
  
  // Handle favorite toggle
  const handleToggleFavorite = () => {
    if (onToggleFavorite && currentPhoto) {
      onToggleFavorite(currentPhoto.id);
    }
  };
  
  // Ensure currentPhotoIndex is within valid bounds
  if (currentPhotoIndex < 0 || currentPhotoIndex >= photos.length) {
    console.warn('Photo index out of bounds:', currentPhotoIndex, 'photos length:', photos.length);
    setCurrentPhotoIndex(photo ? photos.findIndex(p => p.id === photo.id) : 0);
  }
  
  // Get previous and next photos for carousel
  const previousPhotoIndex = currentPhotoIndex > 0 ? currentPhotoIndex - 1 : photos.length - 1;
  const nextPhotoIndex = currentPhotoIndex < photos.length - 1 ? currentPhotoIndex + 1 : 0;
  const previousPhoto = photos[previousPhotoIndex];
  const nextPhoto = photos[nextPhotoIndex];

  return (
    <div className={`fixed inset-0 ${isDimmed ? 'z-30' : 'z-50'} bg-black ${isDimmed ? 'bg-opacity-50' : 'bg-opacity-95'} flex flex-col h-screen transition-all duration-300`}>
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        FullscreenPhotoViewer.tsx
      </div>
      
      {/* Header */}
      <div className={`flex items-center justify-between p-4 text-white ${isDimmed ? 'opacity-50' : 'opacity-100'}`}>
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
        
        {/* Favorites Button - Mode Aware */}
        {onToggleFavorite && (
          <button
            onClick={handleToggleFavorite}
            className={`p-2 rounded-full transition-all duration-200 ${
              currentPhotoFavorited 
                ? 'bg-yellow-500 text-white shadow-lg' 
                : 'bg-black bg-opacity-50 text-white hover:bg-opacity-70'
            }`}
            title={currentPhotoFavorited ? 'Remove from favorites' : 'Add to favorites'}
          >
            <span className="text-xl">
              {currentPhotoFavorited ? '⭐' : '☆'}
            </span>
          </button>
        )}
        
        {!onToggleFavorite && <div className="w-6" />} {/* Spacer when no favorites button */}
      </div>

      {/* Photo Display - Carousel Container */}
      <div 
        className="flex-1 flex items-center justify-center relative min-h-0 overflow-hidden"
        {...swipeHandlers}
        style={{ touchAction: 'pan-y pinch-zoom' }}
      >
        {/* Previous Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔙 Previous button clicked');
            handlePrevious();
          }}
          className={`absolute left-4 top-1/2 transform -translate-y-1/2 z-50 bg-black bg-opacity-70 text-white rounded-full p-3 hover:bg-opacity-90 active:bg-opacity-100 transition-all shadow-lg ${isDimmed || isSwiping ? 'opacity-30 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Carousel Container - holds 3 photos for smooth sliding */}
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Previous Photo */}
          <div 
            className="absolute w-full h-full flex items-center justify-center"
            style={{ 
              transform: `translateX(${-100 - (swipeProgress * 100)}%)`,
              transition: isTransitioning && !isSwiping ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            }}
          >
            {previousPhoto && (
              <img
                src={getPhotoUrl(previousPhoto)}
                alt={previousPhoto.name}
                className="max-w-full max-h-full object-contain"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </div>

          {/* Current Photo */}
          <div 
            className="absolute w-full h-full flex items-center justify-center"
            style={{ 
              transform: `translateX(${-swipeProgress * 100}%)`,
              transition: isTransitioning && !isSwiping ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            }}
          >
            <img
            src={getPhotoUrl(currentPhoto, currentUrlIndex)}
            alt={currentPhoto.name}
            className="max-w-full max-h-full object-contain"
            onLoad={() => {
              console.log(`✅ Photo loaded: ${currentPhoto.name}`);
              // Cache this successful URL
              const url = getPhotoUrl(currentPhoto, currentUrlIndex);
              imageCache.current.set(currentPhoto.id, { url, loaded: true });
            }}
            onError={() => {
              const fallbackUrls = getFallbackUrls(currentPhoto);
              console.error(`❌ Failed to load ${currentPhoto.name}`);
              
              // Try next fallback URL
              if (currentUrlIndex < fallbackUrls.length - 1) {
                console.log(`🔄 Trying fallback URL ${currentUrlIndex + 2}/${fallbackUrls.length}`);
                setCurrentUrlIndex(prev => prev + 1);
              }
            }}
            style={{ 
              pointerEvents: 'auto'
            }}
            crossOrigin="anonymous"
          />
          </div>

          {/* Next Photo */}
          <div 
            className="absolute w-full h-full flex items-center justify-center"
            style={{ 
              transform: `translateX(${100 - (swipeProgress * 100)}%)`,
              transition: isTransitioning && !isSwiping ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
            }}
          >
            {nextPhoto && (
              <img
                src={getPhotoUrl(nextPhoto)}
                alt={nextPhoto.name}
                className="max-w-full max-h-full object-contain"
                style={{ pointerEvents: 'none' }}
              />
            )}
          </div>
        </div>

        {/* Next Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('➡️ Next button clicked');
            handleNext();
          }}
          className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-50 bg-black bg-opacity-70 text-white rounded-full p-3 hover:bg-opacity-90 active:bg-opacity-100 transition-all shadow-lg ${isDimmed || isSwiping ? 'opacity-30 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Bottom Actions - Mode Aware - Hide when dimmed */}
      {!isDimmed && (
        <div className="p-4 flex-shrink-0">
          {/* Show Add to Template button only in print mode AND only for favorited photos */}
          {selectionMode === 'print' && currentPhotoFavorited && (
            <button
              onClick={() => onAddToTemplate(currentPhoto)}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md"
            >
              Add to Print Template
            </button>
          )}
          
          {/* Show instruction text in photo mode or when photo is not favorited in print mode */}
          {selectionMode === 'photo' && (
            <div className="text-center text-gray-300 py-3">
              <p className="text-sm">Tap the star above to add this photo to your favorites</p>
            </div>
          )}
          
          {selectionMode === 'print' && !currentPhotoFavorited && (
            <div className="text-center text-gray-300 py-3">
              <p className="text-sm">Add to favorites to include in your print templates</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}