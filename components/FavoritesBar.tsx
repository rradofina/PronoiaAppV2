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
  selectionMode?: 'photo' | 'print';
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
  onDragEnd,
  selectionMode = 'print'
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
  
  // Gesture detection state for smart scrolling vs dragging
  const [gestureMode, setGestureMode] = useState<'undecided' | 'swipe' | 'drag' | null>(null);
  const touchStartTime = useRef<number>(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollLeft = useRef<number>(0);
  
  // ChatGPT's optimized cone detection constants
  const TOUCH_SLOP = 10; // px before deciding
  const SWIPE_LOCK_DEG = 15; // degrees to enter swipe mode
  const SWIPE_UNLOCK_DEG = 25; // degrees to exit swipe mode (hysteresis)
  const K_LOCK = Math.tan((SWIPE_LOCK_DEG * Math.PI) / 180); // ~0.268
  const K_UNLOCK = Math.tan((SWIPE_UNLOCK_DEG * Math.PI) / 180); // ~0.466
  
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
    
    if (process.env.NODE_ENV === 'development') console.log('🖱️ Desktop drag started:', photo.name);
  };
  
  const handleDragEnd = () => {
    setDraggingPhotoId(null);
    if (onDragEnd) {
      onDragEnd();
    }
    if (process.env.NODE_ENV === 'development') console.log('🖱️ Desktop drag ended');
  };
  
  // Pointer event handlers for mobile (and desktop fallback)
  const handlePointerDown = (e: React.PointerEvent, photo: Photo) => {
    // Don't capture pointer immediately - let scroll work first
    // Only capture after we confirm this is a drag gesture
    
    // Store initial position and time
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    touchStartTime.current = Date.now();
    
    // Store initial scroll position
    if (scrollContainerRef.current) {
      initialScrollLeft.current = scrollContainerRef.current.scrollLeft;
    }
    
    // Store photo data for potential drag
    setDraggedPhoto(photo);
    
    // Reset gesture mode
    setGestureMode('undecided');
    
    // Store in window for drop detection
    (window as any).draggedPhoto = photo;
    
    if (process.env.NODE_ENV === 'development') console.log('👆 Pointer down on photo:', photo.name);
  };
  
  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartPos.current || !draggedPhoto) return;
    
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const totalDistance = Math.sqrt(dx * dx + dy * dy);
    
    // ONLY decide mode if still undecided - never re-evaluate
    if (gestureMode === 'undecided') {
      // Check for meaningful movement first
      if (adx >= TOUCH_SLOP || ady >= TOUCH_SLOP) {
        // Immediate decision based on angle
        if (ady <= adx * K_LOCK) {
          // Movement is within ±15° of horizontal - SWIPE MODE
          setGestureMode('swipe');
          if (process.env.NODE_ENV === 'development') console.log(`↔️ Swipe mode (ratio: ${(ady/adx).toFixed(2)})`);
          
          // Release pointer capture for smooth scrolling
          try {
            (e.target as HTMLElement).releasePointerCapture(e.pointerId);
          } catch (err) {
            // Already released
          }
        } else {
          // Movement is outside horizontal cone - DRAG MODE (immediate!)
          setGestureMode('drag');
          if (process.env.NODE_ENV === 'development') console.log(`🎯 Drag mode (ratio: ${adx > 0 ? (ady/adx).toFixed(2) : 'vertical'})`);
        }
      } 
      // Long-press fallback ONLY for stationary/micro movements
      else if (totalDistance < 5) {
        const timeDelta = Date.now() - touchStartTime.current;
        if (timeDelta > 500) {
          setGestureMode('drag');
          if (process.env.NODE_ENV === 'development') console.log('🕐 Long press (stationary) - drag mode');
        }
      }
      // Still undecided - waiting for more movement
      return;
    }
    
    // LOCKED MODES - no re-evaluation after decision
    
    // Handle swipe mode (horizontal scrolling)
    if (gestureMode === 'swipe') {
      // Just update scroll - no angle rechecking
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollLeft = initialScrollLeft.current - dx;
      }
      return;
    }
    
    // Handle drag mode (photo dragging)
    if (gestureMode === 'drag') {
      // Start actual drag if not already dragging
      if (!isDragging) {
        e.preventDefault();
        setIsDragging(true);
        setDraggingPhotoId(draggedPhoto.id);
        setDragPosition({ x: e.clientX, y: e.clientY });
        
        if (onDragStart) {
          onDragStart(draggedPhoto);
        }
        
        if (process.env.NODE_ENV === 'development') console.log('📦 Photo drag active');
      }
      
      // Update drag position
      if (isDragging) {
        e.preventDefault();
        setDragPosition({ x: e.clientX, y: e.clientY });
        
        // Store position for drop detection
        (window as any).currentDragPos = { x: e.clientX, y: e.clientY };
      }
    }
  };
  
  const handlePointerUp = (e: React.PointerEvent) => {
    // Release pointer capture if we had it
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch (err) {
      // Ignore if pointer wasn't captured
    }
    
    if (isDragging && draggedPhoto) {
      // Find element under pointer for drop
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
      
      if (process.env.NODE_ENV === 'development') console.log('✅ Drag completed');
    } else if (draggedPhoto && !isDragging && gestureMode !== 'swipe') {
      // It was just a tap/click, not a drag or swipe
      // Only auto-click in print mode (fill templates)
      if (selectionMode !== 'photo') {
        onPhotoClick(draggedPhoto);
      }
    }
    
    // Velocity-based swipe navigation
    if (gestureMode === 'swipe' && scrollContainerRef.current && dragStartPos.current) {
      const dx = e.clientX - dragStartPos.current.x;
      const dt = Date.now() - touchStartTime.current;
      const velocity = dt > 0 ? dx / dt : 0; // px/ms
      const containerWidth = scrollContainerRef.current.offsetWidth;
      
      // Snap logic: if moved > 1/3 width OR velocity > 0.8 px/ms
      if (Math.abs(dx) > containerWidth / 3 || Math.abs(velocity) > 0.8) {
        const currentScroll = scrollContainerRef.current.scrollLeft;
        const photoWidth = 160; // Approximate width of each photo + gap
        
        if (dx < 0) {
          // Swiped left - scroll right
          const targetScroll = Math.ceil(currentScroll / photoWidth) * photoWidth;
          scrollContainerRef.current.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
          });
          if (process.env.NODE_ENV === 'development') console.log(`⏩ Fast swipe right (velocity: ${velocity.toFixed(2)})`);
        } else {
          // Swiped right - scroll left
          const targetScroll = Math.floor(currentScroll / photoWidth) * photoWidth;
          scrollContainerRef.current.scrollTo({
            left: targetScroll,
            behavior: 'smooth'
          });
          if (process.env.NODE_ENV === 'development') console.log(`⏪ Fast swipe left (velocity: ${velocity.toFixed(2)})`);
        }
      }
    }
    
    // Cleanup
    setIsDragging(false);
    setDraggingPhotoId(null);
    setDraggedPhoto(null);
    setDragPosition(null);
    setGestureMode(null);
    dragStartPos.current = null;
    touchStartTime.current = 0;
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
          <div 
            className="flex-1 overflow-x-auto flex items-center" 
            ref={scrollContainerRef}
            style={{ touchAction: 'pan-x' }}
          >
            <div className="flex px-3 space-x-4 py-2">
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
                    onPointerCancel={handlePointerUp}
                    style={{ 
                      touchAction: gestureMode === 'swipe' ? 'pan-x' : gestureMode === 'drag' ? 'none' : 'auto'
                    }}
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
                  
                  {/* View button or drag indicator on hover */}
                  {selectionMode === 'photo' ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPhotoClick(photo);
                      }}
                      className="absolute top-1 left-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-1.5 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-all"
                    >
                      View
                    </button>
                  ) : (
                    <div className="absolute top-1 left-1 bg-gray-800 bg-opacity-75 text-white rounded px-1 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      Drag me
                    </div>
                  )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        
        {/* Enhanced drag preview with scale and shadow */}
        {isDragging && draggedPhoto && dragPosition && ReactDOM.createPortal(
          <div
            className="fixed pointer-events-none z-[9999]"
            style={{
              left: dragPosition.x - 66,
              top: dragPosition.y - 88,
              width: '132px',
              height: '176px',
              transform: 'scale(1.1)',
              filter: 'drop-shadow(0 20px 25px rgba(0,0,0,0.3))'
            }}
          >
            <div className="border-2 border-blue-500 rounded-lg overflow-hidden bg-white">
              <img
                src={draggedPhoto.thumbnailUrl || draggedPhoto.url}
                alt={draggedPhoto.name}
                className="w-full h-full object-cover"
                style={{ opacity: 0.95 }}
              />
            </div>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs whitespace-nowrap shadow-lg">
              Drop on template
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
                
                {/* View button or drag indicator on hover */}
                {selectionMode === 'photo' ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onPhotoClick(photo);
                    }}
                    className="absolute top-1 left-1 bg-blue-600 hover:bg-blue-700 text-white rounded px-1.5 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-all"
                  >
                    View
                  </button>
                ) : (
                  <div className="absolute top-1 left-1 bg-gray-800 bg-opacity-75 text-white rounded px-1 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                    Drag me
                  </div>
                )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Enhanced drag preview with scale and shadow */}
        {isDragging && draggedPhoto && dragPosition && ReactDOM.createPortal(
          <div
            className="fixed pointer-events-none z-[9999]"
            style={{
              left: dragPosition.x - 66,
              top: dragPosition.y - 88,
              width: '132px',
              height: '176px',
              transform: 'scale(1.1)',
              filter: 'drop-shadow(0 20px 25px rgba(0,0,0,0.3))'
            }}
          >
            <div className="border-2 border-blue-500 rounded-lg overflow-hidden bg-white">
              <img
                src={draggedPhoto.thumbnailUrl || draggedPhoto.url}
                alt={draggedPhoto.name}
                className="w-full h-full object-cover"
                style={{ opacity: 0.95 }}
              />
            </div>
            <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1.5 rounded-full text-xs whitespace-nowrap shadow-lg">
              Drop on template
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
}