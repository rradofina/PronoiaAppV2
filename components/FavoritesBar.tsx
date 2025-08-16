import React, { useEffect, useRef, useState } from 'react';
import { Photo } from '../types';

interface FavoritesBarProps {
  favoritedPhotos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onRemoveFavorite: (photoId: string) => void;
  isActiveInteractionArea?: boolean;
  layout?: 'horizontal' | 'vertical';
  showRemoveButtons?: boolean;
  usedPhotoIds?: Set<string>;
  maxPhotosToShow?: number;
  onDragStart?: (photo: Photo) => void;
  onDragEnd?: () => void;
}

export default function FavoritesBar({
  favoritedPhotos,
  onPhotoClick,
  onRemoveFavorite,
  isActiveInteractionArea = false,
  layout = 'horizontal',
  showRemoveButtons = true,
  usedPhotoIds = new Set(),
  maxPhotosToShow,
  onDragStart,
  onDragEnd
}: FavoritesBarProps) {
  
  // Apply adaptive photo limiting
  const displayPhotos = maxPhotosToShow ? favoritedPhotos.slice(0, maxPhotosToShow) : favoritedPhotos;
  const containerRef = useRef<HTMLDivElement>(null);
  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
  
  // Handle drag start
  const handleDragStart = (e: React.DragEvent, photo: Photo) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('photoId', photo.id);
    e.dataTransfer.setData('photoUrl', photo.thumbnailUrl || photo.url);
    e.dataTransfer.setData('photoName', photo.name);
    
    // Use the img element directly as drag image with offset for larger appearance
    const img = e.currentTarget.querySelector('img') as HTMLImageElement;
    if (img) {
      // Clone the image element for drag preview
      const dragImg = img.cloneNode(true) as HTMLImageElement;
      dragImg.style.width = `${img.width * 1.5}px`;
      dragImg.style.height = `${img.height * 1.5}px`;
      dragImg.style.position = 'absolute';
      dragImg.style.top = '-9999px';
      dragImg.style.left = '-9999px';
      dragImg.style.pointerEvents = 'none';
      document.body.appendChild(dragImg);
      
      // Use the larger clone as drag image
      e.dataTransfer.setDragImage(dragImg, dragImg.width / 2, dragImg.height / 2);
      
      // Remove clone after a brief delay
      setTimeout(() => {
        document.body.removeChild(dragImg);
      }, 0);
    }
    
    setDraggingPhotoId(photo.id);
    
    if (onDragStart) {
      onDragStart(photo);
    }
    
    console.log('🎯 Started dragging photo:', photo.name);
  };
  
  const handleDragEnd = () => {
    setDraggingPhotoId(null);
    if (onDragEnd) {
      onDragEnd();
    }
    console.log('🎯 Ended dragging');
  }
  
  if (displayPhotos.length === 0) {
    return (
      <div className={`flex items-center justify-center h-full ${
        layout === 'horizontal' ? 'border-t' : ''
      } bg-gray-100`}>
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-1">⭐</div>
          <p className="text-sm">
            No favorites yet - star photos to add them here
          </p>
        </div>
      </div>
    );
  }

  if (layout === 'horizontal') {
    // Horizontal layout - always visible with larger photos
    return (
      <div 
        ref={containerRef}
        className="fixed bottom-0 left-0 right-0 z-50 border-t overflow-hidden bg-white shadow-lg"
        style={{
          height: '200px',
          overflowY: 'auto'
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header section with title */}
          <div className="flex-shrink-0 px-3 py-2 text-sm font-medium text-gray-700 border-b border-gray-200">
            Favorites ({favoritedPhotos.length}) - Drag photos to template slots
          </div>
          
          {/* Photos section - takes remaining space */}
          <div className="flex-1 overflow-x-auto flex items-center">
            <div className="flex px-3 space-x-4 py-3" style={{ touchAction: 'pan-x' }}>
              {displayPhotos.map((photo) => {
                const isUsed = usedPhotoIds.has(photo.id);
                return (
                  <div
                    key={photo.id}
                    className={`flex-shrink-0 relative group cursor-move ${
                      draggingPhotoId && draggingPhotoId !== photo.id ? 'opacity-30' : ''
                    }`}
                    draggable
                    onDragStart={(e) => handleDragStart(e, photo)}
                    onDragEnd={handleDragEnd}
                    onClick={() => onPhotoClick(photo)}
                  >
                    <div className={`rounded-lg overflow-hidden border-2 transition-all duration-300 h-40 ${
                      isUsed
                        ? 'border-green-400 shadow-md'
                        : draggingPhotoId === photo.id
                        ? 'border-blue-500 shadow-xl scale-110'
                        : 'border-gray-200 hover:border-blue-400 hover:shadow-lg'
                    }`} style={{
                      width: 'auto',
                      aspectRatio: '3/4',
                      minWidth: '120px'
                    }}>
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt={photo.name}
                        className={`w-full h-full object-cover transition-opacity duration-200 ${
                          isUsed ? 'opacity-60' : 'opacity-100'
                        }`}
                      />
                      
                      {/* Used indicator overlay */}
                      {isUsed && (
                        <div className="absolute inset-0 bg-green-600 bg-opacity-20 flex items-center justify-center">
                          <div className="bg-green-600 text-white text-xs px-1 rounded font-medium">
                            Used
                          </div>
                        </div>
                      )}
                    </div>
                  
                  {/* Remove button on hover - conditional */}
                  {showRemoveButtons && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFavorite(photo.id);
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from favorites"
                    >
                      ×
                    </button>
                  )}
                  
                  {/* Star indicator */}
                  <div className="absolute bottom-1 right-1 bg-yellow-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                    ⭐
                  </div>
                  
                  {/* Drag indicator on hover */}
                  <div className="absolute top-1 left-1 bg-gray-800 bg-opacity-75 text-white rounded px-1 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    Drag me
                  </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    // Vertical layout (desktop grid design) with drag support
    return (
      <div className="h-full flex flex-col bg-white">
        {/* Header section (if needed for context) */}
        {displayPhotos.length > 9 && (
          <div className="flex-shrink-0 px-4 py-2 text-xs text-gray-600 border-b border-gray-200">
            {displayPhotos.length} photos • Scroll to see all
          </div>
        )}
        
        {/* Scrollable photos grid */}
        <div 
          className="flex-1 overflow-y-auto"
          style={{
            scrollBehavior: 'smooth',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <div className="grid grid-cols-2 gap-3 p-4">
            {displayPhotos.map((photo) => {
              const isUsed = usedPhotoIds.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className={`relative cursor-move group transition-all duration-300 ${
                    draggingPhotoId && draggingPhotoId !== photo.id ? 'opacity-30' : ''
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, photo)}
                  onDragEnd={handleDragEnd}
                  onClick={() => onPhotoClick(photo)}
                  style={{ aspectRatio: '3/4' }}
                >
                  <div className={`w-full h-full rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                    isUsed
                      ? 'border-green-400 shadow-md'
                      : draggingPhotoId === photo.id
                      ? 'border-blue-500 shadow-xl scale-110'
                      : 'border-gray-200 hover:border-blue-400 hover:shadow-lg hover:scale-105'
                  }`}>
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={photo.name}
                      className={`w-full h-full object-cover transition-opacity duration-200 ${
                        isUsed ? 'opacity-60' : 'opacity-100'
                      }`}
                    />
                    
                    {/* Used indicator overlay */}
                    {isUsed && (
                      <div className="absolute inset-0 bg-green-600 bg-opacity-20 flex items-center justify-center">
                        <div className="bg-green-600 text-white text-xs px-1 rounded font-medium">
                          Used
                        </div>
                      </div>
                    )}
                  </div>
                
                {/* Remove button on hover - conditional */}
                {showRemoveButtons && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveFavorite(photo.id);
                    }}
                    className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Remove from favorites"
                  >
                    ×
                  </button>
                )}
                
                {/* Star indicator */}
                <div className="absolute bottom-0 right-0 bg-yellow-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-sm">
                  ⭐
                </div>
                
                {/* Drag indicator on hover */}
                <div className="absolute top-1 left-1 bg-gray-800 bg-opacity-75 text-white rounded px-1 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                  Drag me
                </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }
}