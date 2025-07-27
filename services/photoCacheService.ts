import { Photo } from '../types';

interface CachedPhoto {
  photo: Photo;
  blobUrl: string;
  highResUrl: string;
  downloadTime: number;
  lastAccessed: number;
  expiresAt: number;
}

interface LoadingPromise {
  promise: Promise<string>;
  startTime: number;
}

class PhotoCacheService {
  private cache = new Map<string, CachedPhoto>();
  private loadingQueue = new Map<string, LoadingPromise>();
  private preloadQueue: string[] = [];
  private maxCacheSize = 50; // Maximum number of cached photos
  private cacheExpiryTime = 30 * 60 * 1000; // 30 minutes
  private debug = process.env.NODE_ENV === 'development';
  private performanceMetrics = {
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    averageLoadTime: 0,
    totalLoadTime: 0
  };

  /**
   * Get a high-quality blob URL for a photo
   * Returns cached version immediately if available, otherwise loads asynchronously
   */
  async getBlobUrl(photo: Photo): Promise<string> {
    const photoId = photo.googleDriveId || photo.id;
    this.performanceMetrics.totalRequests++;
    
    // Check if already cached and not expired
    const cached = this.cache.get(photoId);
    if (cached && Date.now() < cached.expiresAt) {
      cached.lastAccessed = Date.now();
      this.performanceMetrics.cacheHits++;
      if (this.debug) {
        console.log(`📦 Photo cache HIT for ${photo.name} (cached ${Math.round((Date.now() - cached.downloadTime) / 1000)}s ago)`);
      }
      return cached.blobUrl;
    }

    this.performanceMetrics.cacheMisses++;

    // Check if already loading
    const loading = this.loadingQueue.get(photoId);
    if (loading) {
      if (this.debug) {
        console.log(`⏳ Photo already loading for ${photo.name} (${Math.round((Date.now() - loading.startTime) / 1000)}s elapsed)`);
      }
      return loading.promise;
    }

    // Start loading
    const loadPromise = this.loadPhotoBlob(photo);
    this.loadingQueue.set(photoId, {
      promise: loadPromise,
      startTime: Date.now()
    });

    try {
      const blobUrl = await loadPromise;
      this.loadingQueue.delete(photoId);
      return blobUrl;
    } catch (error) {
      this.loadingQueue.delete(photoId);
      throw error;
    }
  }

  /**
   * Get immediate URL for photo (non-blob, high-res)
   * Use this for instant display while blob loads in background
   */
  getImmediateUrl(photo: Photo): string {
    const photoId = photo.googleDriveId || photo.id;
    const cached = this.cache.get(photoId);
    
    if (cached && Date.now() < cached.expiresAt) {
      cached.lastAccessed = Date.now();
      return cached.blobUrl; // Return cached blob if available
    }
    
    // Return high-res URL immediately while blob loads in background
    const { getBestPhotoUrl } = require('../utils/photoUrlUtils');
    return getBestPhotoUrl(photo);
  }

  /**
   * Preload a photo in the background
   */
  async preloadPhoto(photo: Photo): Promise<void> {
    const photoId = photo.googleDriveId || photo.id;
    
    // Don't preload if already cached or loading
    if (this.cache.has(photoId) || this.loadingQueue.has(photoId)) {
      return;
    }

    // Add to preload queue if not already there
    if (!this.preloadQueue.includes(photoId)) {
      this.preloadQueue.push(photoId);
      
      if (this.debug) {
        console.log(`🔄 Preloading photo: ${photo.name}`);
      }
      
      try {
        await this.getBlobUrl(photo);
        if (this.debug) {
          console.log(`✅ Preloaded photo: ${photo.name}`);
        }
      } catch (error) {
        if (this.debug) {
          console.error(`❌ Failed to preload photo: ${photo.name}`, error);
        }
      } finally {
        // Remove from preload queue
        const index = this.preloadQueue.indexOf(photoId);
        if (index > -1) {
          this.preloadQueue.splice(index, 1);
        }
      }
    }
  }

  /**
   * Load photo blob from Google Drive service
   */
  private async loadPhotoBlob(photo: Photo): Promise<string> {
    const startTime = Date.now();
    const photoId = photo.googleDriveId || photo.id;

    try {
      if (this.debug) {
        console.log(`🔄 Loading blob for ${photo.name}...`);
      }

      const { googleDriveService } = await import('./googleDriveService');
      const blob = await googleDriveService.downloadPhoto(photoId);
      const blobUrl = URL.createObjectURL(blob);
      
      const downloadTime = Date.now() - startTime;
      
      // Cache the result
      const { getBestPhotoUrl } = await import('../utils/photoUrlUtils');
      const cachedPhoto: CachedPhoto = {
        photo,
        blobUrl,
        highResUrl: getBestPhotoUrl(photo),
        downloadTime: Date.now(),
        lastAccessed: Date.now(),
        expiresAt: Date.now() + this.cacheExpiryTime
      };

      this.cache.set(photoId, cachedPhoto);
      this.cleanupCache();

      // Update performance metrics
      this.performanceMetrics.totalLoadTime += downloadTime;
      this.performanceMetrics.averageLoadTime = this.performanceMetrics.totalLoadTime / this.performanceMetrics.cacheMisses;

      if (this.debug) {
        console.log(`✅ Loaded blob for ${photo.name} in ${downloadTime}ms (avg: ${Math.round(this.performanceMetrics.averageLoadTime)}ms)`);
      }

      return blobUrl;
    } catch (error) {
      if (this.debug) {
        console.error(`❌ Failed to load blob for ${photo.name}:`, error);
      }
      
      // Fallback to high-res URL
      const { getBestPhotoUrl, addCacheBuster } = await import('../utils/photoUrlUtils');
      return addCacheBuster(getBestPhotoUrl(photo));
    }
  }

  /**
   * Clean up expired cache entries and enforce size limits
   */
  private cleanupCache(): void {
    const now = Date.now();
    
    // Remove expired entries
    for (const [photoId, cached] of this.cache.entries()) {
      if (now > cached.expiresAt) {
        URL.revokeObjectURL(cached.blobUrl);
        this.cache.delete(photoId);
        if (this.debug) {
          console.log(`🧹 Expired cache entry for photo ${cached.photo.name}`);
        }
      }
    }

    // Enforce cache size limit
    if (this.cache.size > this.maxCacheSize) {
      // Sort by last accessed time (oldest first)
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      // Remove oldest entries
      const toRemove = entries.slice(0, entries.length - this.maxCacheSize);
      for (const [photoId, cached] of toRemove) {
        URL.revokeObjectURL(cached.blobUrl);
        this.cache.delete(photoId);
        if (this.debug) {
          console.log(`🧹 Removed LRU cache entry for photo ${cached.photo.name}`);
        }
      }
    }
  }

  /**
   * Clear all cached photos
   */
  clearCache(): void {
    for (const [photoId, cached] of this.cache.entries()) {
      URL.revokeObjectURL(cached.blobUrl);
    }
    this.cache.clear();
    this.preloadQueue.length = 0;
    if (this.debug) {
      console.log('🧹 Photo cache cleared');
    }
  }

  /**
   * Get cache statistics and performance metrics
   */
  getCacheStats(): {
    cacheSize: number;
    loadingCount: number;
    preloadQueueSize: number;
    cacheHitRate: number;
    averageLoadTime: number;
    totalRequests: number;
  } {
    const hitRate = this.performanceMetrics.totalRequests > 0 
      ? (this.performanceMetrics.cacheHits / this.performanceMetrics.totalRequests) * 100 
      : 0;

    return {
      cacheSize: this.cache.size,
      loadingCount: this.loadingQueue.size,
      preloadQueueSize: this.preloadQueue.length,
      cacheHitRate: Math.round(hitRate * 100) / 100,
      averageLoadTime: Math.round(this.performanceMetrics.averageLoadTime),
      totalRequests: this.performanceMetrics.totalRequests
    };
  }

  /**
   * Log performance summary to console
   */
  logPerformanceStats(): void {
    const stats = this.getCacheStats();
    console.group('📊 Photo Cache Performance Stats');
    console.log(`Cache Hit Rate: ${stats.cacheHitRate}%`);
    console.log(`Average Load Time: ${stats.averageLoadTime}ms`);
    console.log(`Total Requests: ${stats.totalRequests}`);
    console.log(`Cache Size: ${stats.cacheSize}/${this.maxCacheSize}`);
    console.log(`Currently Loading: ${stats.loadingCount}`);
    console.log(`Preload Queue: ${stats.preloadQueueSize}`);
    console.groupEnd();
  }

  /**
   * Check if photo is cached
   */
  isCached(photo: Photo): boolean {
    const photoId = photo.googleDriveId || photo.id;
    const cached = this.cache.get(photoId);
    return cached !== undefined && Date.now() < cached.expiresAt;
  }

  /**
   * Check if photo is currently loading
   */
  isLoading(photo: Photo): boolean {
    const photoId = photo.googleDriveId || photo.id;
    return this.loadingQueue.has(photoId);
  }
}

// Export singleton instance
export const photoCacheService = new PhotoCacheService();

// Make performance functions available globally for console access
if (typeof window !== 'undefined') {
  (window as any).photoCacheStats = () => photoCacheService.logPerformanceStats();
  (window as any).clearPhotoCache = () => photoCacheService.clearCache();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    photoCacheService.clearCache();
  });
}