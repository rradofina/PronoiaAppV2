import { useState, useEffect } from 'react';

interface ViewportConstraints {
  availableHeight: number;
  safeExpansionHeight: number;
  isConstrainedViewport: boolean;
  orientation: 'portrait' | 'landscape';
  adaptivePhotoSize: 'small' | 'medium' | 'large';
  maxPhotosToShow: number;
}

interface UseViewportConstraintsOptions {
  headerHeight?: number;
  minContentHeight?: number;
  padding?: number;
  maxExpansionRatio?: number;
  absoluteMaxHeight?: number;
}

export function useViewportConstraints(options: UseViewportConstraintsOptions = {}): ViewportConstraints {
  const {
    headerHeight = 120, // Approximate header + controls height
    minContentHeight = 300, // Minimum space for main content
    padding = 40, // Safe padding
    maxExpansionRatio = 0.4, // Max 40% of available space
    absoluteMaxHeight = 280 // Never exceed this height
  } = options;

  const [constraints, setConstraints] = useState<ViewportConstraints>({
    availableHeight: 0,
    safeExpansionHeight: 96, // Default h-24
    isConstrainedViewport: false,
    orientation: 'portrait',
    adaptivePhotoSize: 'medium',
    maxPhotosToShow: 6
  });

  const calculateConstraints = () => {
    // TABLET-SPECIFIC: Use visual viewport if available (accounts for virtual keyboard, browser chrome)
    const viewportHeight = (window.visualViewport?.height || window.innerHeight);
    const viewportWidth = (window.visualViewport?.width || window.innerWidth);
    
    // Determine orientation
    const orientation: 'portrait' | 'landscape' = viewportWidth > viewportHeight ? 'landscape' : 'portrait';
    
    // TABLET-SPECIFIC: Enhanced space calculations for portrait mode
    let effectiveHeaderHeight = headerHeight;
    let effectiveMinContentHeight = minContentHeight;
    let effectivePadding = padding;
    
    // Portrait tablet adjustments - more conservative approach
    if (orientation === 'portrait') {
      // Account for system UI, browser chrome, and potential split-screen mode
      effectiveHeaderHeight = Math.max(headerHeight, 140);
      effectivePadding = Math.max(padding, 60); // Increased safety margin
      
      // CLIPPING PREVENTION: Detect very constrained portrait tablets
      if (viewportHeight < 1000) {
        // Small/compact tablets need more conservative settings
        effectiveMinContentHeight = Math.max(minContentHeight, 420);
        effectivePadding = Math.max(effectivePadding, 80);
      }
    }
    
    // Calculate truly available space for expansion
    const reservedSpace = effectiveHeaderHeight + effectiveMinContentHeight + effectivePadding;
    const availableForExpansion = Math.max(0, viewportHeight - reservedSpace);
    
    // TABLET-SPECIFIC: More conservative expansion calculation
    const portraitMaxRatio = orientation === 'portrait' ? 0.35 : maxExpansionRatio; // Reduced from 0.45 to 0.35 for portrait
    const idealExpansionHeight = availableForExpansion * portraitMaxRatio;
    const safeExpansionHeight = Math.min(idealExpansionHeight, absoluteMaxHeight);
    
    // CLIPPING PREVENTION: Stricter constraint detection for portrait tablets
    const isConstrainedViewport = orientation === 'portrait' 
      ? safeExpansionHeight < 140 || viewportHeight < 900  // Stricter for portrait
      : safeExpansionHeight < 160; // Original logic for landscape
    
    // ENHANCED: Adaptive sizing strategy based on available space and orientation
    let adaptivePhotoSize: 'small' | 'medium' | 'large';
    let maxPhotosToShow: number;
    
    // PORTRAIT TABLET-SPECIFIC: More granular sizing decisions
    if (orientation === 'portrait') {
      if (viewportHeight < 900 || isConstrainedViewport) {
        // Very constrained portrait tablets (compact 8", old iPads)
        adaptivePhotoSize = 'small';
        maxPhotosToShow = 3;
      } else if (viewportHeight < 1100 || safeExpansionHeight < 180) {
        // Moderately constrained portrait tablets (standard tablets)
        adaptivePhotoSize = 'small';
        maxPhotosToShow = 4;
      } else if (safeExpansionHeight < 220) {
        // Well-sized portrait tablets
        adaptivePhotoSize = 'medium';
        maxPhotosToShow = 5;
      } else {
        // Large portrait tablets with plenty of space
        adaptivePhotoSize = 'medium'; // Keep medium for portrait, large can be too big
        maxPhotosToShow = 6;
      }
    } else {
      // LANDSCAPE: Original logic with minor adjustments
      if (isConstrainedViewport || viewportHeight < 700) {
        // Very constrained - prioritize fewer, reasonably sized photos
        adaptivePhotoSize = 'small';
        maxPhotosToShow = 4;
      } else if (safeExpansionHeight < 200) {
        // Moderately constrained
        adaptivePhotoSize = 'medium';
        maxPhotosToShow = 5;
      } else {
        // Plenty of space
        adaptivePhotoSize = 'large';
        maxPhotosToShow = 8;
      }
      
      // Override for landscape mode - be more conservative
      maxPhotosToShow = Math.min(maxPhotosToShow, 6);
    }
    
    return {
      availableHeight: availableForExpansion,
      safeExpansionHeight: Math.max(96, Math.round(safeExpansionHeight)), // Never below h-24
      isConstrainedViewport,
      orientation,
      adaptivePhotoSize,
      maxPhotosToShow
    };
  };

  useEffect(() => {
    // Initial calculation
    setConstraints(calculateConstraints());

    // Debounced resize handler
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setConstraints(calculateConstraints());
      }, 150); // Debounce resize events
    };

    // Listen for viewport changes
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    // Handle virtual keyboard on mobile/tablet
    const handleVisualViewportChange = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setConstraints(calculateConstraints());
      }, 300); // Longer delay for keyboard animations
    };
    
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleVisualViewportChange);
    }

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleVisualViewportChange);
      }
    };
  }, [headerHeight, minContentHeight, padding, maxExpansionRatio, absoluteMaxHeight]);

  return constraints;
}

// Utility function to get CSS height class from pixel value
export function getHeightClass(height: number): string {
  // Round to nearest Tailwind height class
  if (height <= 96) return 'h-24';
  if (height <= 128) return 'h-32';
  if (height <= 160) return 'h-40';
  if (height <= 192) return 'h-48';
  if (height <= 224) return 'h-56';
  if (height <= 256) return 'h-64';
  if (height <= 288) return 'h-72';
  
  // For larger heights, use custom height
  return `h-[${height}px]`;
}

// Utility function to get photo height class based on adaptive size
export function getAdaptivePhotoHeight(adaptiveSize: 'small' | 'medium' | 'large'): string {
  switch (adaptiveSize) {
    case 'small': return 'h-32'; // 128px
    case 'medium': return 'h-40'; // 160px
    case 'large': return 'h-48'; // 192px
    default: return 'h-40';
  }
}