import { useState, useCallback } from 'react';

interface SwipeHandlers {
  onSwipeLeft?: () => void;
  onSwipeRight?: () => void;
  onSwipeProgress?: (progress: number) => void; // -1 to 1, negative = swiping left, positive = swiping right
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
  minSwipeDistance?: number; // Minimum distance in pixels to trigger swipe
  swipeThreshold?: number; // Percentage of container width (0-1) to trigger swipe
}

interface TouchPoint {
  x: number;
  y: number;
  time: number;
}

export function useSwipeGesture({
  onSwipeLeft,
  onSwipeRight,
  onSwipeProgress,
  onSwipeStart,
  onSwipeEnd,
  minSwipeDistance = 50,
  swipeThreshold = 0.3,
}: SwipeHandlers) {
  const [touchStart, setTouchStart] = useState<TouchPoint | null>(null);
  const [touchCurrent, setTouchCurrent] = useState<TouchPoint | null>(null);
  const [isSwiping, setIsSwiping] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    const startPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    
    setTouchStart(startPoint);
    setTouchCurrent(startPoint);
    setIsSwiping(false);
    
    // Get container width for progress calculation
    const target = e.currentTarget as HTMLElement;
    setContainerWidth(target.offsetWidth);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart) return;
    
    const touch = e.touches[0];
    const currentPoint: TouchPoint = {
      x: touch.clientX,
      y: touch.clientY,
      time: Date.now(),
    };
    
    setTouchCurrent(currentPoint);
    
    const deltaX = touchStart.x - currentPoint.x;
    const deltaY = touchStart.y - currentPoint.y;
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    
    // Start swiping if horizontal movement is dominant
    if (!isSwiping && isHorizontalSwipe && Math.abs(deltaX) > 10) {
      setIsSwiping(true);
      onSwipeStart?.();
      // Note: preventDefault not needed - CSS touch-action handles scroll prevention
    }
    
    // Calculate and report progress if swiping
    if (isSwiping && containerWidth > 0) {
      // Progress from -1 (full swipe right) to 1 (full swipe left)
      const progress = Math.max(-1, Math.min(1, deltaX / containerWidth));
      onSwipeProgress?.(progress);
    }
  }, [touchStart, isSwiping, containerWidth, onSwipeProgress, onSwipeStart]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchCurrent) {
      setTouchStart(null);
      setTouchCurrent(null);
      return;
    }
    
    const deltaX = touchStart.x - touchCurrent.x;
    const deltaY = touchStart.y - touchCurrent.y;
    const deltaTime = touchCurrent.time - touchStart.time;
    const velocity = Math.abs(deltaX) / deltaTime; // pixels per ms
    
    const isHorizontalSwipe = Math.abs(deltaX) > Math.abs(deltaY);
    const swipeDistanceThreshold = containerWidth > 0 
      ? containerWidth * swipeThreshold 
      : minSwipeDistance;
    
    // Trigger swipe if:
    // 1. Movement is horizontal
    // 2. Distance exceeds threshold OR velocity is high (quick flick)
    const shouldTriggerSwipe = isHorizontalSwipe && 
      (Math.abs(deltaX) > swipeDistanceThreshold || velocity > 0.5);
    
    if (shouldTriggerSwipe) {
      // Don't reset progress here - let the component handle the animation
      if (deltaX > 0) {
        // Swiped left - go to next
        onSwipeLeft?.();
      } else {
        // Swiped right - go to previous  
        onSwipeRight?.();
      }
    } else if (isSwiping) {
      // Swipe was cancelled - component will handle the reset animation
      // Just call onSwipeEnd to notify
    }
    
    // Clean up
    setTouchStart(null);
    setTouchCurrent(null);
    setIsSwiping(false);
    onSwipeEnd?.();
  }, [
    touchStart, 
    touchCurrent, 
    containerWidth, 
    swipeThreshold, 
    minSwipeDistance, 
    isSwiping,
    onSwipeLeft, 
    onSwipeRight, 
    onSwipeProgress,
    onSwipeEnd
  ]);

  // Handle touch cancel (e.g., when call comes in during swipe)
  const handleTouchCancel = useCallback(() => {
    if (isSwiping) {
      onSwipeProgress?.(0);
      onSwipeEnd?.();
    }
    setTouchStart(null);
    setTouchCurrent(null);
    setIsSwiping(false);
  }, [isSwiping, onSwipeProgress, onSwipeEnd]);

  return {
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
    },
    isSwiping,
    swipeProgress: touchStart && touchCurrent && containerWidth > 0
      ? (touchStart.x - touchCurrent.x) / containerWidth
      : 0,
  };
}