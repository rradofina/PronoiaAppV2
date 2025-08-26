import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PhotoTransform, ContainerTransform, isPhotoTransform, isContainerTransform, createPhotoTransform, getPhotoTransformBounds } from '../types';
import { getHighResPhotoUrls } from '../utils/photoUrlUtils';
import DebugPortal from './DebugPortal';
import { usePhotoDebug } from '../hooks/usePhotoDebug';

// Debounce utility for transform updates
const useDebounce = <T extends any[]>(
  callback: (...args: T) => void,
  delay: number
): (...args: T) => void => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  return useCallback((...args: T) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
};

interface PhotoRendererProps {
  photoUrl: string;
  photoAlt?: string;
  transform?: PhotoTransform | ContainerTransform;
  
  // Interaction mode
  interactive?: boolean;
  onTransformChange?: (transform: PhotoTransform) => void;
  onInteractionEnd?: (transform: PhotoTransform) => void;
  
  // Container styling
  className?: string;
  style?: React.CSSProperties;
  
  // Debug mode
  debug?: boolean;
  
  // Optional fallback URLs for error handling
  fallbackUrls?: string[];
  
  // Clipping indicators (zebra stripes) for overexposed/underexposed areas
  showClippingIndicators?: boolean;
  
  // Ref to expose finalization method
  finalizationRef?: React.MutableRefObject<(() => Promise<PhotoTransform>) | null>;
  
  // Interaction state callback
  onInteractionChange?: (isInteracting: boolean) => void;
  
  // Callback for when user starts interacting (dragging/zooming)
  onInteractionStart?: () => void;
  
  // Smart reset callback for intelligent photo repositioning
  onSmartReset?: () => Promise<PhotoTransform>;
  
  // Preview mode - fills hole with object-cover instead of object-contain
  previewMode?: boolean;
}

// Helper to convert legacy container transforms to CSS (backward compatibility)
function convertLegacyToCSS(containerTransform: ContainerTransform): React.CSSProperties {
  return {
    transform: `translate(${containerTransform.x}px, ${containerTransform.y}px) scale(${containerTransform.scale})`,
    transformOrigin: 'center center',
    width: '100%',
    height: '100%',
    objectFit: 'contain' as const,
    // Improve image quality
    imageRendering: 'auto' as const,
    // Ensure smooth scaling
    backfaceVisibility: 'hidden' as const,
    // Force hardware acceleration for smoother transforms
    willChange: 'transform' as const,
  };
}

// Convert photo-centric transform to CSS
function convertPhotoToCSS(photoTransform: PhotoTransform, previewMode: boolean = false): React.CSSProperties {
  // Simple direct conversion - photoCenterX/Y represent the center point of the visible area
  // photoScale represents zoom level relative to "fit" size
  
  // Calculate translation to center the desired point
  // photoCenterX: 0.5 = center, 0.0 = left edge, 1.0 = right edge
  // We want to translate so that point becomes the center of the viewport
  const translateX = (0.5 - photoTransform.photoCenterX) * 100; // Percentage of photo width
  const translateY = (0.5 - photoTransform.photoCenterY) * 100; // Percentage of photo height
  
  const cssTransform = `translate(${translateX}%, ${translateY}%) scale(${photoTransform.photoScale})`;
  
  console.log('🎨 PHOTO CSS CONVERSION:', {
    input: photoTransform,
    translation: { 
      translateX: `${translateX}%`, 
      translateY: `${translateY}%`,
      note: 'CSS translate % is relative to element size after object-fit'
    },
    cssTransform,
    previewMode,
    objectFit: previewMode ? 'cover' : 'contain',
    transformOrigin: 'center center (default)',
    note: previewMode 
      ? 'Preview mode: object-cover fills hole completely, may crop photo'
      : 'Edit mode: object-contain shows full photo with potential letterboxing'
  });
  
  return {
    transform: cssTransform,
    transformOrigin: 'center center',
    width: '100%',
    height: '100%',
    objectFit: previewMode ? 'cover' as const : 'contain' as const,
    // Improve image quality
    imageRendering: 'auto' as const,
    // Ensure smooth scaling
    backfaceVisibility: 'hidden' as const,
    // Force hardware acceleration for smoother transforms
    willChange: 'transform' as const,
  };
}

function PhotoRenderer({
  photoUrl,
  photoAlt = 'Photo',
  transform,
  interactive = false,
  onTransformChange,
  onInteractionEnd,
  className = '',
  style = {},
  debug = false,
  fallbackUrls = [],
  previewMode = false,
  showClippingIndicators = false,
  finalizationRef,
  onInteractionChange,
  onInteractionStart,
  onSmartReset
}: PhotoRendererProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [lastPointer, setLastPointer] = useState<{ x: number; y: number } | null>(null);
  
  // Touch handling state for pinch-to-zoom
  const [lastTouchDistance, setLastTouchDistance] = useState<number>(0);
  const [isTouching, setIsTouching] = useState(false);
  
  // URL fallback management
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(true); // Default to true for instant display
  const [currentTransform, setCurrentTransform] = useState<PhotoTransform>(
    transform && isPhotoTransform(transform) 
      ? transform 
      : createPhotoTransform(1, 0.5, 0.5) // Default: fit scale, centered
  );
  
  // Ref to always have the latest transform value (fixes mobile auto-snap stale closure issue)
  const currentTransformRef = useRef<PhotoTransform>(currentTransform);
  
  // Auto-snap state removed - no longer needed after fixing flashing issue
  // Previously used for animation, but caused flashing due to multiple renders
  
  // Interaction state tracking for UI hiding
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced transform change to prevent excessive parent updates during dragging
  const debouncedTransformChange = useDebounce((transform: PhotoTransform) => {
    if (onTransformChange) {
      onTransformChange(transform);
    }
  }, 100); // 100ms debounce for smooth dragging
  
  // User interaction tracking to prevent auto-snap on recently manipulated photos
  const [lastUserInteraction, setLastUserInteraction] = useState<number>(0);
  const [interactionType, setInteractionType] = useState<string>('none');
  
  // Track user interactions to prevent auto-snap immediately after user manipulation
  const trackUserInteraction = useCallback((type: string) => {
    const now = Date.now();
    setLastUserInteraction(now);
    setInteractionType(type);
  }, []);
  
  // Track interaction state for UI hiding
  const handleInteractionStart = useCallback(() => {
    setIsInteracting(true);
    onInteractionChange?.(true);
    
    // Clear existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
  }, [onInteractionChange]);
  
  // Use callback for handleInteractionEnd to ensure it's always available
  // This fixes the timing issue where touch events could fire before useEffect runs
  
  // Check if user has recently interacted with photo (within last 3 seconds)
  const hasRecentUserInteraction = useCallback(() => {
    const timeSinceInteraction = Date.now() - lastUserInteraction;
    const RECENT_INTERACTION_THRESHOLD = 3000; // 3 seconds
    const isRecent = timeSinceInteraction < RECENT_INTERACTION_THRESHOLD;
    
    return isRecent;
  }, [lastUserInteraction]);
  
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

  // Mathematical gap calculation that accounts for smart scaling system
  const calculateMathematicalGaps = useCallback((): {
    gaps: { left: number; right: number; top: number; bottom: number };
    photoEdges: { left: number; right: number; top: number; bottom: number };
    photoSize: { width: number; height: number };
  } => {
    if (!imageRef.current || !containerRef.current) {
      return {
        gaps: { left: 0, right: 0, top: 0, bottom: 0 },
        photoEdges: { left: 0, right: 0, top: 0, bottom: 0 },
        photoSize: { width: 0, height: 0 }
      };
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    const photoNaturalWidth = imageRef.current.naturalWidth;
    const photoNaturalHeight = imageRef.current.naturalHeight;
    
    if (photoNaturalWidth === 0 || photoNaturalHeight === 0 || containerWidth === 0 || containerHeight === 0) {
      return {
        gaps: { left: 0, right: 0, top: 0, bottom: 0 },
        photoEdges: { left: 0, right: 0, top: 0, bottom: 0 },
        photoSize: { width: 0, height: 0 }
      };
    }

    // Step 1: Calculate CSS object-fit: contain baseline scale
    // This is what CSS automatically does before our transform is applied
    const containScale = Math.min(
      containerWidth / photoNaturalWidth,
      containerHeight / photoNaturalHeight
    );
    
    // Step 2: Apply current photo transform scale (this is our adjustment factor on top of contain)
    const finalScale = containScale * currentTransform.photoScale;
    
    // Step 3: Calculate actual rendered photo dimensions after both contain + transform scaling
    const renderedWidth = photoNaturalWidth * finalScale;
    const renderedHeight = photoNaturalHeight * finalScale;
    
    // Step 4: Calculate base position (center of container)
    const baseCenterX = containerWidth / 2;
    const baseCenterY = containerHeight / 2;
    
    // Step 5: Apply photo positioning transforms (photoCenterX/Y affect where photo is positioned)
    // Calculate percentage-based translation, then convert to pixels
    // CSS translate % is relative to container, but photoCenterX/Y movement is relative to image scale
    const translateXPercent = (0.5 - currentTransform.photoCenterX);
    const translateYPercent = (0.5 - currentTransform.photoCenterY);
    
    // Convert percentage to pixels (CSS translate % is relative to container dimensions)
    const translateX = translateXPercent * containerWidth;
    const translateY = translateYPercent * containerHeight;
    
    // Step 6: Calculate final photo boundaries
    const photoLeft = baseCenterX - (renderedWidth / 2) + translateX;
    const photoRight = photoLeft + renderedWidth;
    const photoTop = baseCenterY - (renderedHeight / 2) + translateY;
    const photoBottom = photoTop + renderedHeight;
    
    // Step 7: Calculate gaps (only count empty space INSIDE container boundaries)
    // Gap exists only when photo doesn't reach container edge, creating empty space
    const actualGapLeft = photoLeft > 0 ? photoLeft : 0; // Empty space on left side (photo doesn't reach left edge)
    const actualGapRight = photoRight < containerWidth ? (containerWidth - photoRight) : 0; // Empty space on right side (photo doesn't reach right edge)
    const actualGapTop = photoTop > 0 ? photoTop : 0; // Empty space on top side (photo doesn't reach top edge)
    const actualGapBottom = photoBottom < containerHeight ? (containerHeight - photoBottom) : 0; // Empty space on bottom side (photo doesn't reach bottom edge)

    
    return {
      gaps: { 
        left: actualGapLeft, 
        right: actualGapRight, 
        top: actualGapTop, 
        bottom: actualGapBottom 
      },
      photoEdges: { left: photoLeft, right: photoRight, top: photoTop, bottom: photoBottom },
      photoSize: { width: renderedWidth, height: renderedHeight }
    };
  }, [currentTransform, debug]);

  // Accurate gap detection for precise gap-based movement
  const detectGaps = useCallback((): {
    hasGaps: boolean;
    gapCount: number;
    gaps: { left: number; right: number; top: number; bottom: number };
    significantGaps: { left: boolean; right: boolean; top: boolean; bottom: boolean };
  } => {
    
    if (!imageRef.current || !containerRef.current) {
      return { 
        hasGaps: false, 
        gapCount: 0,
        gaps: { left: 0, right: 0, top: 0, bottom: 0 }, 
        significantGaps: { left: false, right: false, top: false, bottom: false }
      };
    }

    try {
    
    // Use MATHEMATICAL calculation for accurate gap detection
    // This properly accounts for object-fit:contain and all transforms
    // Fixes the "invisible container" issue where DOM returns element bounds, not photo bounds
    const mathResult = calculateMathematicalGaps();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    if (mathResult.photoSize.width === 0 || mathResult.photoSize.height === 0) {
      return { 
        hasGaps: false, 
        gapCount: 0,
        gaps: { left: 0, right: 0, top: 0, bottom: 0 }, 
        significantGaps: { left: false, right: false, top: false, bottom: false }
      };
    }
    
    // Use the mathematically calculated photo edges and gaps
    const { photoEdges, gaps: mathGaps } = mathResult;
    
    // Add comprehensive coordinate debugging
    if (debug) {
      console.log('🔍 MATHEMATICAL GAP DETECTION:', {
        photoEdges: {
          left: photoEdges.left.toFixed(1),
          right: photoEdges.right.toFixed(1),
          top: photoEdges.top.toFixed(1),
          bottom: photoEdges.bottom.toFixed(1)
        },
        containerBounds: {
          left: 0,
          right: containerRect.width.toFixed(1),
          top: 0,
          bottom: containerRect.height.toFixed(1)
        },
        calculatedGaps: {
          left: mathGaps.left.toFixed(1),
          right: mathGaps.right.toFixed(1),
          top: mathGaps.top.toFixed(1),
          bottom: mathGaps.bottom.toFixed(1)
        },
        photoInfo: {
          width: mathResult.photoSize.width.toFixed(1),
          height: mathResult.photoSize.height.toFixed(1),
          scale: currentTransform.photoScale.toFixed(3)
        },
        transforms: {
          photoCenterX: currentTransform.photoCenterX,
          photoCenterY: currentTransform.photoCenterY,
          photoScale: currentTransform.photoScale
        }
      });
    }

    // Use the mathematical gaps directly
    const rawGapLeft = mathGaps.left;
    const rawGapRight = mathGaps.right;
    const rawGapTop = mathGaps.top;
    const rawGapBottom = mathGaps.bottom;
    
    
    // Step 2: Use precise rounding for accurate gap measurement
    // Round to 0.1px precision to avoid floating point errors while preserving accuracy
    const visualGapLeft = Math.round(rawGapLeft * 10) / 10;
    const visualGapRight = Math.round(rawGapRight * 10) / 10;
    const visualGapTop = Math.round(rawGapTop * 10) / 10;
    const visualGapBottom = Math.round(rawGapBottom * 10) / 10;
    
    // Add simplified gap calculation debugging
    if (debug) {
      console.log('🧮 FINAL GAP CALCULATION (MATHEMATICAL):', {
        containerSize: {
          width: containerRect.width.toFixed(1),
          height: containerRect.height.toFixed(1)
        },
        photoSize: {
          width: mathResult.photoSize.width.toFixed(1),
          height: mathResult.photoSize.height.toFixed(1)
        },
        finalPixelGaps: {
          left: visualGapLeft.toFixed(1),
          right: visualGapRight.toFixed(1),
          top: visualGapTop.toFixed(1),
          bottom: visualGapBottom.toFixed(1)
        },
        approach: 'Mathematical calculation accounting for object-fit and transforms',
        precision: 'Rounded to 0.1px for accuracy'
      });
    }

    // Use precise values without aggressive rounding
    // Keep decimal precision for accurate gap detection
    const gapLeft = visualGapLeft;
    const gapRight = visualGapRight;
    const gapTop = visualGapTop;
    const gapBottom = visualGapBottom;

    // Add final gap values debugging  
    if (debug) {
      console.log('🧮 FINAL GAP VALUES:', {
        finalGaps: {
          left: gapLeft,
          right: gapRight,
          top: gapTop,
          bottom: gapBottom
        },
        note: 'Final gap values after Math.ceil rounding'
      });
    }
    
    // User specification: Move by ANY gap amount (no threshold needed)
    const GAP_THRESHOLD = 0; // No threshold - detect ANY gap amount
    
    // Check which sides have gaps (positive values only - empty space)
    const hasLeftGap = gapLeft > GAP_THRESHOLD;
    const hasRightGap = gapRight > GAP_THRESHOLD;
    const hasTopGap = gapTop > GAP_THRESHOLD;
    const hasBottomGap = gapBottom > GAP_THRESHOLD;
    
    // Count significant gaps
    const gapCount = [hasLeftGap, hasRightGap, hasTopGap, hasBottomGap].filter(Boolean).length;
    const hasAnyGaps = gapCount > 0;
    
    if (debug) {
      console.log('🔍 Gap Detection (MATHEMATICAL - ACCURATE AT ALL ZOOM LEVELS):', {
        photoPosition: {
          left: photoEdges.left.toFixed(1),
          right: photoEdges.right.toFixed(1),
          top: photoEdges.top.toFixed(1),
          bottom: photoEdges.bottom.toFixed(1),
          width: mathResult.photoSize.width.toFixed(1),
          height: mathResult.photoSize.height.toFixed(1)
        },
        containerSize: {
          width: containerRect.width.toFixed(1),
          height: containerRect.height.toFixed(1)
        },
        detectedGaps: {
          left: gapLeft,
          right: gapRight,
          top: gapTop,
          bottom: gapBottom,
          note: 'Calculated from actual photo bounds, not element bounds'
        },
        result: {
          significantGaps: { left: hasLeftGap, right: hasRightGap, top: hasTopGap, bottom: hasBottomGap },
          gapCount,
          threshold: GAP_THRESHOLD,
          action: gapCount >= 3 ? 'Reset to default' : 
                 gapCount === 2 ? 'Move by both gap amounts' :
                 gapCount === 1 ? 'Move by single gap amount' : 'No action needed'
        }
      });
    }
    
    console.log('🔧 detectGaps - Completed successfully:', {
      hasGaps: hasAnyGaps,
      gapCount,
      gaps: { left: gapLeft, right: gapRight, top: gapTop, bottom: gapBottom }
    });

    return {
      hasGaps: hasAnyGaps,
      gapCount,
      gaps: { left: gapLeft, right: gapRight, top: gapTop, bottom: gapBottom },
      significantGaps: { left: hasLeftGap, right: hasRightGap, top: hasTopGap, bottom: hasBottomGap }
    };

    } catch (error) {
      console.error('❌ detectGaps - Error in gap calculation:', error);
      // Return safe fallback values
      return { 
        hasGaps: false, 
        gapCount: 0,
        gaps: { left: 0, right: 0, top: 0, bottom: 0 }, 
        significantGaps: { left: false, right: false, top: false, bottom: false }
      };
    }
    
  }, [debug, calculateMathematicalGaps, currentTransform]);

  // Post-snap gap validation - simulates gaps after movement to detect if photo is too small
  const detectPostSnapGaps = useCallback((
    newCenterX: number, 
    newCenterY: number, 
    scale: number = currentTransform.photoScale
  ): {
    hasGaps: boolean;
    gapCount: number;
    gaps: { left: number; right: number; top: number; bottom: number };
  } => {
    if (!imageRef.current || !containerRef.current) {
      return { 
        hasGaps: false, 
        gapCount: 0,
        gaps: { left: 0, right: 0, top: 0, bottom: 0 }
      };
    }
    
    // Get container dimensions
    const containerRect = containerRef.current.getBoundingClientRect();
    const containerWidth = containerRect.width;
    const containerHeight = containerRect.height;
    
    // Simulate photo position and size at the new transform
    const photoNaturalWidth = imageRef.current.naturalWidth;
    const photoNaturalHeight = imageRef.current.naturalHeight;
    
    if (photoNaturalWidth === 0 || photoNaturalHeight === 0) {
      return { 
        hasGaps: false, 
        gapCount: 0,
        gaps: { left: 0, right: 0, top: 0, bottom: 0 }
      };
    }
    
    // Calculate object-fit: contain scale (matching the main calculation)
    const containScale = Math.min(
      containerWidth / photoNaturalWidth,
      containerHeight / photoNaturalHeight
    );
    
    // Apply the transform scale
    const finalScale = containScale * scale;
    
    // Calculate rendered dimensions
    const scaledWidth = photoNaturalWidth * finalScale;
    const scaledHeight = photoNaturalHeight * finalScale;
    
    // Calculate translation (matching the fixed calculation - relative to container!)
    const translateX = (0.5 - newCenterX) * containerWidth;
    const translateY = (0.5 - newCenterY) * containerHeight;
    
    // Calculate photo edges relative to container
    const baseCenterX = containerWidth / 2;
    const baseCenterY = containerHeight / 2;
    
    const photoLeft = baseCenterX - (scaledWidth / 2) + translateX;
    const photoRight = photoLeft + scaledWidth;
    const photoTop = baseCenterY - (scaledHeight / 2) + translateY;
    const photoBottom = photoTop + scaledHeight;
    
    // Calculate gaps (positive values indicate empty space)
    const gapLeft = Math.max(0, photoLeft);
    const gapRight = Math.max(0, containerWidth - photoRight);
    const gapTop = Math.max(0, photoTop);
    const gapBottom = Math.max(0, containerHeight - photoBottom);
    
    // Post-snap validation uses zero tolerance - ANY gap counts (matching initial detection)
    const POST_SNAP_THRESHOLD = 0; // Zero tolerance - detect ANY gap amount
    
    const hasLeftGap = gapLeft > POST_SNAP_THRESHOLD;
    const hasRightGap = gapRight > POST_SNAP_THRESHOLD;
    const hasTopGap = gapTop > POST_SNAP_THRESHOLD;
    const hasBottomGap = gapBottom > POST_SNAP_THRESHOLD;
    
    const gapCount = [hasLeftGap, hasRightGap, hasTopGap, hasBottomGap].filter(Boolean).length;
    
    if (debug) {
      console.log('🔮 Post-Snap Gap Simulation:', {
        simulatedPosition: { centerX: newCenterX, centerY: newCenterY, scale },
        photoSize: { width: scaledWidth, height: scaledHeight },
        photoEdges: { left: photoLeft, right: photoRight, top: photoTop, bottom: photoBottom },
        gaps: { left: gapLeft, right: gapRight, top: gapTop, bottom: gapBottom },
        thresholdGaps: { left: hasLeftGap, right: hasRightGap, top: hasTopGap, bottom: hasBottomGap },
        gapCount,
        threshold: POST_SNAP_THRESHOLD
      });
    }
    
    return {
      hasGaps: gapCount > 0,
      gapCount,
      gaps: { left: gapLeft, right: gapRight, top: gapTop, bottom: gapBottom }
    };
  }, [currentTransform.photoScale, debug]);

  // Precise gap-based movement calculation (user specification)
  const calculateGapBasedMovement = useCallback((gapData: {
    gapCount: number;
    gaps: { left: number; right: number; top: number; bottom: number };
    significantGaps: { left: boolean; right: boolean; top: boolean; bottom: boolean };
  }): {
    action: 'none' | 'reset-to-default' | 'move-by-gaps';
    newCenterX: number;
    newCenterY: number;
    movements: { horizontal: string; vertical: string };
  } => {
    if (!imageRef.current || !containerRef.current) {
      return {
        action: 'none',
        newCenterX: currentTransformRef.current.photoCenterX,
        newCenterY: currentTransformRef.current.photoCenterY,
        movements: { horizontal: 'no change', vertical: 'no change' }
      };
    }

    const containerRect = containerRef.current.getBoundingClientRect();
    const { gapCount, gaps, significantGaps } = gapData;
    
    // User specification: 3+ sides with gaps → Reset to default
    if (gapCount >= 3) {
      return {
        action: 'reset-to-default',
        newCenterX: 0.5,
        newCenterY: 0.5,
        movements: { horizontal: 'reset to center', vertical: 'reset to center' }
      };
    }
    
    // User specification: 1-2 sides with gaps → Move by exact gap amounts
    if (gapCount === 0) {
      return {
        action: 'none',
        newCenterX: currentTransformRef.current.photoCenterX,
        newCenterY: currentTransformRef.current.photoCenterY,
        movements: { horizontal: 'no change', vertical: 'no change' }
      };
    }
    
    // Calculate movement based on gaps (convert pixels to photoCenterX/Y units)
    let horizontalMovement = 0;
    let verticalMovement = 0;
    let horizontalDescription = '';
    let verticalDescription = '';
    
    // CRITICAL: Understanding gaps and movement
    // Gap on TOP = empty space above photo = photo is too LOW = needs to move UP
    // Gap on BOTTOM = empty space below photo = photo is too HIGH = needs to move DOWN
    // Gap on LEFT = empty space to left of photo = photo is too far RIGHT = needs to move LEFT
    // Gap on RIGHT = empty space to right of photo = photo is too far LEFT = needs to move RIGHT
    //
    // CSS transform: translate((0.5 - photoCenterX) * containerWidth, ...)
    // To move photo LEFT: translateX decreases, so photoCenterX must INCREASE
    // To move photo RIGHT: translateX increases, so photoCenterX must DECREASE
    // To move photo UP: translateY decreases, so photoCenterY must INCREASE
    // To move photo DOWN: translateY increases, so photoCenterY must DECREASE
    
    // Horizontal movement - check BOTH left and right (for 2-gap cases)
    // Note: We shouldn't have both left AND right gaps (that would be 4 gaps total)
    // But we need separate if statements to handle 2-gap cases like left+top
    if (significantGaps.left) {
      // Gap on left → photo is too far right → needs to move LEFT
      // To move left: increase photoCenterX
      horizontalMovement = (gaps.left / containerRect.width);
      horizontalDescription = `left ${gaps.left.toFixed(1)}px`;
      
      if (debug) {
        console.log('🔍 LEFT GAP MOVEMENT CALCULATION:', {
          gap: gaps.left,
          containerWidth: containerRect.width,
          movement: horizontalMovement,
          currentPhotoCenterX: currentTransformRef.current.photoCenterX,
          newPhotoCenterX: currentTransformRef.current.photoCenterX + horizontalMovement,
          expectedTranslateChange: `${-(horizontalMovement * 100).toFixed(1)}%`
        });
      }
    }
    if (significantGaps.right) {  // NOT else if - need to check both for proper 2-gap handling
      // Gap on right → photo is too far left → needs to move RIGHT
      // To move right: decrease photoCenterX
      horizontalMovement = -(gaps.right / containerRect.width);
      horizontalDescription = `right ${gaps.right.toFixed(1)}px`;
      
      if (debug) {
        console.log('🔍 RIGHT GAP MOVEMENT CALCULATION:', {
          gap: gaps.right,
          containerWidth: containerRect.width,
          movement: horizontalMovement,
          currentPhotoCenterX: currentTransformRef.current.photoCenterX,
          newPhotoCenterX: currentTransformRef.current.photoCenterX + horizontalMovement,
          expectedTranslateChange: `${-(horizontalMovement * 100).toFixed(1)}%`
        });
      }
    }
    
    // Vertical movement - check BOTH top and bottom (for 2-gap cases)
    // Note: We shouldn't have both top AND bottom gaps (that would be 4 gaps total)
    // But we need separate if statements to handle 2-gap cases like left+top
    if (significantGaps.top) {
      // Gap on top → photo is too low → needs to move UP
      // To move up: increase photoCenterY
      verticalMovement = (gaps.top / containerRect.height);
      verticalDescription = `up ${gaps.top.toFixed(1)}px`;
    }
    if (significantGaps.bottom) {  // NOT else if - need to check both for proper 2-gap handling
      // Gap on bottom → photo is too high → needs to move DOWN
      // To move down: decrease photoCenterY
      verticalMovement = -(gaps.bottom / containerRect.height);
      verticalDescription = `down ${gaps.bottom.toFixed(1)}px`;
    }
    
    // Combine descriptions for 2-gap cases
    const movementDescriptions = {
      horizontal: horizontalDescription || 'no change',
      vertical: verticalDescription || 'no change'
    };
    
    // Apply movements to current position (no artificial bounds - allow true edge positioning)
    const newCenterX = currentTransformRef.current.photoCenterX + horizontalMovement;
    const newCenterY = currentTransformRef.current.photoCenterY + verticalMovement;
    
    // Post-snap validation: Check if the new position would result in 3+ gaps
    console.log('🔮 POST-SNAP VALIDATION: Checking if movement would create more gaps...');
    const postSnapGaps = detectPostSnapGaps(newCenterX, newCenterY);
    console.log('📊 POST-SNAP RESULT:', {
      wouldHaveGaps: postSnapGaps.hasGaps,
      wouldHaveGapCount: postSnapGaps.gapCount,
      wouldHaveGapSides: postSnapGaps.gaps
    });
    
    // If post-snap would result in 3+ gaps, override to reset-to-default
    if (postSnapGaps.gapCount >= 3) {
      console.log('🚨 POST-SNAP OVERRIDE: Movement would create 3+ gaps, resetting to default instead');
      return {
        action: 'reset-to-default',
        newCenterX: 0.5,
        newCenterY: 0.5,
        movements: { 
          horizontal: 'reset to center (post-snap override)', 
          vertical: 'reset to center (post-snap override)' 
        }
      };
    }
    
    console.log('✅ POST-SNAP VALIDATION PASSED: Movement is safe, proceeding');
    
    if (debug) {
      // Get photo dimensions for debugging
      const mathGaps = calculateMathematicalGaps();
      
      console.log('📐 Gap-Based Movement Calculation:', {
        photoInfo: {
          renderedSize: mathGaps.photoSize,
          photoScale: currentTransform.photoScale,
          aspectRatio: (mathGaps.photoSize.width / mathGaps.photoSize.height).toFixed(3)
        },
        containerInfo: {
          width: containerRect.width,
          height: containerRect.height,
          aspectRatio: (containerRect.width / containerRect.height).toFixed(3)
        },
        gapCount,
        gaps,
        significantGaps,
        movements: {
          horizontalPx: horizontalMovement * containerRect.width,
          verticalPx: verticalMovement * containerRect.height,
          horizontalPercent: (horizontalMovement * 100).toFixed(2) + '%',
          verticalPercent: (verticalMovement * 100).toFixed(2) + '%'
        },
        oldCenter: [currentTransform.photoCenterX.toFixed(3), currentTransform.photoCenterY.toFixed(3)],
        newCenter: [newCenterX.toFixed(3), newCenterY.toFixed(3)]
      });
    }
    
    return {
      action: 'move-by-gaps',
      newCenterX,
      newCenterY,
      movements: movementDescriptions
    };
  }, [currentTransform, debug, detectPostSnapGaps]);

  // Gap-based finalization following user's exact specification
  const finalizePositioning = useCallback((): Promise<PhotoTransform> => {
    return new Promise(async (resolve) => {
      const performFinalization = async () => {
        console.log('🚀 FINALIZATION STARTED - Checkmark clicked');
        console.log('✅ PROCEEDING: Auto-snap executes regardless of recent interaction');
        
        // Detect gaps using accurate measurement
        console.log('🔍 MEASURING GAPS...');
        const gapData = detectGaps();
        console.log('📊 GAP MEASUREMENT RESULT:', {
          hasGaps: gapData.hasGaps,
          gapCount: gapData.gapCount,
          gaps: gapData.gaps,
          significantGaps: gapData.significantGaps
        });
        
        if (!gapData.hasGaps) {
          console.log('✅ NO GAPS: No adjustment needed');
          if (debug) {
            console.log('✅ No significant gaps detected - no adjustment needed');
          }
          resolve(currentTransformRef.current);
          return;
        }
        
        console.log('⚠️ GAPS DETECTED: Proceeding with movement calculation');

        // Calculate movement based on user specification
        console.log('🧮 CALCULATING MOVEMENT...');
        const movement = calculateGapBasedMovement(gapData);
        console.log('📊 MOVEMENT VALIDATION:');
        const debugAction = gapData.gapCount >= 3 ? 'Reset to default' : 
                           gapData.gapCount === 2 ? 'Move by both gap amounts' :
                           gapData.gapCount === 1 ? 'Move by single gap amount' : 'No action needed';
        console.log('  Debug UI shows:', debugAction);
        console.log('  Finalization calculates:', movement.action);
        console.log('🎯 MOVEMENT CALCULATION RESULT:', {
          action: movement.action,
          newCenterX: movement.newCenterX,
          newCenterY: movement.newCenterY,
          movements: movement.movements
        });
        
        if (movement.action === 'none') {
          console.log('✅ NO ACTION: Current position is acceptable');
          if (debug) {
            console.log('✅ No action needed - current position is acceptable');
          }
          resolve(currentTransformRef.current);
          return;
        }
        
        console.log('🛠️ APPLYING MOVEMENT: Action required');

        if (debug) {
          console.log('⚙️ Applying gap-based correction:', {
            gapCount: gapData.gapCount,
            action: movement.action,
            movements: movement.movements
          });
        }

        let finalizedTransform: PhotoTransform;
        
        if (movement.action === 'reset-to-default') {
          // 3+ sides with gaps → Smart reset to optimal placement
          if (onSmartReset) {
            console.log('🎯 SMART RESET: Using intelligent photo placement');
            try {
              finalizedTransform = await onSmartReset();
              console.log('✅ SMART RESET SUCCESSFUL:', finalizedTransform);
              if (debug) {
                console.log('🎯 Smart reset applied: optimal placement restored');
              }
            } catch (error) {
              console.error('❌ Smart reset failed, falling back to default:', error);
              finalizedTransform = createPhotoTransform(1, 0.5, 0.5);
              if (debug) {
                console.log('⚠️ Fallback to default: smart reset unavailable');
              }
            }
          } else {
            // Fallback to default behavior when smart reset not available
            console.log('🔄 DEFAULT RESET: Creating transform (1, 0.5, 0.5)');
            finalizedTransform = createPhotoTransform(1, 0.5, 0.5);
            console.log('✅ CREATED DEFAULT RESET TRANSFORM:', finalizedTransform);
            if (debug) {
              console.log('🔄 Default reset applied: 3+ sides have gaps');
            }
          }
        } else if (movement.action === 'move-by-gaps') {
          // 1-2 sides with gaps → Move by exact gap amounts (preserve zoom)
          console.log('📐 MOVE BY GAPS: Creating transform with movement');
          console.log('  Current transform:', currentTransform);
          console.log('  New center:', { x: movement.newCenterX, y: movement.newCenterY });
          finalizedTransform = createPhotoTransform(
            currentTransform.photoScale, // Preserve zoom
            movement.newCenterX,
            movement.newCenterY
          );
          console.log('✅ CREATED MOVEMENT TRANSFORM:', finalizedTransform);
          if (debug) {
            console.log('📐 Moving by gap amounts:', movement.movements);
          }
        } else {
          // Should not happen, but fallback to current transform
          console.log('⚠️ FALLBACK: Unknown action, using current transform');
          finalizedTransform = currentTransform;
        }
        
        if (debug) {
          console.log('✨ Gap-Based Finalization Result:', {
            oldTransform: {
              scale: currentTransform.photoScale.toFixed(3),
              center: [currentTransform.photoCenterX.toFixed(3), currentTransform.photoCenterY.toFixed(3)]
            },
            newTransform: {
              scale: finalizedTransform.photoScale.toFixed(3),
              center: [finalizedTransform.photoCenterX.toFixed(3), finalizedTransform.photoCenterY.toFixed(3)]
            },
            changed: finalizedTransform !== currentTransform
          });
        }
        
        // Apply transformation
        console.log('🔄 APPLYING TRANSFORM...');
        console.log('  Current transform:', currentTransform);
        console.log('  New transform:', finalizedTransform);
        console.log('  Transforms are different:', finalizedTransform !== currentTransform);
        
        // Check if transforms are actually different (deep comparison for safety)
        const transformsAreDifferent = 
          finalizedTransform.photoScale !== currentTransform.photoScale ||
          finalizedTransform.photoCenterX !== currentTransform.photoCenterX ||
          finalizedTransform.photoCenterY !== currentTransform.photoCenterY;
        
        console.log('  Deep comparison different:', transformsAreDifferent);
        
        if (transformsAreDifferent) {
          console.log('⚙️ EXECUTING TRANSFORM CHANGE...');
          console.log('🎬 Applying auto-snap movement immediately');
          
          // Apply transform immediately without animation states to prevent flashing
          setCurrentTransform(finalizedTransform);
          
          if (onTransformChange) {
            console.log('📡 Calling onTransformChange callback...');
            onTransformChange(finalizedTransform);
            console.log('✅ Callback executed');
          } else {
            console.log('⚠️ No onTransformChange callback provided');
          }
          
          console.log('✅ FINALIZATION COMPLETE - Transform applied');
          if (debug) console.log('✅ Gap-based finalization complete');
          resolve(finalizedTransform);
        } else {
          console.log('ℹ️ NO CHANGE: Transforms are identical, resolving with current');
          resolve(currentTransformRef.current);
        }
      };

      // Use requestAnimationFrame to ensure DOM measurements are accurate
      requestAnimationFrame(() => {
        requestAnimationFrame(performFinalization);
      });
    });
  }, [detectGaps, calculateGapBasedMovement, onTransformChange, debug, hasRecentUserInteraction]);

  // Define handleInteractionEnd as a stable callback
  const handleInteractionEnd = useCallback(async () => {
    // Clear any existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
    
    // Show UI immediately
    setIsInteracting(false);
    onInteractionChange?.(false);
    
    // Immediate auto-snap without delay to prevent flashing
    if (onInteractionEnd) {
      try {
        // Call finalization immediately to detect gaps and apply auto-snap
        const finalizedTransform = await finalizePositioning();
        onInteractionEnd(finalizedTransform);
      } catch (error) {
        console.error('❌ Auto-snap finalization failed:', error);
        onInteractionEnd(currentTransformRef.current);
      }
    }
  }, [onInteractionChange, onInteractionEnd, finalizePositioning, setIsInteracting]);

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

  // Initialize and sync transform based on mode
  // For non-interactive: always sync with prop
  // For interactive: only initialize when photo changes, ignore during interaction
  const [lastPhotoUrlForTransform, setLastPhotoUrlForTransform] = useState<string>('');
  
  useEffect(() => {
    if (!interactive && transform && isPhotoTransform(transform)) {
      // Non-interactive mode: always sync with prop for correct display
      if (debug) {
        console.log('📐 PhotoRenderer NON-INTERACTIVE - Syncing transform from prop:', {
          photoScale: transform.photoScale,
          photoCenterX: transform.photoCenterX,
          photoCenterY: transform.photoCenterY
        });
      }
      setCurrentTransform(transform);
    } else if (interactive && photoUrl !== lastPhotoUrlForTransform) {
      // Interactive mode: only sync when photo changes, not during dragging
      // This prevents feedback loops from parent updates
      if (transform && isPhotoTransform(transform)) {
        console.log('📐 PhotoRenderer INTERACTIVE - New photo, initializing transform:', {
          photoScale: transform.photoScale,
          photoCenterX: transform.photoCenterX,
          photoCenterY: transform.photoCenterY,
          photoUrl: photoUrl.substring(0, 50) + '...',
          timestamp: Date.now()
        });
        setCurrentTransform(transform);
      } else {
        // No transform provided, use default
        console.log('📐 PhotoRenderer INTERACTIVE - New photo, using default transform');
        setCurrentTransform(createPhotoTransform(1, 0.5, 0.5));
      }
      setLastPhotoUrlForTransform(photoUrl);
    }
    // Don't update if it's the same photo in interactive mode - prevents feedback loops
  }, [interactive, transform, photoUrl, lastPhotoUrlForTransform, debug]);
  
  // Keep ref synchronized with state for use in callbacks (fixes mobile auto-snap)
  useEffect(() => {
    currentTransformRef.current = currentTransform;
  }, [currentTransform]);
  
  // Helper function to determine if two URLs represent the same photo
  const isSamePhoto = useCallback((url1: string, url2: string): boolean => {
    if (url1 === url2) return true;
    
    // Handle URL upgrades: immediate URL (googleusercontent.com/fife) → blob URL
    // Extract Google Drive file ID from both URLs
    const extractFileId = (url: string): string | null => {
      // Blob URLs can't be compared by file ID, handle separately
      if (url.startsWith('blob:')) {
        return null; // Blob URLs are compared by reference, not content
      }
      
      // Try various Google Drive URL patterns
      const patterns = [
        /\/d\/([a-zA-Z0-9-_]+)/,           // /d/FILE_ID
        /id=([a-zA-Z0-9-_]+)/,            // id=FILE_ID
        /file\/d\/([a-zA-Z0-9-_]+)/,      // file/d/FILE_ID
        /uc\?id=([a-zA-Z0-9-_]+)/,        // uc?id=FILE_ID
        /\/fife\/.*\/([a-zA-Z0-9-_]+)/,    // fife/.../FILE_ID (immediate URLs)
        /=([a-zA-Z0-9-_]{20,})/           // Generic long ID pattern
      ];
      
      for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
      }
      return null;
    };
    
    const fileId1 = extractFileId(url1);
    const fileId2 = extractFileId(url2);
    
    // Special case: if one is blob and other is not, they could be the same photo
    // but we can't verify without additional context, so assume different for safety
    const url1IsBlob = url1.startsWith('blob:');
    const url2IsBlob = url2.startsWith('blob:');
    
    if (url1IsBlob || url2IsBlob) {
      // For blob URLs, we can't extract file IDs, so we assume they're different
      // unless they're the exact same blob URL
      return false;
    }
    
    // If both URLs have the same Google Drive file ID, they're the same photo
    if (fileId1 && fileId2 && fileId1 === fileId2) {
      if (debug) {
        console.log('📸 PhotoRenderer - URL upgrade detected (same file ID):', {
          fileId: fileId1,
          fromType: url1.includes('fife') ? 'immediate' : 'direct',
          toType: url2.includes('fife') ? 'immediate' : 'direct',
          url1Preview: url1.substring(0, 50) + '...',
          url2Preview: url2.substring(0, 50) + '...'
        });
      }
      return true;
    }
    
    return false;  
  }, [debug]);

  // Track the current photo URL to detect actual photo changes
  const [lastPhotoUrl, setLastPhotoUrl] = useState<string>('');
  const [hasPhotoInitialized, setHasPhotoInitialized] = useState(false);
  
  useEffect(() => {
    // Unified photo loading logic - treat all photos the same way
    if (photoUrl && !isSamePhoto(photoUrl, lastPhotoUrl)) {
      // Different photo detected - prepare for seamless transition
      setCurrentUrlIndex(0);
      setImageError(false);
      // NEVER reset imageLoaded - let the new image load smoothly over the existing one
      setClippingData({ overexposed: null, underexposed: null });
      setLastPhotoUrl(photoUrl);
      
      // Mark as initialized after any successful photo load
      if (!hasPhotoInitialized) {
        setHasPhotoInitialized(true);
      }
    } else if (photoUrl && isSamePhoto(photoUrl, lastPhotoUrl)) {
      // URL upgrade for same photo - preserve all state
      setLastPhotoUrl(photoUrl);
    }
  }, [photoUrl, hasPhotoInitialized, lastPhotoUrl, isSamePhoto]);
  
  // Analyze clipping when image loads and clipping indicators are enabled
  useEffect(() => {
    if (imageLoaded && showClippingIndicators) {
      // Small delay to ensure image is fully rendered
      setTimeout(analyzeClipping, 100);
    }
  }, [imageLoaded, showClippingIndicators]);

  // Expose finalization method via ref with stable dependencies
  useEffect(() => {
    if (finalizationRef) {
      finalizationRef.current = finalizePositioning;
    }
  }, [finalizationRef, finalizePositioning]);

  // Cleanup interaction timeout on unmount
  useEffect(() => {
    return () => {
      if (interactionTimeoutRef.current) {
        clearTimeout(interactionTimeoutRef.current);
      }
    };
  }, []);
  
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
      // Keep imageLoaded=true to prevent flashing during URL fallback
    } else {
      console.error('💥 PhotoRenderer - All URLs failed');
      setImageError(true);
      // Only set imageLoaded=false on final failure
      setImageLoaded(false);
    }
  };
  
  // Handle successful image load
  const handleImageLoad = () => {
    const currentUrl = getCurrentUrl();
    const isUpgrade = lastPhotoUrl && isSamePhoto(currentUrl, lastPhotoUrl);
    
    if (debug) {
      console.log(`✅ PhotoRenderer - Image loaded successfully (${currentUrlIndex + 1}/${getAllUrls().length}):`, {
        url: currentUrl,
        isUpgrade,
        naturalSize: imageRef.current ? {
          width: imageRef.current.naturalWidth,
          height: imageRef.current.naturalHeight
        } : 'unknown'
      });
    }
    
    // Always set loaded to true, even for URL upgrades
    setImageLoaded(true);
    setImageError(false);
  };

  // Calculate CSS style for the photo
  const photoStyle: React.CSSProperties = (() => {
    // For non-interactive mode, use prop transform directly for stable display
    if (!interactive) {
      if (transform && isPhotoTransform(transform)) {
        if (debug) {
          console.log(`📸 PhotoRenderer NON-INTERACTIVE with transform for ${photoAlt}:`, transform);
        }
        return convertPhotoToCSS(transform, previewMode);
      } else if (transform && isContainerTransform(transform)) {
        if (debug) {
          console.log(`📸 PhotoRenderer NON-INTERACTIVE with legacy transform for ${photoAlt}`);
        }
        return convertLegacyToCSS(transform);
      } else {
        // Default for non-interactive without transform
        if (debug) {
          console.log(`📸 PhotoRenderer NON-INTERACTIVE without transform for ${photoAlt}`);
        }
        return {
          width: '100%',
          height: '100%',
          objectFit: 'cover' as const,
          objectPosition: 'center center'
        };
      }
    }
    
    // For interactive mode, use currentTransform for smooth dragging
    const baseStyle = convertPhotoToCSS(currentTransform, previewMode);
    
    if (debug) {
      console.log(`📸 PhotoRenderer INTERACTIVE applying currentTransform for ${photoAlt}:`, {
        currentTransform,
        isDragging,
        isTouching,
        previewMode
      });
    }
    
    // No transitions - instant photo display and movement
    return {
      ...baseStyle,
      transition: 'none' // No transitions for instant response
    };
  })();

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
    handleInteractionStart();
    
    // Call the onInteractionStart callback when user begins touching
    if (onInteractionStart) {
      onInteractionStart();
    }
    
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
      // Use debounced transform change to prevent excessive parent updates during pinch
      debouncedTransformChange(newTransform);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging && lastPointer && containerRef.current) {
      // Single finger - handle drag
      const touch = e.touches[0];
      const deltaX = touch.clientX - lastPointer.x;
      const deltaY = touch.clientY - lastPointer.y;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const movementX = (deltaX / containerRect.width) / currentTransform.photoScale;
      const movementY = (deltaY / containerRect.height) / currentTransform.photoScale;
      
      // Use same zoom-aware bounds as mouse dragging for consistency
      const bounds = getPhotoTransformBounds(currentTransform.photoScale);
      const newCenterX = Math.max(bounds.min, Math.min(bounds.max, currentTransform.photoCenterX - movementX));
      const newCenterY = Math.max(bounds.min, Math.min(bounds.max, currentTransform.photoCenterY - movementY));
      
      const newTransform = createPhotoTransform(
        currentTransform.photoScale,
        newCenterX,
        newCenterY
      );
      
      setCurrentTransform(newTransform);
      // Use debounced transform change to prevent excessive parent updates during touch drag
      debouncedTransformChange(newTransform);
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
      
      // Track user interaction and call end handler
      trackUserInteraction('touch-end');
      setLastPointer(null);
      setLastTouchDistance(0);
      
      // Call handleInteractionEnd directly (no ref needed)
      handleInteractionEnd();
      
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
    // PHASE 2 FIX: Allow drag events to bubble to parent slots for drag-and-drop preview
    // Only prevent default and stop propagation for photo manipulation, not for drag events
    console.log('🔥 PHASE 2 FIX: PhotoRenderer handlePointerDown - allowing drag events to bubble');
    // e.stopPropagation(); // REMOVED - this was blocking drag events from reaching slot containers
    setIsDragging(true);
    setLastPointer({ x: e.clientX, y: e.clientY });
    handleInteractionStart();
    
    // Call the onInteractionStart callback when user begins interacting
    if (onInteractionStart) {
      onInteractionStart();
    }
    
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
    // Use debounced transform change to prevent excessive parent updates during pointer drag
    debouncedTransformChange(newTransform);
    setLastPointer({ x: e.clientX, y: e.clientY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!interactive) return;
    
    setIsDragging(false);
    setLastPointer(null);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    // Track user interaction
    trackUserInteraction('drag-end');
    // Call handleInteractionEnd directly
    handleInteractionEnd();
    
    // No auto-corrections - user has complete control over positioning
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    
    e.preventDefault();
    handleInteractionStart();
    
    // Scale factor for zoom
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const minCoverZoom = calculateMinimumCoverZoom();
    
    // Allow zooming below cover minimum temporarily, but limit extreme zoom out
    const absoluteMinZoom = Math.max(0.1, minCoverZoom * 0.5);
    const newScale = Math.max(absoluteMinZoom, Math.min(10, currentTransform.photoScale * scaleFactor));
    
    const newTransform = createPhotoTransform(
      newScale,
      currentTransform.photoCenterX,
      currentTransform.photoCenterY
    );
    
    setCurrentTransform(newTransform);
    // Use debounced transform change to prevent excessive parent updates during wheel zoom
    debouncedTransformChange(newTransform);
    
    // Track user interaction
    trackUserInteraction('zoom');
    
    // Set timeout to end interaction after wheel zoom (consistent with touch behavior)
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
    }
    interactionTimeoutRef.current = setTimeout(() => {
      setIsInteracting(false);
      onInteractionChange?.(false);
      interactionTimeoutRef.current = null;
    }, 150); // Brief delay to allow for multiple quick wheel events
    
    // No immediate auto-fit - let user zoom freely without interference
  };

  // Use debug hook to generate debug UI
  const { debugInfo, gapIndicator } = usePhotoDebug({
    debug,
    currentTransform,
    interactive,
    isDragging,
    isTouching,
    isSnapping: false, // Always false now - animation removed to fix flashing
    calculateMathematicalGaps,
    calculateGapBasedMovement,
    hasRecentUserInteraction,
    lastUserInteraction,
    interactionType
  });

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
        src={getCurrentUrl()}
        alt={photoAlt}
        className="absolute inset-0"
        style={{
          ...photoStyle,
          // No transitions for instant response
          transition: 'none',
          // Improve image quality
          imageRendering: 'auto',
          backfaceVisibility: 'hidden',
          // Instant display - no fade effects or transitions
          display: imageLoaded && !imageError ? 'block' : 'none'
        }}
        draggable={false}
        onLoad={handleImageLoad}
        onError={handleImageError}
      />
      
      {/* Loading/Error state - only show on actual errors, not loading */}
      {imageError && (
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
                    // Keep imageLoaded=true for instant retry
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
      
      {/* Gap indicator overlay (debug mode only) */}
      {gapIndicator}
      
      {/* Debug UI rendered outside all containers via portal */}
      {debugInfo && (
        <DebugPortal>
          {debugInfo}
        </DebugPortal>
      )}
    </div>
  );
}

// Relaxed comparison function for React.memo - allow essential updates through
const arePropsEqual = (prevProps: PhotoRendererProps, nextProps: PhotoRendererProps): boolean => {
  // Allow ALL photoUrl changes through immediately - no blocking
  if (prevProps.photoUrl !== nextProps.photoUrl) {
    return false; // Always re-render for URL changes
  }
  
  // Allow interactive mode changes through
  if (prevProps.interactive !== nextProps.interactive ||
      prevProps.previewMode !== nextProps.previewMode) {
    return false; // Re-render for mode changes
  }
  
  // Allow transform updates to pass through - essential for real-time feedback
  if (prevProps.transform !== nextProps.transform) {
    return false; // Re-render for any transform change
  }
  
  // Only block re-renders for truly non-essential prop changes
  const nonEssentialChanged = 
    prevProps.showClippingIndicators !== nextProps.showClippingIndicators ||
    prevProps.debug !== nextProps.debug;
  
  // Allow non-essential changes through as well to prevent issues
  return false; // For now, allow all re-renders to prevent blocking issues
};

// Export memoized component to prevent unnecessary re-renders
export default React.memo(PhotoRenderer, arePropsEqual);

// Export utility functions for use in other components
export { convertPhotoToCSS, convertLegacyToCSS };