import React, { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
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
  
  // Unified drag state for both mouse and touch
  const [isDragging, setIsDragging] = useState(false);
  const [draggingPhotoId, setDraggingPhotoId] = useState<string | null>(null);
  const [draggedPhoto, setDraggedPhoto] = useState<Photo | null>(null);
  const [dragPosition, setDragPosition] = useState<{x: number, y: number} | null>(null);
  const dragStartPos = useRef<{x: number, y: number} | null>(null);
  const dragThreshold = 25; // pixels to move before starting drag (increased for better scroll support)
  const verticalBias = 0.6; // require 60% vertical movement to trigger drag
  
  // HTML5 drag handlers for desktop
  const handleDragStart = (e: React.DragEvent, photo: Photo) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('photoId', photo.id);
    e.dataTransfer.setData('photoUrl', photo.thumbnailUrl || photo.url);
    e.dataTransfer.setData('photoName', photo.name);
    
    setDraggingPhotoId(photo.id);
    
    if (onDragStart) {
      onDragStart(photo);
    }
    
    console.log('🖱️ Desktop drag started:', photo.name);
  };
  
  const handleDragEnd = () => {
    setDraggingPhotoId(null);
    if (onDragEnd) {
      onDragEnd();
    }
    console.log('🖱️ Desktop drag ended');
  };
  
  // Pointer event handlers for mobile (and desktop fallback)
  const handlePointerDown = (e: React.PointerEvent, photo: Photo) => {
    // Don't capture pointer immediately - let scroll work first
    // Only capture after we confirm this is a drag gesture
    
    // Store initial position
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    
    // Store photo data for potential drag
    setDraggedPhoto(photo);
    
    // Store in window for drop detection
    (window as any).draggedPhoto = photo;
    
    console.log('👆 Pointer down on photo:', photo.name);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartPos.current || !draggedPhoto) return;
    
    const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
    const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
    const totalDelta = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Only start drag if:
    // 1. Movement is beyond threshold AND
    // 2. Movement is primarily vertical (verticalBias) OR significant total movement
    const isVerticalGesture = deltaY > deltaX * verticalBias;
    const isSignificantMovement = totalDelta > dragThreshold;
    
    if (!isDragging && isSignificantMovement && isVerticalGesture) {
      // NOW capture the pointer since we confirmed this is a drag
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      
      e.preventDefault();
      setIsDragging(true);
      setDraggingPhotoId(draggedPhoto.id);
      setDragPosition({ x: e.clientX, y: e.clientY });
      
      if (onDragStart) {
        onDragStart(draggedPhoto);
      }
      
      console.log('🎯 Drag started for:', draggedPhoto.name, { deltaX, deltaY, isVerticalGesture });
    }
    
    // Update position if dragging
    if (isDragging) {
      e.preventDefault();
      setDragPosition({ x: e.clientX, y: e.clientY });
      
      // Store current position for drop detection
      (window as any).currentDragPos = { x: e.clientX, y: e.clientY };
    }
  };
  
  const handlePointerUp = (e: React.PointerEvent) => {
    if (isDragging && draggedPhoto) {
      // Find element under pointer
      const dragPos = (window as any).currentDragPos || { x: e.clientX, y: e.clientY };
      const elementBelow = document.elementFromPoint(dragPos.x, dragPos.y);
      
      if (elementBelow) {
        // Trigger custom drop event
        const dropEvent = new CustomEvent('customdrop', {
          detail: { photo: draggedPhoto },
          bubbles: true
        });
        elementBelow.dispatchEvent(dropEvent);
      }
      
      console.log('🎯 Drag ended');
    } else if (draggedPhoto && !isDragging) {
      // It was just a tap/click, not a drag
      onPhotoClick(draggedPhoto);
    }
    
    // Cleanup
    setIsDragging(false);
    setDraggingPhotoId(null);
    setDraggedPhoto(null);
    setDragPosition(null);
    dragStartPos.current = null;
    delete (window as any).draggedPhoto;
    delete (window as any).currentDragPos;
    
    if (onDragEnd) {
      onDragEnd();
    }
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
          height: '200px'
        }}
      >
        <div className="h-full flex flex-col">
          {/* Header section with title */}
          <div className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-gray-700 border-b border-gray-200">
            Favorites ({favoritedPhotos.length}) - Drag photos to template slots
          </div>
          
          {/* Photos section - takes remaining space */}
          <div className="flex-1 overflow-x-auto flex items-center">
            <div className="flex px-3 space-x-4 py-2" style={{ touchAction: 'pan-x' }}>
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
                    onPointerDown={(e) => handlePointerDown(e, photo)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    style={{ touchAction: 'pan-x' }} // Allow horizontal scrolling
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
        
        {/* Unified drag preview - rendered as portal to avoid overflow clipping */}
        {isDragging && draggedPhoto && dragPosition && ReactDOM.createPortal(
          <div
            className="fixed pointer-events-none z-[9999]"
            style={{
              left: dragPosition.x - 60,
              top: dragPosition.y - 80,
              width: '120px',
              height: '160px'
            }}
          >
            <div className="border-2 border-blue-500 rounded-lg overflow-hidden shadow-2xl opacity-90">
              <img
                src={draggedPhoto.thumbnailUrl || draggedPhoto.url}
                alt={draggedPhoto.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
              Dragging...
            </div>
          </div>,
          document.body
        )}
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
                  onPointerDown={(e) => handlePointerDown(e, photo)}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerUp}
                  style={{ touchAction: 'pan-x', aspectRatio: '3/4' }} // Allow horizontal scrolling
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
        
        {/* Unified drag preview - rendered as portal to avoid overflow clipping */}
        {isDragging && draggedPhoto && dragPosition && ReactDOM.createPortal(
          <div
            className="fixed pointer-events-none z-[9999]"
            style={{
              left: dragPosition.x - 60,
              top: dragPosition.y - 80,
              width: '120px',
              height: '160px'
            }}
          >
            <div className="border-2 border-blue-500 rounded-lg overflow-hidden shadow-2xl opacity-90">
              <img
                src={draggedPhoto.thumbnailUrl || draggedPhoto.url}
                alt={draggedPhoto.name}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-2 py-1 rounded text-xs whitespace-nowrap">
              Dragging...
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
}