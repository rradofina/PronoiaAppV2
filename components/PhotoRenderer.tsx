import React, { useState, useRef, useEffect } from 'react';
import { PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform, createPhotoTransform, getPhotoTransformBounds } from '../types';
import { getHighResPhotoUrls } from '../utils/photoUrlUtils';

interface PhotoRendererProps {
  photoUrl: string;
  photoAlt?: string;
  transform?: PhotoTransform | ContainerTransform;
  
  // Interaction mode
  interactive?: boolean;
  onTransformChange?: (transform: PhotoTransform) => void;
  
  // Container styling
  className?: string;
  style?: React.CSSProperties;
  
  // Debug mode
  debug?: boolean;
  
  // Optional fallback URLs for error handling
  fallbackUrls?: string[];
}

// Helper to convert legacy container transforms to CSS (backward compatibility)
function convertLegacyToCSS(containerTransform: ContainerTransform): React.CSSProperties {
  return {
    transform: `translate(${containerTransform.x}px, ${containerTransform.y}px) scale(${containerTransform.scale})`,
    transformOrigin: 'center center',
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    // Improve image quality
    imageRendering: 'auto' as const,
    // Ensure smooth scaling
    backfaceVisibility: 'hidden' as const,
    // Force hardware acceleration for smoother transforms
    willChange: 'transform' as const,
  };
}

// Convert photo-centric transform to CSS
function convertPhotoToCSS(photoTransform: PhotoTransform): React.CSSProperties {
  // Simple direct conversion - photoCenterX/Y represent the center point of the visible area
  // photoScale represents zoom level relative to "fit" size
  
  // Calculate translation to center the desired point
  // photoCenterX: 0.5 = center, 0.0 = left edge, 1.0 = right edge
  // We want to translate so that point becomes the center of the viewport
  const translateX = (0.5 - photoTransform.photoCenterX) * 100; // Percentage of photo width
  const translateY = (0.5 - photoTransform.photoCenterY) * 100; // Percentage of photo height
  
  return {
    transform: `translate(${translateX}%, ${translateY}%) scale(${photoTransform.photoScale})`,
    transformOrigin: 'center center',
    width: '100%',
    height: '100%',
    objectFit: 'cover' as const,
    // Improve image quality
    imageRendering: 'auto' as const,
    // Ensure smooth scaling
    backfaceVisibility: 'hidden' as const,
    // Force hardware acceleration for smoother transforms
    willChange: 'transform' as const,
  };
}

export default function PhotoRenderer({
  photoUrl,
  photoAlt = 'Photo',
  transform,
  interactive = false,
  onTransformChange,
  className = '',
  style = {},
  debug = false,
  fallbackUrls = []
}: PhotoRendererProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [lastPointer, setLastPointer] = useState<{ x: number; y: number } | null>(null);
  
  // Touch handling state for pinch-to-zoom
  const [lastTouchDistance, setLastTouchDistance] = useState<number>(0);
  const [isTouching, setIsTouching] = useState(false);
  
  // URL fallback management
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [currentTransform, setCurrentTransform] = useState<PhotoTransform>(
    transform && isPhotoTransform(transform) 
      ? transform 
      : createPhotoTransform(1, 0.5, 0.5) // Default: fit scale, centered
  );
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Update internal transform when prop changes
  useEffect(() => {
    if (transform && isPhotoTransform(transform)) {
      setCurrentTransform(transform);
    }
  }, [transform]);
  
  // Reset URL state when photoUrl changes
  useEffect(() => {
    setCurrentUrlIndex(0);
    setImageError(false);
    setImageLoaded(false);
  }, [photoUrl]);
  
  // Get all available URLs (main + fallbacks)
  const getAllUrls = (): string[] => {
    const urls = [photoUrl, ...fallbackUrls].filter(Boolean);
    return [...new Set(urls)]; // Remove duplicates
  };
  
  // Get current URL to display
  const getCurrentUrl = (): string => {
    const allUrls = getAllUrls();
    return allUrls[currentUrlIndex] || photoUrl;
  };
  
  // Handle image load error - try next URL
  const handleImageError = () => {
    const allUrls = getAllUrls();
    
    if (debug) {
      console.error(`❌ PhotoRenderer - Image failed to load (${currentUrlIndex + 1}/${allUrls.length}):`, {
        url: getCurrentUrl(),
        photoUrl,
        fallbackUrls
      });
    }
    
    if (currentUrlIndex < allUrls.length - 1) {
      console.log(`🔄 PhotoRenderer - Trying fallback URL ${currentUrlIndex + 2}/${allUrls.length}`);
      setCurrentUrlIndex(prev => prev + 1);
      setImageError(false);
      setImageLoaded(false);
    } else {
      console.error('💥 PhotoRenderer - All URLs failed');
      setImageError(true);
      setImageLoaded(false);
    }
  };
  
  // Handle successful image load
  const handleImageLoad = () => {
    if (debug) {
      console.log(`✅ PhotoRenderer - Image loaded successfully (${currentUrlIndex + 1}/${getAllUrls().length}):`, {
        url: getCurrentUrl(),
        naturalSize: imageRef.current ? {
          width: imageRef.current.naturalWidth,
          height: imageRef.current.naturalHeight
        } : 'unknown'
      });
    }
    setImageLoaded(true);
    setImageError(false);
  };

  // Calculate CSS style for the photo
  const photoStyle: React.CSSProperties = transform && isPhotoTransform(transform)
    ? convertPhotoToCSS(transform)
    : transform && isContainerTransform(transform)
    ? convertLegacyToCSS(transform)
    : convertPhotoToCSS(currentTransform);

  // Touch helper functions for pinch-to-zoom
  const getTouchDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  // Touch event handlers for pinch-to-zoom
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!interactive) return;
    
    // Prevent browser zoom/scroll for all interactive touches
    e.preventDefault();
    e.stopPropagation();
    
    setIsTouching(true);
    
    if (e.touches.length === 2) {
      // Two finger pinch - start zoom
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1) {
      // Single finger - start drag
      setIsDragging(true);
      const touch = e.touches[0];
      setLastPointer({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!interactive || !isTouching) return;
    
    // Stronger prevention for Chrome mobile
    e.preventDefault();
    e.stopPropagation();
    
    if (e.touches.length === 2 && lastTouchDistance > 0) {
      // Two finger pinch - handle zoom
      const distance = getTouchDistance(e.touches);
      const ratio = distance / lastTouchDistance;
      const newScale = Math.max(0.1, Math.min(10, currentTransform.photoScale * ratio));
      
      const newTransform = createPhotoTransform(
        newScale,
        currentTransform.photoCenterX,
        currentTransform.photoCenterY
      );
      
      setCurrentTransform(newTransform);
      onTransformChange?.(newTransform);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging && lastPointer && containerRef.current) {
      // Single finger - handle drag
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastPointer.x;
      const deltaY = touch.clientY - lastPointer.y;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const normalizedDeltaX = deltaX / containerRect.width;
      const normalizedDeltaY = deltaY / containerRect.height;
      
      const newCenterX = Math.max(0, Math.min(1, currentTransform.photoCenterX - normalizedDeltaX));
      const newCenterY = Math.max(0, Math.min(1, currentTransform.photoCenterY - normalizedDeltaY));
      
      const newTransform = createPhotoTransform(
        currentTransform.photoScale,
        newCenterX,
        newCenterY
      );
      
      setCurrentTransform(newTransform);
      onTransformChange?.(newTransform);
      setLastPointer({ x: touch.clientX, y: touch.clientY });
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!interactive) return;
    
    // Prevent any residual browser behavior
    e.preventDefault();
    e.stopPropagation();
    
    if (e.touches.length === 0) {
      // All fingers lifted
      setIsTouching(false);
      setIsDragging(false);
      setLastPointer(null);
      setLastTouchDistance(0);
    } else if (e.touches.length === 1) {
      // One finger remaining - switch to drag mode
      setLastTouchDistance(0);
      const touch = e.touches[0];
      setLastPointer({ x: touch.clientX, y: touch.clientY });
      setIsDragging(true);
    }
  };

  // Interactive handlers (only active if interactive=true)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    
    e.preventDefault();
    setIsDragging(true);
    setLastPointer({ x: e.clientX, y: e.clientY });
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!interactive || !isDragging || !lastPointer || !containerRef.current) return;
    
    e.preventDefault();
    
    // Calculate movement delta
    const deltaX = e.clientX - lastPointer.x;
    const deltaY = e.clientY - lastPointer.y;
    
    // Convert pixel movement to photo coordinate movement
    const containerRect = containerRef.current.getBoundingClientRect();
    const movementX = (deltaX / containerRect.width) / currentTransform.photoScale;
    const movementY = (deltaY / containerRect.height) / currentTransform.photoScale;
    
    // Update transform with zoom-aware bounds
    const bounds = getPhotoTransformBounds(currentTransform.photoScale);
    const newTransform = createPhotoTransform(
      currentTransform.photoScale,
      Math.max(bounds.min, Math.min(bounds.max, currentTransform.photoCenterX - movementX)),
      Math.max(bounds.min, Math.min(bounds.max, currentTransform.photoCenterY - movementY))
    );
    
    setCurrentTransform(newTransform);
    onTransformChange?.(newTransform);
    setLastPointer({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!interactive) return;
    
    setIsDragging(false);
    setLastPointer(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    
    e.preventDefault();
    
    // Scale factor for zoom
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(10, currentTransform.photoScale * scaleFactor));
    
    const newTransform = createPhotoTransform(
      newScale,
      currentTransform.photoCenterX,
      currentTransform.photoCenterY
    );
    
    setCurrentTransform(newTransform);
    onTransformChange?.(newTransform);
  };

  // Debug info
  const debugInfo = debug ? (
    <div className="absolute top-2 left-2 bg-black bg-opacity-75 text-white text-xs p-2 rounded z-50 pointer-events-none">
      <div>Scale: {currentTransform.photoScale.toFixed(2)}</div>
      <div>Center X: {currentTransform.photoCenterX.toFixed(3)}</div>
      <div>Center Y: {currentTransform.photoCenterY.toFixed(3)}</div>
      <div>Interactive: {interactive ? 'Yes' : 'No'}</div>
      <div>Dragging: {isDragging ? 'Yes' : 'No'}</div>
      <div>Touching: {isTouching ? 'Yes' : 'No'}</div>
      <div>Touch Distance: {lastTouchDistance.toFixed(0)}</div>
    </div>
  ) : null;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden ${className}`}
      style={{
        ...style,
        touchAction: interactive ? 'none' : 'auto' // Prevent browser zoom when interactive
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <img
        ref={imageRef}
        key={`${photoUrl}-${currentUrlIndex}`} // Force re-render when URL changes
        src={getCurrentUrl()}
        alt={photoAlt}
        className="absolute inset-0"
        style={{
          ...photoStyle,
          // Improve image quality
          imageRendering: 'auto',
          backfaceVisibility: 'hidden',
          // Show/hide based on load state
          display: imageLoaded && !imageError ? 'block' : 'none'
        }}
        draggable={false}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {/* Loading/Error state */}
      {(!imageLoaded || imageError) && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <div className="text-center text-gray-500">
            <div className="text-2xl mb-2">
              {imageError ? '❌' : '⏳'}
            </div>
            <p className="text-xs">
              {imageError ? 'Failed to load' : 'Loading...'}
            </p>
            {imageError && debug && (
              <div className="mt-2 text-xs">
                <p>Tried {getAllUrls().length} URLs</p>
                <button 
                  onClick={() => {
                    setCurrentUrlIndex(0);
                    setImageError(false);
                    setImageLoaded(false);
                  }}
                  className="mt-1 px-2 py-1 bg-blue-500 text-white rounded text-xs"
                >
                  Retry
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      {debugInfo}
    </div>
  );
}

// Export utility functions for use in other components
export { convertPhotoToCSS, convertLegacyToCSS };