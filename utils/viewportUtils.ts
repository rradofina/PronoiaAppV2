/**
 * Viewport utilities for iPad Safari and mobile browser compatibility
 * Handles dynamic viewport height changes and visual viewport API
 */

export interface ViewportInfo {
  width: number;
  height: number;
  visualHeight: number;
  isIpad: boolean;
  isMobile: boolean;
  orientation: 'portrait' | 'landscape';
}

/**
 * Get comprehensive viewport information
 */
export function getViewportInfo(): ViewportInfo {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const visualHeight = window.visualViewport?.height || height;
  
  // Detect iPad (including iPad Pro)
  const isIpad = /iPad|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
  
  // Detect mobile devices
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  // Determine orientation
  const orientation = width > height ? 'landscape' : 'portrait';
  
  return {
    width,
    height,
    visualHeight,
    isIpad,
    isMobile,
    orientation
  };
}

/**
 * Setup dynamic viewport height handling for iPad Safari
 */
export function setupViewportHandler(callback?: (info: ViewportInfo) => void) {
  const updateViewportHeight = () => {
    const info = getViewportInfo();
    
    // Set CSS custom property for visual viewport height
    document.documentElement.style.setProperty(
      '--visual-viewport-height',
      `${info.visualHeight}px`
    );
    
    // Add class to enable visual viewport usage
    const mainContent = document.querySelector('.layout-main-content');
    if (mainContent && info.isIpad) {
      mainContent.classList.add('use-visual-viewport');
    }
    
    // Call optional callback
    callback?.(info);
    
    if (process.env.NODE_ENV === 'development') console.log('📱 Viewport updated:', {
      dimensions: `${info.width}×${info.height}`,
      visualHeight: info.visualHeight,
      isIpad: info.isIpad,
      orientation: info.orientation
    });
  };
  
  // Initial setup
  updateViewportHeight();
  
  // Listen for viewport changes (iPad Safari UI showing/hiding)
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateViewportHeight);
    window.visualViewport.addEventListener('scroll', updateViewportHeight);
  }
  
  // Fallback for orientation changes
  window.addEventListener('orientationchange', () => {
    setTimeout(updateViewportHeight, 100); // Delay to let UI settle
  });
  
  window.addEventListener('resize', updateViewportHeight);
  
  return () => {
    // Cleanup function
    if (window.visualViewport) {
      window.visualViewport.removeEventListener('resize', updateViewportHeight);
      window.visualViewport.removeEventListener('scroll', updateViewportHeight);
    }
    window.removeEventListener('orientationchange', updateViewportHeight);
    window.removeEventListener('resize', updateViewportHeight);
  };
}

// REMOVED: Unused functions - needsViewportFix and getSafeViewportHeight