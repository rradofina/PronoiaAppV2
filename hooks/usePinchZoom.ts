import { useState, useCallback, useRef, useEffect } from 'react';

interface TouchPoint {
  x: number;
  y: number;
}

interface ZoomState {
  scale: number;
  x: number;
  y: number;
}

interface PinchZoomOptions {
  minScale?: number;
  maxScale?: number;
  doubleTapScale?: number;
  onZoomChange?: (scale: number) => void;
}

export function usePinchZoom({
  minScale = 1,
  maxScale = 4,
  doubleTapScale = 2.5,
  onZoomChange
}: PinchZoomOptions = {}) {
  const [zoomState, setZoomState] = useState<ZoomState>({
    scale: 1,
    x: 0,
    y: 0
  });
  
  const [isPinching, setIsPinching] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastTapTime = useRef<number>(0);
  const initialDistance = useRef<number>(0);
  const initialScale = useRef<number>(1);
  const touchCenter = useRef<TouchPoint>({ x: 0, y: 0 });
  const lastCenter = useRef<TouchPoint>({ x: 0, y: 0 });
  
  // Calculate distance between two touch points
  const getDistance = (touches: React.TouchList): number => {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };
  
  // Calculate center point between two touches
  const getTouchCenter = (touches: React.TouchList): TouchPoint => {
    if (touches.length < 2) {
      return { x: touches[0].clientX, y: touches[0].clientY };
    }
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2
    };
  };
  
  // Constrain pan within zoom bounds
  const constrainPan = (x: number, y: number, scale: number): TouchPoint => {
    if (!containerRef.current) return { x: 0, y: 0 };
    
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    
    // Calculate max pan based on scale
    const scaledWidth = rect.width * scale;
    const scaledHeight = rect.height * scale;
    const maxX = Math.max(0, (scaledWidth - rect.width) / 2);
    const maxY = Math.max(0, (scaledHeight - rect.height) / 2);
    
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y))
    };
  };
  
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    
    // Double tap detection
    if (touches.length === 1) {
      const now = Date.now();
      const timeSinceLastTap = now - lastTapTime.current;
      
      if (timeSinceLastTap < 300 && timeSinceLastTap > 0) {
        // Double tap detected
        e.preventDefault();
        
        if (zoomState.scale > 1) {
          // Zoom out to original
          setZoomState({ scale: 1, x: 0, y: 0 });
          onZoomChange?.(1);
        } else {
          // Zoom in to double tap scale
          const touch = touches[0];
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            // Calculate zoom point relative to container center
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            const offsetX = (centerX - touch.clientX) * (doubleTapScale - 1);
            const offsetY = (centerY - touch.clientY) * (doubleTapScale - 1);
            
            const constrained = constrainPan(offsetX, offsetY, doubleTapScale);
            setZoomState({ 
              scale: doubleTapScale, 
              x: constrained.x, 
              y: constrained.y 
            });
            onZoomChange?.(doubleTapScale);
          }
        }
      }
      
      lastTapTime.current = now;
    }
    
    // Pinch zoom start
    if (touches.length === 2) {
      e.preventDefault();
      setIsPinching(true);
      initialDistance.current = getDistance(touches);
      initialScale.current = zoomState.scale;
      touchCenter.current = getTouchCenter(touches);
      lastCenter.current = { x: zoomState.x, y: zoomState.y };
    }
  }, [zoomState, doubleTapScale, onZoomChange]);
  
  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    
    if (touches.length === 2 && isPinching) {
      e.preventDefault();
      
      // Calculate new scale
      const currentDistance = getDistance(touches);
      const scaleChange = currentDistance / initialDistance.current;
      const newScale = Math.min(maxScale, Math.max(minScale, initialScale.current * scaleChange));
      
      // Calculate new center and pan
      const currentCenter = getTouchCenter(touches);
      const deltaX = currentCenter.x - touchCenter.current.x;
      const deltaY = currentCenter.y - touchCenter.current.y;
      
      // Apply pan with constraints
      const newX = lastCenter.current.x + deltaX;
      const newY = lastCenter.current.y + deltaY;
      const constrained = constrainPan(newX, newY, newScale);
      
      setZoomState({
        scale: newScale,
        x: constrained.x,
        y: constrained.y
      });
      
      onZoomChange?.(newScale);
    }
    
    // Single finger pan when zoomed
    if (touches.length === 1 && zoomState.scale > 1 && !isPinching) {
      e.preventDefault();
      // Pan logic will be handled by the component
    }
  }, [isPinching, zoomState.scale, minScale, maxScale, onZoomChange]);
  
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (e.touches.length < 2) {
      setIsPinching(false);
    }
  }, []);
  
  // Reset zoom when requested
  const resetZoom = useCallback(() => {
    setZoomState({ scale: 1, x: 0, y: 0 });
    onZoomChange?.(1);
  }, [onZoomChange]);
  
  // Check if currently zoomed
  const isZoomed = zoomState.scale > 1;
  
  return {
    zoomState,
    isZoomed,
    isPinching,
    resetZoom,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    setContainerRef: (ref: HTMLDivElement | null) => {
      containerRef.current = ref;
    }
  };
}