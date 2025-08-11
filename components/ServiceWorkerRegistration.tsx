import { useEffect } from 'react';
import { logger } from '../services/loggerService';

export default function ServiceWorkerRegistration() {
  useEffect(() => {
    let updateInterval: NodeJS.Timeout;
    
    const handleLoad = () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then((registration) => {
            logger.info('SERVICE_WORKER', 'Service Worker registered successfully', { scope: registration.scope });
            
            // Check for updates periodically
            updateInterval = setInterval(() => {
              registration.update();
            }, 60000); // Check every minute
            
            // Handle updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker available, prompt for update
                    logger.info('SERVICE_WORKER', 'New content available; please refresh.');
                  }
                });
              }
            });
          })
          .catch((error) => {
            logger.error('SERVICE_WORKER', 'Service Worker registration failed', error);
          });
      }
    };
    
    if (typeof window !== 'undefined') {
      window.addEventListener('load', handleLoad);
    }
    
    // Cleanup function
    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('load', handleLoad);
      }
    };
  }, []);

  return null;
}