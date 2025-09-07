/**
 * Template Cache Service
 * Implements hybrid template caching with base64 previews and full-quality blob caching
 * Provides instant loading with progressive enhancement
 */

import { googleDriveService } from './googleDriveService';

interface CachedTemplate {
  id: string;
  blobUrl: string;
  cachedAt: number;
  size: number;
  lastAccessed: number;
}

interface TemplatePreview {
  id: string;
  base64Preview: string;
  fullQualityBlobUrl?: string;
  isFullQualityLoaded: boolean;
}

class TemplateCacheServiceImpl {
  private cache: Map<string, CachedTemplate> = new Map();
  private previewCache: Map<string, TemplatePreview> = new Map();
  private downloadPromises: Map<string, Promise<string>> = new Map();
  
  // Configuration
  private readonly MAX_CACHE_SIZE = 100 * 1024 * 1024; // 100MB max cache
  private readonly MAX_CACHE_AGE = 24 * 60 * 60 * 1000; // 24 hours
  private readonly CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
  private readonly STORAGE_KEY = 'template_cache_metadata';
  
  constructor() {
    this.initializeCache();
    this.startCleanupInterval();
  }

  /**
   * Get template with progressive loading
   * Returns base64 preview immediately, loads full quality in background
   */
  async getTemplate(templateId: string, driveFileId: string, base64Preview?: string): Promise<{
    previewUrl: string;
    fullQualityUrl?: string;
    isFullQualityLoaded: boolean;
  }> {
    // Check if we have the template in preview cache
    let preview = this.previewCache.get(templateId);
    
    if (!preview && base64Preview) {
      // Create preview entry
      preview = {
        id: templateId,
        base64Preview,
        isFullQualityLoaded: false
      };
      this.previewCache.set(templateId, preview);
    }

    // Check if we have full quality cached
    const cached = this.getCachedTemplate(templateId);
    if (cached) {
      if (process.env.NODE_ENV === 'development') console.log(`🚀 Template ${templateId} loaded from cache instantly`);
      cached.lastAccessed = Date.now();
      
      // Update preview with full quality
      if (preview) {
        preview.fullQualityBlobUrl = cached.blobUrl;
        preview.isFullQualityLoaded = true;
      }
      
      return {
        previewUrl: cached.blobUrl,
        fullQualityUrl: cached.blobUrl,
        isFullQualityLoaded: true
      };
    }

    // Start background download if not already in progress
    if (!this.downloadPromises.has(templateId)) {
      if (process.env.NODE_ENV === 'development') console.log(`📥 Starting background download for template ${templateId}`);
      const downloadPromise = this.downloadAndCache(templateId, driveFileId);
      this.downloadPromises.set(templateId, downloadPromise);
      
      // Clean up promise when done
      downloadPromise.finally(() => {
        this.downloadPromises.delete(templateId);
      });
    }

    // Return preview immediately if available
    if (preview?.base64Preview) {
      if (process.env.NODE_ENV === 'development') console.log(`⚡ Template ${templateId} showing base64 preview instantly`);
      
      // Update preview when download completes
      this.downloadPromises.get(templateId)?.then(blobUrl => {
        if (preview) {
          preview.fullQualityBlobUrl = blobUrl;
          preview.isFullQualityLoaded = true;
          if (process.env.NODE_ENV === 'development') console.log(`✨ Template ${templateId} upgraded to full quality`);
        }
      });
      
      return {
        previewUrl: preview.base64Preview,
        fullQualityUrl: undefined,
        isFullQualityLoaded: false
      };
    }

    // No preview available, wait for download
    if (process.env.NODE_ENV === 'development') console.log(`⏳ Template ${templateId} downloading (no preview available)`);
    const blobUrl = await this.downloadPromises.get(templateId)!;
    
    return {
      previewUrl: blobUrl,
      fullQualityUrl: blobUrl,
      isFullQualityLoaded: true
    };
  }

  /**
   * Preload templates for a package
   * Downloads all templates in background for instant access
   */
  async preloadPackageTemplates(templates: Array<{
    id: string;
    driveFileId: string;
    base64Preview?: string;
  }>): Promise<void> {
    if (process.env.NODE_ENV === 'development') console.log(`🎯 Preloading ${templates.length} templates for package`);
    
    // Add all previews to cache immediately
    templates.forEach(template => {
      if (template.base64Preview) {
        this.previewCache.set(template.id, {
          id: template.id,
          base64Preview: template.base64Preview,
          isFullQualityLoaded: false
        });
      }
    });

    // Start downloading templates that aren't cached
    const downloadPromises = templates
      .filter(template => !this.getCachedTemplate(template.id))
      .map(template => this.downloadAndCache(template.id, template.driveFileId));

    // Wait for all downloads with progress logging
    const results = await Promise.allSettled(downloadPromises);
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    if (process.env.NODE_ENV === 'development') console.log(`✅ Template preloading complete: ${successful} successful, ${failed} failed`);
  }

  /**
   * Download template and add to cache
   */
  private async downloadAndCache(templateId: string, driveFileId: string): Promise<string> {
    try {
      if (process.env.NODE_ENV === 'development') console.log(`📡 Downloading template ${templateId} from Google Drive`);
      const blob = await googleDriveService.downloadTemplate(driveFileId);
      const blobUrl = URL.createObjectURL(blob);
      
      // Add to cache
      const cached: CachedTemplate = {
        id: templateId,
        blobUrl,
        cachedAt: Date.now(),
        size: blob.size,
        lastAccessed: Date.now()
      };
      
      this.cache.set(templateId, cached);
      this.updateCacheMetadata();
      
      if (process.env.NODE_ENV === 'development') console.log(`💾 Template ${templateId} cached successfully (${this.formatFileSize(blob.size)})`);
      return blobUrl;
    } catch (error) {
      console.error(`❌ Failed to download template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Get cached template if available and not expired
   */
  private getCachedTemplate(templateId: string): CachedTemplate | null {
    const cached = this.cache.get(templateId);
    if (!cached) return null;

    // Check if expired
    const age = Date.now() - cached.cachedAt;
    if (age > this.MAX_CACHE_AGE) {
      if (process.env.NODE_ENV === 'development') console.log(`🗑️ Template ${templateId} expired from cache`);
      this.removeFromCache(templateId);
      return null;
    }

    return cached;
  }

  /**
   * Remove template from cache and revoke blob URL
   */
  private removeFromCache(templateId: string): void {
    const cached = this.cache.get(templateId);
    if (cached) {
      URL.revokeObjectURL(cached.blobUrl);
      this.cache.delete(templateId);
      this.previewCache.delete(templateId);
    }
  }

  /**
   * Initialize cache from localStorage metadata
   */
  private initializeCache(): void {
    // Skip if running on server-side
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      const metadata = localStorage.getItem(this.STORAGE_KEY);
      if (metadata) {
        const parsed = JSON.parse(metadata);
        if (process.env.NODE_ENV === 'development') console.log(`🔄 Template cache initialized with ${Object.keys(parsed).length} entries`);
      }
    } catch (error) {
      console.warn('Failed to initialize template cache:', error);
    }
  }

  /**
   * Clean up expired templates and manage cache size
   */
  private cleanup(): void {
    const now = Date.now();
    let totalSize = 0;
    const templates: Array<[string, CachedTemplate]> = [];

    // Collect all cached templates with their sizes
    for (const [id, cached] of this.cache) {
      const age = now - cached.cachedAt;
      
      if (age > this.MAX_CACHE_AGE) {
        // Remove expired
        this.removeFromCache(id);
        continue;
      }
      
      totalSize += cached.size;
      templates.push([id, cached]);
    }

    // If over size limit, remove least recently used
    if (totalSize > this.MAX_CACHE_SIZE) {
      if (process.env.NODE_ENV === 'development') console.log(`🧹 Cache size exceeded (${this.formatFileSize(totalSize)}), cleaning up...`);
      
      // Sort by last accessed (oldest first)
      templates.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
      
      // Remove oldest until under limit
      for (const [id, cached] of templates) {
        if (totalSize <= this.MAX_CACHE_SIZE * 0.8) break; // Clean to 80% of limit
        
        this.removeFromCache(id);
        totalSize -= cached.size;
      }
      
      if (process.env.NODE_ENV === 'development') console.log(`✅ Cache cleaned up, new size: ${this.formatFileSize(totalSize)}`);
    }

    this.updateCacheMetadata();
  }

  /**
   * Start periodic cleanup
   */
  private startCleanupInterval(): void {
    setInterval(() => this.cleanup(), this.CLEANUP_INTERVAL);
  }

  /**
   * Update cache metadata in localStorage
   */
  private updateCacheMetadata(): void {
    // Skip if running on server-side
    if (typeof window === 'undefined') {
      return;
    }
    
    try {
      const metadata: Record<string, { cachedAt: number; size: number }> = {};
      for (const [id, cached] of this.cache) {
        metadata[id] = {
          cachedAt: cached.cachedAt,
          size: cached.size
        };
      }
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(metadata));
    } catch (error) {
      console.warn('Failed to update cache metadata:', error);
    }
  }

  /**
   * Format file size for logging
   */
  private formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    totalTemplates: number;
    totalSize: number;
    hitRate: number;
    oldestTemplate: Date | null;
  } {
    let totalSize = 0;
    let oldestTimestamp = Infinity;
    
    for (const cached of this.cache.values()) {
      totalSize += cached.size;
      oldestTimestamp = Math.min(oldestTimestamp, cached.cachedAt);
    }

    return {
      totalTemplates: this.cache.size,
      totalSize,
      hitRate: 0, // Would need to track hits/misses for this
      oldestTemplate: oldestTimestamp === Infinity ? null : new Date(oldestTimestamp)
    };
  }

  /**
   * Clear all cached templates
   */
  clearCache(): void {
    if (process.env.NODE_ENV === 'development') console.log('🗑️ Clearing all template cache');
    for (const cached of this.cache.values()) {
      URL.revokeObjectURL(cached.blobUrl);
    }
    this.cache.clear();
    this.previewCache.clear();
    
    // Only remove from localStorage if in browser
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }
}

// Export singleton instance
export const templateCacheService = new TemplateCacheServiceImpl();