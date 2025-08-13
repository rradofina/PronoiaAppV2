import React, { useEffect, useRef, useState } from 'react';
import { Photo } from '../types';
import { photoCacheService } from '../services/photoCacheService';

interface PhotoCardProps {
  photo: Photo;
  onSelect: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: (photoId: string) => void;
  isUsedInTemplate?: boolean;
}

function PhotoCard({ photo, onSelect, isFavorited = false, onToggleFavorite, isUsedInTemplate = false, isEditingMode = false }: PhotoCardProps & { isEditingMode?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [fallbackUrls] = useState(() => {
    // Generate fallback URLs for this photo (restored from working version)
    const fallbacks = [];
    
    // If we have a thumbnail, use higher resolution for better quality on modern displays
    if (photo.thumbnailUrl) {
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s400')); // =s400 (better quality for grid)
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s600')); // =s600 (high quality fallback)
      fallbacks.push(photo.thumbnailUrl); // =s220 (original size as fallback)
    }
    
    // Try direct Google Drive link
    if (photo.googleDriveId) {
      fallbacks.push(`https://drive.google.com/uc?id=${photo.googleDriveId}&export=view`);
    }
    
    // Use the original URL as final fallback
    if (photo.url && !fallbacks.includes(photo.url)) {
      fallbacks.push(photo.url);
    }
    
    return fallbacks.filter(Boolean);
  });

  // Preload photo when card comes into view or on hover
  useEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    // Intersection Observer for preloading when card becomes visible
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // Preload this photo and a few nearby ones
            photoCacheService.preloadPhoto(photo);
          }
        });
      },
      {
        rootMargin: '100px', // Start preloading 100px before card is visible
        threshold: 0.1
      }
    );

    observer.observe(card);

    return () => {
      observer.disconnect();
    };
  }, [photo]);

  const getCurrentUrl = () => {
    if (currentUrlIndex < fallbackUrls.length) {
      return fallbackUrls[currentUrlIndex];
    }
    return photo.url; // Final fallback
  };

  const handleImageLoad = () => {
    console.log(`✅ PhotoGrid image loaded successfully: ${photo.name} (URL ${currentUrlIndex + 1}/${fallbackUrls.length})`);
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    console.error(`❌ PhotoGrid image failed: ${photo.name} with URL ${currentUrlIndex + 1}/${fallbackUrls.length}:`, getCurrentUrl());
    
    // Try next fallback URL
    if (currentUrlIndex < fallbackUrls.length - 1) {
      console.log(`🔄 Trying next fallback URL for ${photo.name} (${currentUrlIndex + 2}/${fallbackUrls.length})`);
      setCurrentUrlIndex(prev => prev + 1);
      setImageError(false); // Reset error state to try next URL
    } else {
      console.error(`❌ All fallback URLs failed for ${photo.name}`);
      setImageError(true);
    }
  };

  const handleMouseEnter = () => {
    // Aggressively preload on hover for faster template editor loading
    photoCacheService.preloadPhoto(photo);
  };

  return (
    <div
      ref={cardRef}
      onClick={onSelect}
      onMouseEnter={handleMouseEnter}
      className="relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-200"
    >
      <div className="w-full relative aspect-[2/3] xl:aspect-auto">
        {!imageError ? (
          <img 
            src={getCurrentUrl()} 
            alt={photo.name} 
            className="w-full h-full object-cover"
            style={{
              imageRendering: 'auto',
              backfaceVisibility: 'hidden'
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-1">📷</div>
              <div className="text-xs">Failed to load</div>
            </div>
          </div>
        )}
        
        {/* Star button for favorites - larger hitbox for better touch targeting */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Always call onToggleFavorite - it handles the logic and shows toast
              onToggleFavorite(photo.id);
            }}
            className={`absolute top-1 right-1 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-200 ${
              isFavorited 
                ? 'bg-yellow-500 text-white shadow-lg' 
                : 'bg-black bg-opacity-50 text-white hover:bg-opacity-70'
            } ${isUsedInTemplate && isFavorited ? 'opacity-50 cursor-not-allowed' : ''}`}
            title={
              isUsedInTemplate && isFavorited 
                ? 'Remove from template slot first' 
                : isFavorited 
                ? 'Remove from favorites' 
                : 'Add to favorites'
            }
          >
            <span className="text-sm">
              {isFavorited ? '⭐' : '☆'}
            </span>
          </button>
        )}

        {/* Used in template indicator */}
        {isUsedInTemplate && (
          <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
            Used
          </div>
        )}

        {/* Filename overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white px-2 py-1">
          <p className="text-xs truncate">{photo.name}</p>
        </div>
      </div>
    </div>
  );
}

interface PhotoGridProps {
  photos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  gridCols?: string;
  showScrollHint?: boolean;
  hasScrolled?: boolean;
  onScroll?: () => void;
  // New props for favorites system
  favoritedPhotos?: Set<string>;
  onToggleFavorite?: (photoId: string) => void;
  usedPhotoIds?: Set<string>;
  isEditingMode?: boolean;
}

export default function PhotoGrid({
  photos,
  onPhotoClick,
  gridCols = "grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5",
  showScrollHint = false,
  hasScrolled = false,
  onScroll,
  favoritedPhotos = new Set(),
  onToggleFavorite,
  usedPhotoIds = new Set(),
  isEditingMode = false
}: PhotoGridProps) {
  
  return (
    <div 
      className="flex-1 overflow-y-auto p-3 sm:p-4" 
      style={{
        touchAction: 'pan-y', // Enable vertical touch scrolling
        WebkitOverflowScrolling: 'touch' // Enable momentum scrolling on iOS
      }}
      onScroll={onScroll}
    >
      {showScrollHint && !hasScrolled && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
          <p className="text-yellow-800 text-center font-medium text-sm">
            👉 Select a print slot {/* Changed from down arrow to right arrow for desktop */}
            <span className="lg:hidden">below</span>
            <span className="hidden lg:inline">on the right</span>
            {' '}to start choosing photos
          </p>
        </div>
      )}

      <div className={`grid ${gridCols} gap-0 pb-4`}>
        {photos.map((photo) => (
          <PhotoCard 
            key={photo.id}
            photo={photo}
            onSelect={() => onPhotoClick(photo)}
            isFavorited={favoritedPhotos.has(photo.id)}
            onToggleFavorite={onToggleFavorite}
            isUsedInTemplate={usedPhotoIds.has(photo.id)}
            isEditingMode={isEditingMode}
          />
        ))}
      </div>
    </div>
  );
}