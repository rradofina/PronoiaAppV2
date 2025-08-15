import { useState, useEffect, useRef, useCallback } from 'react';
import { Photo, TemplateSlot } from '../types';
import { photoCacheService } from '../services/photoCacheService';
import { useSwipeGesture } from '../hooks/useSwipeGesture';
import ZoomableImage from './ZoomableImage';

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

// Progressive Image Component - loads low res first, then high res
const ProgressiveImage = ({ 
  photo, 
  lowResSrc, 
  highResSrc, 
  alt, 
  className,
  onHighResLoad,
  imageCache
}: {
  photo: Photo;
  lowResSrc: string;
  highResSrc: string;
  alt: string;
  className: string;
  onHighResLoad?: () => void;
  imageCache: React.MutableRefObject<Map<string, { url: string; loaded: boolean }>>;
}) => {
  // Check if we already have this image cached
  const cached = imageCache.current.get(photo.id);
  const [currentSrc, setCurrentSrc] = useState(cached?.loaded ? cached.url : lowResSrc);
  const [isHighResLoaded, setIsHighResLoaded] = useState(cached?.loaded || false);
  const highResRef = useRef<HTMLImageElement | null>(null);
  const lastPhotoId = useRef<string>(photo.id);
  
  useEffect(() => {
    // Only reset if it's actually a different photo
    if (photo.id !== lastPhotoId.current) {
      lastPhotoId.current = photo.id;
      
      // Check cache first
      const cached = imageCache.current.get(photo.id);
      if (cached?.loaded) {
        // Already have high-res cached, use it immediately
        setCurrentSrc(cached.url);
        setIsHighResLoaded(true);
        return;
      }
      
      // Not cached, start with low res
      setCurrentSrc(lowResSrc);
      setIsHighResLoaded(false);
      
      // Load high res in background
      const img = new Image();
      img.src = highResSrc;
      img.onload = () => {
        // Double-check we're still showing the same photo
        if (photo.id === lastPhotoId.current) {
          setIsHighResLoaded(true);
          setCurrentSrc(highResSrc);
          // Cache it
          imageCache.current.set(photo.id, { url: highResSrc, loaded: true });
          if (onHighResLoad) onHighResLoad();
        }
      };
      highResRef.current = img;
    }
    
    return () => {
      if (highResRef.current) {
        highResRef.current.onload = null;
      }
    };
  }, [photo.id, lowResSrc, highResSrc, imageCache, onHighResLoad]);
  
  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      style={{
        filter: !isHighResLoaded ? 'blur(2px)' : 'none',
        transition: 'filter 0.3s ease-in-out'
      }}
      crossOrigin="anonymous"
    />
  );
};

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
        // Preload thumbnail first (fast)
        const thumbImg = new Image();
        thumbImg.src = photoToPreload.thumbnailUrl || photoToPreload.url;
        
        // Then preload high res
        const img = new Image();
        const highResUrl = photoToPreload.thumbnailUrl ? 
          photoToPreload.thumbnailUrl.replace('=s220', '=s2400') : 
          photoToPreload.url;
        img.src = highResUrl;
        img.onload = () => {
          imageCache.current.set(photoToPreload.id, { url: highResUrl, loaded: true });
          console.log(`✅ Preloaded high-res: ${photoToPreload.name}`);
        };
        preloadedImages.current.set(photoToPreload.id, img);
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
  const [photoOffset, setPhotoOffset] = useState(0); // Tracks which photo set we're showing
  const [isZoomed, setIsZoomed] = useState(false); // Track zoom state for current photo
  
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
  
  // Reset zoom when photo changes
  useEffect(() => {
    setIsZoomed(false);
  }, [currentPhotoIndex]);
  
  // Swipe gesture setup - MUST be before any conditional returns
  const { handlers: swipeHandlers, isSwiping } = useSwipeGesture({
    onSwipeLeft: () => {
      // Don't allow swiping when zoomed
      if (isZoomed) return;
      
      setIsTransitioning(true);
      
      // Animate to completion
      requestAnimationFrame(() => {
        setSwipeProgress(1); // Complete the swipe animation
        
        // After animation completes
        setTimeout(() => {
          handleNext(); // Update index
          setPhotoOffset(prev => prev + 1); // Track that we moved one photo forward
          setSwipeProgress(0); // This is now just for tracking gesture, not position
          setIsTransitioning(false);
        }, 300); // Match CSS transition duration
      });
    },
    onSwipeRight: () => {
      // Don't allow swiping when zoomed
      if (isZoomed) return;
      
      setIsTransitioning(true);
      
      // Animate to completion
      requestAnimationFrame(() => {
        setSwipeProgress(-1); // Complete the swipe animation
        
        // After animation completes
        setTimeout(() => {
          handlePrevious(); // Update index
          setPhotoOffset(prev => prev - 1); // Track that we moved one photo backward
          setSwipeProgress(0); // This is now just for tracking gesture, not position
          setIsTransitioning(false);
        }, 300); // Match CSS transition duration
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
    
    // For fullscreen, prioritize high resolution first - optimized for tablets
    if (photo.thumbnailUrl) {
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s2400')); // =s2400 (ultra high res for tablets)
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s1800')); // =s1800 (high quality)
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s1200')); // =s1200 (good quality)
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s800')); // =s800 (medium quality)
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s600')); // =s600 (lower quality fallback)
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
  
  // Photo is now handled in the map loop

  return (
    <div className={`fixed inset-0 ${isDimmed ? 'z-30' : 'z-50'} bg-black ${isDimmed ? 'bg-opacity-50' : 'bg-opacity-95'} flex flex-col h-screen transition-all duration-300`}>
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      {/* <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        FullscreenPhotoViewer.tsx
      </div> */}
      
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
        {...(!isZoomed ? swipeHandlers : {})}
        style={{ touchAction: 'none' }}
      >
        {/* Previous Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Don't allow navigation when zoomed
            if (isZoomed) return;
            console.log('🔙 Previous button clicked');
            handlePrevious();
          }}
          className={`absolute left-4 top-1/2 transform -translate-y-1/2 z-50 bg-black bg-opacity-70 text-white rounded-full p-3 hover:bg-opacity-90 active:bg-opacity-100 transition-all shadow-lg ${isDimmed || isSwiping || isZoomed ? 'opacity-30 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Carousel Container - holds 3 photos for smooth sliding */}
        <div className="relative w-full h-full flex items-center justify-center">
          {/* Render 5 photos for smooth infinite scrolling */}
          {[-2, -1, 0, 1, 2].map(offset => {
            const photoIndex = (currentPhotoIndex + offset + photos.length * 100) % photos.length;
            const photo = photos[photoIndex];
            if (!photo) return null;
            
            // Calculate position based on offset and swipe progress
            const basePosition = offset * 100; // -200, -100, 0, 100, 200
            const swipeOffset = -swipeProgress * 100; // Swipe movement
            const finalPosition = basePosition + swipeOffset;
            
            return (
              <div
                key={`${photo.id}-${offset}`}
                className="absolute w-full h-full flex items-center justify-center"
                style={{
                  transform: `translateX(${finalPosition}%)`,
                  transition: isTransitioning && !isSwiping ? 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
                  pointerEvents: offset === 0 ? 'auto' : 'none', // Only current photo can be interacted with
                }}
              >
                {/* Use ZoomableImage for all photos to prevent component swapping */}
                <ZoomableImage
                  lowResSrc={photo.thumbnailUrl || photo.url}
                  highResSrc={photo.thumbnailUrl ? photo.thumbnailUrl.replace('=s220', '=s2400') : photo.url}
                  alt={photo.name}
                  className="w-full h-full"
                  isActive={offset === 0} // Only current photo can be zoomed
                  onZoomChange={offset === 0 ? setIsZoomed : undefined}
                  imageCache={imageCache}
                  photoId={photo.id}
                />
              </div>
            );
          })}
        </div>

        {/* Next Button */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // Don't allow navigation when zoomed
            if (isZoomed) return;
            console.log('➡️ Next button clicked');
            handleNext();
          }}
          className={`absolute right-4 top-1/2 transform -translate-y-1/2 z-50 bg-black bg-opacity-70 text-white rounded-full p-3 hover:bg-opacity-90 active:bg-opacity-100 transition-all shadow-lg ${isDimmed || isSwiping || isZoomed ? 'opacity-30 pointer-events-none' : 'opacity-100 pointer-events-auto'}`}
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