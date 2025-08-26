// Updated: App component..
import '../styles/globals.css';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import { Toaster } from 'react-hot-toast';
import ServiceWorkerRegistration from '../components/ServiceWorkerRegistration';
import { useViewportHeight } from '../hooks/useViewportHeight';
import { AlertProvider } from '../contexts/AlertContext';
import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  // Track viewport height for mobile browser compatibility
  useViewportHeight();
  
  // Disable unwanted browser interactions globally
  useEffect(() => {
    // Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      return false;
    };
    
    // Selectively disable drag start - allow for draggable elements
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      // Allow dragging if element has draggable attribute or is in favorites bar
      // Check for draggable attribute or if it's a photo in the favorites bar
      if (target.draggable || target.closest('[draggable]') || target.closest('.favorites-bar')) {
        return true;
      }
      // Prevent default dragging for other elements (non-draggable images, links, etc.)
      e.preventDefault();
      return false;
    };
    
    // Disable text selection on mobile long press
    const handleTouchStart = (e: TouchEvent) => {
      // Only prevent if it's a long press (handled by browser)
      if (e.touches.length > 1) return; // Allow multi-touch
    };
    
    // Add event listeners
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('dragstart', handleDragStart);
    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    
    // Cleanup on unmount
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('dragstart', handleDragStart);
      document.removeEventListener('touchstart', handleTouchStart);
    };
  }, []);
  
  return (
    <>
      <Head>
        {/* Mobile-optimized viewport configuration */}
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover, minimal-ui"
        />
      </Head>
      <ServiceWorkerRegistration />
      <AlertProvider>
        <Component {...pageProps} />
      </AlertProvider>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#4ade80',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </>
  );
} 