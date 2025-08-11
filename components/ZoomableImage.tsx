import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ZoomableImageProps {
  lowResSrc: string;
  highResSrc: string;
  alt: string;
  className?: string;
  onZoomChange?: (isZoomed: boolean) => void;
  imageCache?: React.MutableRefObject<Map<string, { url: string; loaded: boolean }>>;
  photoId?: string;
}

interface Transform {
  scale: number;
  x: number;
  y: number;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const ZOOM_SPEED = 0.002; // Mouse wheel zoom speed
const PINCH_SPEED = 0.02; // Touch pinch zoom speed

export default function ZoomableImage({ 
  lowResSrc,
  highResSrc, 
  alt, 
  className = '',
  onZoomChange,
  imageCache,
  photoId
}: ZoomableImageProps) {
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [isPinching, setIsPinching] = useState(false);
  
  // Progressive loading state
  const [currentSrc, setCurrentSrc] = useState(() => {
    // Check cache first
    if (imageCache && photoId) {
      const cached = imageCache.current.get(photoId);
      if (cached?.loaded) return cached.url;
    }
    return lowResSrc;
  });
  const [isHighResLoaded, setIsHighResLoaded] = useState(() => {
    if (imageCache && photoId) {
      const cached = imageCache.current.get(photoId);
      return cached?.loaded || false;
    }
    return false;
  });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Touch gesture tracking
  const touchStartRef = useRef<{ x: number; y: number; distance?: number }>();
  const lastTouchRef = useRef<{ x: number; y: number }>();
  const lastTapRef = useRef<number>(0);
  const initialPinchDistance = useRef<number>(0);
  const initialScale = useRef<number>(1);
  
  // Mouse tracking
  const mouseStartRef = useRef<{ x: number; y: number }>();
  const lastTransformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  
  // Animation frame for smooth updates
  const animationFrameRef = useRef<number>();
  const targetTransformRef = useRef<Transform>({ scale: 1, x: 0, y: 0 });
  const lastZoomState = useRef<boolean>(false);
  
  // Load high-res image in background
  useEffect(() => {
    if (currentSrc === highResSrc) return; // Already loaded
    
    const img = new Image();
    img.src = highResSrc;
    img.onload = () => {
      setCurrentSrc(highResSrc);
      setIsHighResLoaded(true);
      
      // Cache it
      if (imageCache && photoId) {
        imageCache.current.set(photoId, { url: highResSrc, loaded: true });
      }
    };
    
    return () => {
      img.onload = null;
    };
  }, [highResSrc, currentSrc, imageCache, photoId]);
  
  // Smooth animation loop
  useEffect(() => {
    let animating = true;
    
    const animate = () => {
      if (!animating) return;
      
      const current = lastTransformRef.current;
      const target = targetTransformRef.current;
      
      // Smooth interpolation with easing
      const ease = 0.15; // Higher = faster response
      const newTransform = {
        scale: current.scale + (target.scale - current.scale) * ease,
        x: current.x + (target.x - current.x) * ease,
        y: current.y + (target.y - current.y) * ease,
      };
      
      // Update if there's significant change
      const threshold = 0.001;
      if (
        Math.abs(newTransform.scale - current.scale) > threshold ||
        Math.abs(newTransform.x - current.x) > threshold ||
        Math.abs(newTransform.y - current.y) > threshold
      ) {
        lastTransformRef.current = newTransform;
        setTransform(newTransform);
        
        // Check if zoom state changed (with small threshold for floating point)
        const isCurrentlyZoomed = newTransform.scale > 1.01;
        if (isCurrentlyZoomed !== lastZoomState.current) {
          lastZoomState.current = isCurrentlyZoomed;
          onZoomChange?.(isCurrentlyZoomed);
        }
      }
      
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    
    animate();
    
    return () => {
      animating = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [onZoomChange]);
  
  // Constrain pan to image bounds
  const constrainTransform = useCallback((t: Transform): Transform => {
    if (!containerRef.current || !imageRef.current) return t;
    
    const container = containerRef.current.getBoundingClientRect();
    const img = imageRef.current;
    
    // Clamp scale
    const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, t.scale));
    
    // If scale is 1 or less, reset to center
    if (scale <= 1.0) {
      return { scale: 1, x: 0, y: 0 };
    }
    
    const scaledWidth = img.naturalWidth * scale;
    const scaledHeight = img.naturalHeight * scale;
    
    // Calculate maximum pan distances
    const maxX = Math.max(0, (scaledWidth - container.width) / 2);
    const maxY = Math.max(0, (scaledHeight - container.height) / 2);
    
    return {
      scale,
      x: Math.min(maxX, Math.max(-maxX, t.x)),
      y: Math.min(maxY, Math.max(-maxY, t.y))
    };
  }, []);
  
  // Set target transform with constraints
  const setTargetTransform = useCallback((t: Transform) => {
    targetTransformRef.current = constrainTransform(t);
    // Zoom change is now handled in the animation loop for accuracy
  }, [constrainTransform]);
  
  // Reset zoom
  const resetZoom = useCallback(() => {
    setTargetTransform({ scale: 1, x: 0, y: 0 });
  }, [setTargetTransform]);
  
  // Get touch distance for pinch
  const getTouchDistance = (e: React.TouchEvent): number => {
    if (e.touches.length < 2) return 0;
    const dx = e.touches[0].clientX - e.touches[1].clientX;
    const dy = e.touches[0].clientY - e.touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  // Get touch center for pinch
  const getTouchCenter = (e: React.TouchEvent): { x: number; y: number } => {
    if (e.touches.length < 2) {
      return { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }
    return {
      x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
      y: (e.touches[0].clientY + e.touches[1].clientY) / 2
    };
  };
  
  // Handle touch start
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      // Single touch - check for double tap or start pan
      const now = Date.now();
      const timeSinceLastTap = now - lastTapRef.current;
      
      if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
        // Double tap detected
        e.preventDefault();
        const touch = e.touches[0];
        const rect = containerRef.current?.getBoundingClientRect();
        
        if (transform.scale > 1) {
          // Zoom out
          resetZoom();
        } else if (rect) {
          // Zoom in on tap point
          const x = touch.clientX - rect.left - rect.width / 2;
          const y = touch.clientY - rect.top - rect.height / 2;
          
          setTargetTransform({
            scale: DOUBLE_TAP_SCALE,
            x: -x * (DOUBLE_TAP_SCALE - 1),
            y: -y * (DOUBLE_TAP_SCALE - 1)
          });
        }
      } else if (transform.scale > 1) {
        // Start panning if zoomed
        setIsPanning(true);
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        lastTouchRef.current = { x: transform.x, y: transform.y };
      }
      
      lastTapRef.current = now;
    } else if (e.touches.length === 2) {
      // Start pinch zoom
      e.preventDefault();
      setIsPinching(true);
      initialPinchDistance.current = getTouchDistance(e);
      initialScale.current = transform.scale;
      const center = getTouchCenter(e);
      touchStartRef.current = { x: center.x, y: center.y, distance: initialPinchDistance.current };
      lastTouchRef.current = { x: transform.x, y: transform.y };
    }
  }, [transform, resetZoom, setTargetTransform]);
  
  // Handle touch move
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (isPinching && e.touches.length === 2) {
      e.preventDefault();
      
      const currentDistance = getTouchDistance(e);
      const center = getTouchCenter(e);
      
      // Calculate scale
      const scaleChange = currentDistance / initialPinchDistance.current;
      let newScale = initialScale.current * scaleChange;
      
      // Add some resistance when trying to zoom below 1
      if (newScale < 1) {
        // Apply rubber band effect
        const underScale = 1 - newScale;
        newScale = 1 - (underScale * 0.3); // Reduce the amount of under-zoom
      }
      
      newScale = Math.min(MAX_SCALE, Math.max(0.5, newScale)); // Allow slight under-zoom for bounce effect
      
      // Calculate pan to keep zoom centered on pinch point
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect && touchStartRef.current) {
        const centerX = center.x - rect.left - rect.width / 2;
        const centerY = center.y - rect.top - rect.height / 2;
        
        // Pan difference from start
        const panX = center.x - touchStartRef.current.x;
        const panY = center.y - touchStartRef.current.y;
        
        setTargetTransform({
          scale: newScale,
          x: lastTouchRef.current!.x + panX - centerX * (newScale / initialScale.current - 1),
          y: lastTouchRef.current!.y + panY - centerY * (newScale / initialScale.current - 1)
        });
      }
    } else if (isPanning && e.touches.length === 1) {
      e.preventDefault();
      
      if (touchStartRef.current && lastTouchRef.current) {
        const deltaX = e.touches[0].clientX - touchStartRef.current.x;
        const deltaY = e.touches[0].clientY - touchStartRef.current.y;
        
        setTargetTransform({
          scale: transform.scale,
          x: lastTouchRef.current.x + deltaX,
          y: lastTouchRef.current.y + deltaY
        });
      }
    }
  }, [isPinching, isPanning, transform.scale, setTargetTransform]);
  
  // Handle touch end
  const handleTouchEnd = useCallback(() => {
    setIsPanning(false);
    setIsPinching(false);
    
    // Bounce back if zoomed out too far
    if (targetTransformRef.current.scale < 1) {
      setTargetTransform({ scale: 1, x: 0, y: 0 });
    }
  }, [setTargetTransform]);
  
  // Mouse wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Get mouse position relative to image center
    const mouseX = e.clientX - rect.left - rect.width / 2;
    const mouseY = e.clientY - rect.top - rect.height / 2;
    
    // Calculate new scale
    const delta = -e.deltaY * ZOOM_SPEED;
    const newScale = transform.scale * (1 + delta);
    
    // Calculate new position to zoom on mouse position
    const scaleRatio = newScale / transform.scale;
    
    setTargetTransform({
      scale: newScale,
      x: mouseX - (mouseX - transform.x) * scaleRatio,
      y: mouseY - (mouseY - transform.y) * scaleRatio
    });
  }, [transform, setTargetTransform]);
  
  // Mouse down - start drag
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (transform.scale > 1) {
      e.preventDefault();
      setIsPanning(true);
      mouseStartRef.current = { x: e.clientX, y: e.clientY };
      lastTouchRef.current = { x: transform.x, y: transform.y };
    }
  }, [transform]);
  
  // Mouse move - drag pan
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && mouseStartRef.current && lastTouchRef.current) {
      e.preventDefault();
      
      const deltaX = e.clientX - mouseStartRef.current.x;
      const deltaY = e.clientY - mouseStartRef.current.y;
      
      setTargetTransform({
        scale: transform.scale,
        x: lastTouchRef.current.x + deltaX,
        y: lastTouchRef.current.y + deltaY
      });
    }
  }, [isPanning, transform.scale, setTargetTransform]);
  
  // Mouse up - end drag
  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);
  
  // Prevent default drag
  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);
  
  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden flex items-center justify-center ${className}`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        cursor: transform.scale > 1 ? (isPanning ? 'grabbing' : 'grab') : 'default',
        touchAction: 'none', // Prevent browser gestures
      }}
    >
      <img
        ref={imageRef}
        src={currentSrc}
        alt={alt}
        className="max-w-full max-h-full object-contain select-none"
        style={{
          transform: `scale(${transform.scale}) translate(${transform.x / transform.scale}px, ${transform.y / transform.scale}px)`,
          transformOrigin: 'center center',
          willChange: 'transform',
          filter: !isHighResLoaded ? 'blur(2px)' : 'none',
          // No transition on transform - smooth animation handled by RAF
          // But transition on filter for smooth blur removal
          transition: 'filter 0.3s ease-in-out',
        }}
        onDragStart={handleDragStart}
        draggable={false}
      />
    </div>
  );
}