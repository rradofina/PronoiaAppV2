import React, { useEffect, useRef } from 'react';
import { Photo } from '../types';
import { getBestPhotoUrl } from '../utils/photoUrlUtils';
import { photoCacheService } from '../services/photoCacheService';

interface PhotoCardProps {
  photo: Photo;
  onSelect: () => void;
  isFavorited?: boolean;
  onToggleFavorite?: (photoId: string) => void;
  isUsedInTemplate?: boolean;
}

function PhotoCard({ photo, onSelect, isFavorited = false, onToggleFavorite, isUsedInTemplate = false }: PhotoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

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
      <div className="w-full relative" style={{ aspectRatio: '2/3' }}>
        <img 
          src={getBestPhotoUrl(photo)} 
          alt={photo.name} 
          className="w-full h-full object-cover"
          style={{
            imageRendering: 'auto',
            backfaceVisibility: 'hidden'
          }}
          onLoad={() => console.log(`✅ PhotoGrid high-res image loaded: ${photo.name}`)}
          onError={(e) => {
            console.error(`❌ PhotoGrid high-res image failed: ${photo.name}`, getBestPhotoUrl(photo));
            e.currentTarget.style.display = 'none';
          }}
        />
        
        {/* Star button for favorites */}
        {onToggleFavorite && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(photo.id);
            }}
            className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${
              isFavorited 
                ? 'bg-yellow-500 text-white shadow-lg' 
                : 'bg-black bg-opacity-50 text-white hover:bg-opacity-70'
            } ${isUsedInTemplate ? 'opacity-50' : ''}`}
            title={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
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
  usedPhotoIds = new Set()
}: PhotoGridProps) {
  
  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-4" onScroll={onScroll}>
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
          />
        ))}
      </div>
    </div>
  );
}