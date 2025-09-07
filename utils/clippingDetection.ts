// CLIPPING PREVENTION: Runtime monitoring and detection utilities for portrait tablets

interface ViewportInfo {
  width: number;
  height: number;
  orientation: 'portrait' | 'landscape';
  isTablet: boolean;
  hasVirtualKeyboard: boolean;
  availableHeight: number;
}


/**
 * Get comprehensive viewport information for clipping detection
 */
export function getViewportInfo(): ViewportInfo {
  if (typeof window === 'undefined') {
    return {
      width: 1024,
      height: 1366,
      orientation: 'portrait',
      isTablet: true,
      hasVirtualKeyboard: false,
      availableHeight: 1366
    };
  }

  const width = window.visualViewport?.width || window.innerWidth;
  const height = window.visualViewport?.height || window.innerHeight;
  const screenHeight = window.screen?.height || height;
  
  // Detect if virtual keyboard is active (mobile/tablet)
  const hasVirtualKeyboard = screenHeight > height + 150;
  
  // Simple tablet detection based on screen size and touch capability
  const isTablet = (width >= 768 && width <= 1366) && 
                   ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  
  const orientation: 'portrait' | 'landscape' = width > height ? 'landscape' : 'portrait';
  
  return {
    width,
    height,
    orientation,
    isTablet,
    hasVirtualKeyboard,
    availableHeight: height
  };
}




