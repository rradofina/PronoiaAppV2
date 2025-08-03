import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  
  // Ref to expose finalization method
  finalizationRef?: React.MutableRefObject<(() => Promise<PhotoTransform>) | null>;
  
  // Interaction state callback
  onInteractionChange?: (isInteracting: boolean) => void;
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
function convertPhotoToCSS(photoTransform: PhotoTransform): React.CSSProperties {
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
    translation: { translateX, translateY },
    cssTransform,
    note: 'object-fit: contain baseline + adjustment scale for proper container scaling'
  });
  
  return {
    transform: cssTransform,
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
  showClippingIndicators = false,
  finalizationRef,
  onInteractionChange
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
  
  // Interaction state tracking for UI hiding
  const [isInteracting, setIsInteracting] = useState(false);
  const interactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // User interaction tracking to prevent auto-snap on recently manipulated photos
  const [lastUserInteraction, setLastUserInteraction] = useState<number>(0);
  const [interactionType, setInteractionType] = useState<string>('none');
  
  // Track user interactions to prevent auto-snap immediately after user manipulation
  const trackUserInteraction = useCallback((type: string) => {
    const now = Date.now();
    setLastUserInteraction(now);
    setInteractionType(type);
    if (debug) {
      console.log(`👆 User interaction tracked: ${type} at ${now}`);
    }
  }, [debug]);
  
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
  
  const handleInteractionEnd = useCallback(() => {
    // Clear any existing timeout
    if (interactionTimeoutRef.current) {
      clearTimeout(interactionTimeoutRef.current);
      interactionTimeoutRef.current = null;
    }
    
    // Show UI immediately
    setIsInteracting(false);
    onInteractionChange?.(false);
  }, [onInteractionChange]);
  
  // Check if user has recently interacted with photo (within last 3 seconds)
  const hasRecentUserInteraction = useCallback(() => {
    const timeSinceInteraction = Date.now() - lastUserInteraction;
    const RECENT_INTERACTION_THRESHOLD = 3000; // 3 seconds
    const isRecent = timeSinceInteraction < RECENT_INTERACTION_THRESHOLD;
    
    if (debug && isRecent) {
      console.log(`⏱️ Recent user interaction detected: ${interactionType} ${timeSinceInteraction}ms ago`);
    }
    
    return isRecent;
  }, [lastUserInteraction, interactionType, debug]);
  
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
    
    // Get accurate DOM measurements
    const imageRect = imageRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    
    if (imageRect.width === 0 || imageRect.height === 0) {
      return { 
        hasGaps: false, 
        gapCount: 0,
        gaps: { left: 0, right: 0, top: 0, bottom: 0 }, 
        significantGaps: { left: false, right: false, top: false, bottom: false }
      };
    }
    
    // Calculate precise gaps in pixels (round up to ensure complete gap closure)
    const gapLeft = Math.ceil(imageRect.left - containerRect.left);
    const gapRight = Math.ceil(containerRect.right - imageRect.right);
    const gapTop = Math.ceil(imageRect.top - containerRect.top);
    const gapBottom = Math.ceil(containerRect.bottom - imageRect.bottom);
    
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
      console.log('🔍 Gap Detection (User Specification):', {
        gaps: { left: gapLeft, right: gapRight, top: gapTop, bottom: gapBottom },
        significantGaps: { left: hasLeftGap, right: hasRightGap, top: hasTopGap, bottom: hasBottomGap },
        gapCount,
        threshold: GAP_THRESHOLD,
        action: gapCount >= 3 ? 'Reset to default' : 
               gapCount === 2 ? 'Move by both gap amounts' :
               gapCount === 1 ? 'Move by single gap amount' : 'No action needed'
      });
    }
    
    return {
      hasGaps: hasAnyGaps,
      gapCount,
      gaps: { left: gapLeft, right: gapRight, top: gapTop, bottom: gapBottom },
      significantGaps: { left: hasLeftGap, right: hasRightGap, top: hasTopGap, bottom: hasBottomGap }
    };
    
  }, [debug]);

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
    
    // Calculate how the photo would fit in the container
    const containerAspect = containerWidth / containerHeight;
    const photoAspect = photoNaturalWidth / photoNaturalHeight;
    
    let fitWidth, fitHeight;
    if (photoAspect > containerAspect) {
      // Photo is wider - fit by width
      fitWidth = containerWidth;
      fitHeight = containerWidth / photoAspect;
    } else {
      // Photo is taller - fit by height
      fitHeight = containerHeight;
      fitWidth = containerHeight * photoAspect;
    }
    
    // Apply scale
    const scaledWidth = fitWidth * scale;
    const scaledHeight = fitHeight * scale;
    
    // Calculate photo position based on center coordinates
    const photoCenterXPx = newCenterX * scaledWidth;
    const photoCenterYPx = newCenterY * scaledHeight;
    
    // Calculate photo edges relative to container
    const photoLeft = (containerWidth / 2) - photoCenterXPx;
    const photoRight = photoLeft + scaledWidth;
    const photoTop = (containerHeight / 2) - photoCenterYPx;
    const photoBottom = photoTop + scaledHeight;
    
    // Calculate gaps (positive values indicate empty space)
    const gapLeft = Math.max(0, photoLeft);
    const gapRight = Math.max(0, containerWidth - photoRight);
    const gapTop = Math.max(0, photoTop);
    const gapBottom = Math.max(0, containerHeight - photoBottom);
    
    // Post-snap validation uses allowance threshold (user requested >0px)
    const POST_SNAP_THRESHOLD = 5; // 5px allowance for post-snap validation
    
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
        newCenterX: currentTransform.photoCenterX,
        newCenterY: currentTransform.photoCenterY,
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
        newCenterX: currentTransform.photoCenterX,
        newCenterY: currentTransform.photoCenterY,
        movements: { horizontal: 'no change', vertical: 'no change' }
      };
    }
    
    // Calculate movement based on gaps (convert pixels to percentage of photo transform)
    let horizontalMovement = 0;
    let verticalMovement = 0;
    let horizontalDescription = 'no change';
    let verticalDescription = 'no change';
    
    // Horizontal movement
    if (significantGaps.left) {
      // Gap on left → move photo right to close the gap
      horizontalMovement = gaps.left / containerRect.width;
      horizontalDescription = `move right ${gaps.left}px`;
    } else if (significantGaps.right) {
      // Gap on right → move photo left to close the gap  
      horizontalMovement = -gaps.right / containerRect.width;
      horizontalDescription = `move left ${gaps.right}px`;
    }
    
    // Vertical movement  
    if (significantGaps.top) {
      // Gap on top → move photo down to close the gap
      verticalMovement = gaps.top / containerRect.height;
      verticalDescription = `move down ${gaps.top}px`;
    } else if (significantGaps.bottom) {
      // Gap on bottom → move photo up to close the gap
      verticalMovement = -gaps.bottom / containerRect.height;
      verticalDescription = `move up ${gaps.bottom}px`;
    }
    
    // Apply movements to current position
    const newCenterX = Math.max(0.05, Math.min(0.95, currentTransform.photoCenterX + horizontalMovement));
    const newCenterY = Math.max(0.05, Math.min(0.95, currentTransform.photoCenterY + verticalMovement));
    
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
      console.log('📐 Gap-Based Movement Calculation:', {
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
      movements: { horizontal: horizontalDescription, vertical: verticalDescription }
    };
  }, [currentTransform, debug, detectPostSnapGaps]);

  // Gap-based finalization following user's exact specification
  const finalizePositioning = useCallback((): Promise<PhotoTransform> => {
    return new Promise((resolve) => {
      const performFinalization = () => {
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
          resolve(currentTransform);
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
          resolve(currentTransform);
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
          // 3+ sides with gaps → Reset to default (scale 1, centered)
          console.log('🔄 RESET TO DEFAULT: Creating transform (1, 0.5, 0.5)');
          finalizedTransform = createPhotoTransform(1, 0.5, 0.5);
          console.log('✅ CREATED RESET TRANSFORM:', finalizedTransform);
          if (debug) {
            console.log('🔄 Resetting to default: 3+ sides have gaps');
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
          setIsSnapping(true);
          setCurrentTransform(finalizedTransform);
          console.log('✅ Transform state updated');
          
          if (onTransformChange) {
            console.log('📡 Calling onTransformChange callback...');
            onTransformChange(finalizedTransform);
            console.log('✅ Callback executed');
          } else {
            console.log('⚠️ No onTransformChange callback provided');
          }
          
          setTimeout(() => {
            setIsSnapping(false);
            console.log('✅ FINALIZATION COMPLETE - Animation finished');
            if (debug) console.log('✅ Gap-based finalization complete');
            resolve(finalizedTransform);
          }, 350);
        } else {
          console.log('ℹ️ NO CHANGE: Transforms are identical, resolving with current');
          resolve(currentTransform);
        }
      };

      // Use requestAnimationFrame to ensure DOM measurements are accurate
      requestAnimationFrame(() => {
        requestAnimationFrame(performFinalization);
      });
    });
  }, [currentTransform, detectGaps, calculateGapBasedMovement, onTransformChange, debug, hasRecentUserInteraction, createPhotoTransform]);

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
    handleInteractionStart();
    
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
    setIsDragging(true);
    setLastPointer({ x: e.clientX, y: e.clientY });
    handleInteractionStart();
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
    
    // Track user interaction
    trackUserInteraction('drag-end');
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
    onTransformChange?.(newTransform);
    
    // Track user interaction
    trackUserInteraction('zoom');
    
    // Show UI immediately after wheel zoom
    setIsInteracting(false);
    onInteractionChange?.(false);
    
    // No immediate auto-fit - let user zoom freely without interference
  };

  // Gap-based debug info following user specification
  const debugInfo = debug ? (() => {
    const gapData = detectGaps();
    const movement = gapData.hasGaps ? calculateGapBasedMovement(gapData) : null;
    
    return (
      <div className="absolute top-2 left-2 bg-black bg-opacity-90 text-white text-xs p-3 rounded z-50 pointer-events-none max-w-sm">
        <div className="font-bold mb-2">Gap-Based Auto-Snap Debug</div>
        <div>Scale: {currentTransform.photoScale.toFixed(2)}</div>
        <div>Center X: {currentTransform.photoCenterX.toFixed(3)}</div>
        <div>Center Y: {currentTransform.photoCenterY.toFixed(3)}</div>
        <div>Interactive: {interactive ? 'Yes' : 'No'}</div>
        <div>Dragging: {isDragging ? 'Yes' : 'No'}</div>
        <div>Touching: {isTouching ? 'Yes' : 'No'}</div>
        <div>Snapping: {isSnapping ? 'Yes' : 'No'}</div>
        
        <div className="mt-2 border-t border-gray-600 pt-2">
          <div className="font-semibold">Gap Detection:</div>
          <div>Gap Count: {gapData.gapCount}</div>
          <div>L:{gapData.gaps.left} R:{gapData.gaps.right}</div>
          <div>T:{gapData.gaps.top} B:{gapData.gaps.bottom}</div>
          <div className="text-xs text-gray-300">
            Significant: {Object.entries(gapData.significantGaps).filter(([_, hasGap]) => hasGap).map(([side]) => side).join(', ') || 'none'}
          </div>
        </div>
        
        <div className="mt-2 border-t border-gray-600 pt-2">
          <div className="font-semibold">Action Plan:</div>
          <div className="text-xs">
            {gapData.gapCount >= 3 ? 'Reset to default (3+ gaps)' :
             gapData.gapCount === 2 ? 'Move by both gap amounts' :
             gapData.gapCount === 1 ? 'Move by single gap amount' : 'No action needed'}
          </div>
          {movement && movement.action !== 'none' && (
            <>
              <div className="text-xs text-yellow-300">H: {movement.movements.horizontal}</div>
              <div className="text-xs text-yellow-300">V: {movement.movements.vertical}</div>
              {movement.movements.horizontal.includes('post-snap override') && (
                <div className="text-xs text-red-300">⚠️ Post-snap validation triggered</div>
              )}
            </>
          )}
        </div>
        
        <div className="mt-2 border-t border-gray-600 pt-2">
          <div className="font-semibold">Status:</div>
          <div className="text-xs">Recent Interaction: {hasRecentUserInteraction() ? `${interactionType} (${((Date.now() - lastUserInteraction) / 1000).toFixed(1)}s ago)` : 'No'}</div>
          <div className="text-xs">Will Apply: {gapData.hasGaps ? 'Yes' : 'No'}</div>
        </div>
        
        <div className="mt-2 text-xs text-green-300">Mode: User-Specified Gap Movement</div>
      </div>
    );
  })() : null;

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
      
      {/* Gap indicator overlay (debug mode only) */}
      {debug && (() => {
        const gapData = detectGaps();
        if (!gapData.hasGaps) return null;
        
        return (
          <div className="absolute inset-0 pointer-events-none z-40">
            <div className="absolute top-2 right-2 bg-yellow-600 text-white text-xs px-2 py-1 rounded">
              {gapData.gapCount} gap{gapData.gapCount > 1 ? 's' : ''}
            </div>
          </div>
        );
      })()}
      
      {debugInfo}
    </div>
  );
}

// Export utility functions for use in other components
export { convertPhotoToCSS, convertLegacyToCSS };