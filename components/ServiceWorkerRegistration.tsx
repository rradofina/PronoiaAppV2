import { useEffect, useState } from 'react';
import { logger } from '../services/loggerService';
import toast from 'react-hot-toast';

export default function ServiceWorkerRegistration() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    let updateInterval: NodeJS.Timeout;
    let versionCheckInterval: NodeJS.Timeout;
    let currentVersion: string | null = null;
    
    const checkForNewVersion = async () => {
      try {
        const response = await fetch('/api/version', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        });
        
        if (response.ok) {
          const versionData = await response.json();
          const newVersion = versionData.deploymentId;
          
          if (currentVersion === null) {
            // First check - store current version
            currentVersion = newVersion;
            logger.info('SERVICE_WORKER', 'Current version:', { version: currentVersion });
          } else if (currentVersion !== newVersion) {
            // New version detected
            logger.info('SERVICE_WORKER', 'New version detected!', { 
              current: currentVersion, 
              new: newVersion 
            });
            
            // Update service worker
            if (registration) {
              registration.update();
            }
            
            // Show notification to user
            toast((t) => (
              <div>
                <p className="font-semibold">New version available!</p>
                <p className="text-sm">Click to update now</p>
                <div className="mt-2 flex gap-2">
                  <button
                    onClick={() => {
                      toast.dismiss(t.id);
                      window.location.reload();
                    }}
                    className="px-3 py-1 bg-blue-500 text-white rounded text-sm"
                  >
                    Update Now
                  </button>
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="px-3 py-1 bg-gray-300 rounded text-sm"
                  >
                    Later
                  </button>
                </div>
              </div>
            ), {
              duration: 10000,
              position: 'top-center',
            });
            
            setUpdateAvailable(true);
            currentVersion = newVersion;
          }
        }
      } catch (error) {
        logger.error('SERVICE_WORKER', 'Version check failed', error);
      }
    };
    
    const handleLoad = () => {
      if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker
          .register('/service-worker.js')
          .then((reg) => {
            logger.info('SERVICE_WORKER', 'Service Worker registered successfully', { scope: reg.scope });
            setRegistration(reg);
            
            // Check for updates every 30 seconds
            updateInterval = setInterval(() => {
              reg.update();
            }, 30000);
            
            // Check version endpoint every 60 seconds
            versionCheckInterval = setInterval(checkForNewVersion, 60000);
            
            // Initial version check
            checkForNewVersion();
            
            // Handle updates from service worker
            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // New service worker installed
                    logger.info('SERVICE_WORKER', 'New service worker installed, ready to activate');
                    
                    // Auto-reload after short delay
                    setTimeout(() => {
                      window.location.reload();
                    }, 2000);
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
      if (versionCheckInterval) {
        clearInterval(versionCheckInterval);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('load', handleLoad);
      }
    };
  }, [registration]);

  return null;
}