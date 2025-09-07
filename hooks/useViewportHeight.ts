import { useEffect, useState } from 'react';

/**
 * Hook to detect and track the actual visible viewport height
 * Accounts for mobile browser UI (address bar, navigation, etc.)
 */
export function useViewportHeight() {
  const [viewportHeight, setViewportHeight] = useState<number>(
    typeof window !== 'undefined' ? window.innerHeight : 0
  );
  
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Function to update viewport height
    const updateViewportHeight = () => {
      const vh = window.innerHeight;
      setViewportHeight(vh);
      
      // Set CSS custom property for use in stylesheets
      document.documentElement.style.setProperty('--vh', `${vh * 0.01}px`);
      document.documentElement.style.setProperty('--full-vh', `${vh}px`);
      
      // Detect if we're in fullscreen mode (address bar hidden)
      // On mobile, when address bar is hidden, innerHeight increases
      const screenHeight = window.screen.height;
      const isLikelyFullscreen = vh / screenHeight > 0.85; // More than 85% of screen height
      setIsFullscreen(isLikelyFullscreen);
      
      // Log for debugging
      if (process.env.NODE_ENV === 'development') console.log('Viewport updated:', {
        innerHeight: vh,
        screenHeight,
        ratio: vh / screenHeight,
        isFullscreen: isLikelyFullscreen
      });
    };

    // Initial update
    updateViewportHeight();

    // Debounced resize handler to avoid excessive updates
    let resizeTimeout: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateViewportHeight, 100);
    };

    // Listen for viewport changes
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', updateViewportHeight);
    
    // Visual viewport API for more accurate mobile detection
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', updateViewportHeight);
      window.visualViewport.addEventListener('scroll', updateViewportHeight);
    }

    // Also update on scroll (helps detect when address bar hides on mobile)
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY) > 50) {
        lastScrollY = currentScrollY;
        updateViewportHeight();
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', updateViewportHeight);
      window.removeEventListener('scroll', handleScroll);
      
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', updateViewportHeight);
        window.visualViewport.removeEventListener('scroll', updateViewportHeight);
      }
      
      clearTimeout(resizeTimeout);
    };
  }, []);

  return {
    viewportHeight,
    isFullscreen,
    // Utility values
    vh: viewportHeight * 0.01, // 1vh equivalent
    safeHeight: viewportHeight, // Safe height to use for layouts
  };
}