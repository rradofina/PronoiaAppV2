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
  
  // Clipping indicators (zebra stripes) for overexposed/underexposed areas
  showClippingIndicators?: boolean;
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
  fallbackUrls = [],
  showClippingIndicators = false
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
  
  // Auto-snap state for smooth zoom corrections
  const [isSnapping, setIsSnapping] = useState(false);
  
  // Removed timeout reference - no more auto-corrections
  
  // Clipping detection state
  const [clippingData, setClippingData] = useState<{
    overexposed: ImageData | null;
    underexposed: ImageData | null;
  }>({ overexposed: null, underexposed: null });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Calculate the absolute minimum zoom needed to cover the container
  const calculateMinimumCoverZoom = (): number => {
    if (!imageRef.current || !containerRef.current) {
      return 0.5; // More permissive default
    }
    
    const photoWidth = imageRef.current.naturalWidth;
    const photoHeight = imageRef.current.naturalHeight;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    if (photoWidth === 0 || photoHeight === 0 || containerRect.width === 0 || containerRect.height === 0) {
      return 0.5; // More permissive fallback
    }
    
    const photoAspectRatio = photoWidth / photoHeight;
    const containerAspectRatio = containerRect.width / containerRect.height;
    
    // Calculate the absolute minimum scale needed to cover the container
    // This is the scale where photo edges align with container edges
    let coverScale: number;
    
    if (photoAspectRatio > containerAspectRatio) {
      // Photo is wider - need to scale to cover height
      coverScale = 1.0;
    } else {
      // Photo is taller - need to scale to cover width
      coverScale = 1.0;
    }
    
    // Only enforce this minimum if photo would show empty space
    return coverScale;
  };

  // Removed all empty space detection - user has complete control

  // Removed all boundary correction logic - user has complete control

  // Analyze image for clipping (overexposed/underexposed areas)
  const analyzeClipping = () => {
    if (!showClippingIndicators || !imageRef.current || !canvasRef.current) {
      return;
    }

    const img = imageRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx || !img.complete || img.naturalWidth === 0) {
      return;
    }

    // Set canvas size to match image natural dimensions (but scaled down for performance)
    const maxSize = 512; // Limit canvas size for performance
    const aspectRatio = img.naturalWidth / img.naturalHeight;
    let canvasWidth, canvasHeight;
    
    if (aspectRatio > 1) {
      canvasWidth = Math.min(maxSize, img.naturalWidth);
      canvasHeight = canvasWidth / aspectRatio;
    } else {
      canvasHeight = Math.min(maxSize, img.naturalHeight);
      canvasWidth = canvasHeight * aspectRatio;
    }
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    // Draw image to canvas for pixel analysis
    ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
    
    try {
      const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
      const data = imageData.data;
      
      // Create masks for overexposed and underexposed areas
      const overexposedMask = new ImageData(canvasWidth, canvasHeight);
      const underexposedMask = new ImageData(canvasWidth, canvasHeight);
      
      // Thresholds for clipping detection
      const overexposeThreshold = 250; // RGB values above this are considered clipped
      const underexposeThreshold = 5;   // RGB values below this are considered clipped
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Check for overexposed areas (highlights clipped to white)
        if (r >= overexposeThreshold && g >= overexposeThreshold && b >= overexposeThreshold) {
          overexposedMask.data[i] = 255;     // Red channel
          overexposedMask.data[i + 1] = 0;   // Green channel  
          overexposedMask.data[i + 2] = 0;   // Blue channel
          overexposedMask.data[i + 3] = 180; // Alpha (semi-transparent)
        }
        
        // Check for underexposed areas (shadows clipped to black)
        if (r <= underexposeThreshold && g <= underexposeThreshold && b <= underexposeThreshold) {
          underexposedMask.data[i] = 0;      // Red channel
          underexposedMask.data[i + 1] = 0;  // Green channel
          underexposedMask.data[i + 2] = 255; // Blue channel  
          underexposedMask.data[i + 3] = 180; // Alpha (semi-transparent)
        }
      }
      
      setClippingData({
        overexposed: overexposedMask,
        underexposed: underexposedMask
      });
      
    } catch (error) {
      console.warn('Failed to analyze image clipping:', error);
    }
  };

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
    setClippingData({ overexposed: null, underexposed: null }); // Reset clipping data
  }, [photoUrl]);
  
  // Analyze clipping when image loads and clipping indicators are enabled
  useEffect(() => {
    if (imageLoaded && showClippingIndicators) {
      // Small delay to ensure image is fully rendered
      setTimeout(analyzeClipping, 100);
    }
  }, [imageLoaded, showClippingIndicators]);

  // No timeout cleanup needed - removed auto-corrections
  
  // ClippingOverlay component - displays zebra stripes for clipped areas
  const ClippingOverlay = () => {
    if (!showClippingIndicators || (!clippingData.overexposed && !clippingData.underexposed)) {
      return null;
    }
    
    return (
      <div className="absolute inset-0 pointer-events-none" style={{ ...photoStyle }}>
        {/* Hidden canvas for clipping analysis */}
        <canvas
          ref={canvasRef}
          style={{ display: 'none' }}
        />
        
        {/* Animated zebra stripes for overexposed areas (red) */}
        {clippingData.overexposed && (
          <div 
            className="absolute inset-0 opacity-70"
            style={{
              background: `repeating-linear-gradient(
                45deg,
                transparent,
                transparent 4px,
                rgba(255, 0, 0, 0.8) 4px,
                rgba(255, 0, 0, 0.8) 8px
              )`,
              animation: 'zebra-stripes 1s linear infinite',
              maskImage: 'url(data:image/svg+xml;base64,data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiB2aWV3Qm94PSIwIDAgMTAwIDEwMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjEwMCIgaGVpZ2h0PSIxMDAiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=)'
            }}
          />
        )}
        
        {/* Animated zebra stripes for underexposed areas (blue) */}
        {clippingData.underexposed && (
          <div 
            className="absolute inset-0 opacity-70"
            style={{
              background: `repeating-linear-gradient(
                -45deg,
                transparent,
                transparent 4px,
                rgba(0, 100, 255, 0.8) 4px,
                rgba(0, 100, 255, 0.8) 8px
              )`,
              animation: 'zebra-stripes 1.2s linear infinite reverse',
            }}
          />
        )}
      </div>
    );
  };
  
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
    : {
        ...convertPhotoToCSS(currentTransform),
        // Add smooth spring animation when auto-fitting
        transition: isSnapping ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none'
      };

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
      const minCoverZoom = calculateMinimumCoverZoom();
      const absoluteMinZoom = Math.max(0.1, minCoverZoom * 0.3); // More permissive minimum for pinch
      const newScale = Math.max(absoluteMinZoom, Math.min(10, currentTransform.photoScale * ratio));
      
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
      // All fingers lifted - just clean up state, no auto-corrections
      setIsTouching(false);
      setIsDragging(false);
      setLastPointer(null);
      setLastTouchDistance(0);
      
      // No auto-corrections - user has complete control over positioning
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
    
    // No auto-corrections - user has complete control over positioning
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    
    e.preventDefault();
    
    // Scale factor for zoom
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const minCoverZoom = calculateMinimumCoverZoom();
    
    // Allow zooming below cover minimum temporarily, but limit extreme zoom out
    const absoluteMinZoom = Math.max(0.1, minCoverZoom * 0.5);
    let newScale = Math.max(absoluteMinZoom, Math.min(10, currentTransform.photoScale * scaleFactor));
    
    const newTransform = createPhotoTransform(
      newScale,
      currentTransform.photoCenterX,
      currentTransform.photoCenterY
    );
    
    setCurrentTransform(newTransform);
    onTransformChange?.(newTransform);
    
    // No immediate auto-fit - let user zoom freely without interference
  };

  // Debug info (simplified - no boundary detection)
  const debugInfo = debug ? (
    <div className="absolute top-2 left-2 bg-black bg-opacity-90 text-white text-xs p-3 rounded z-50 pointer-events-none max-w-xs">
      <div className="font-bold mb-2">Photo Renderer Debug</div>
      <div>Scale: {currentTransform.photoScale.toFixed(2)}</div>
      <div>Center X: {currentTransform.photoCenterX.toFixed(3)}</div>
      <div>Center Y: {currentTransform.photoCenterY.toFixed(3)}</div>
      <div>Interactive: {interactive ? 'Yes' : 'No'}</div>
      <div>Dragging: {isDragging ? 'Yes' : 'No'}</div>
      <div>Touching: {isTouching ? 'Yes' : 'No'}</div>
      <div>Mode: User Control (No Auto-Snap)</div>
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
      
      {/* Clipping indicators overlay */}
      <ClippingOverlay />
      
      {debugInfo}
    </div>
  );
}

// Export utility functions for use in other components
export { convertPhotoToCSS, convertLegacyToCSS };