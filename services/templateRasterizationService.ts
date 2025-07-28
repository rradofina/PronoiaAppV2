/**
 * Template Rasterization Service
 * Generates high-quality rasterized images by combining PNG template backgrounds with positioned photos
 * Supports both manual templates (PNG-based) and handles photo transforms correctly
 */

import { TemplateSlot, Photo, PhotoTransform, isPhotoTransform, ManualTemplate } from '../types';
import { getHighResPhotoUrls } from '../utils/photoUrlUtils';

export interface RasterizedTemplate {
  blob: Blob;
  fileName: string;
  dimensions: { width: number; height: number };
  generatedAt: Date;
}

export interface RasterizationOptions {
  format: 'jpeg' | 'png';
  quality: number; // 0.1 to 1.0 for JPEG
  dpi: number; // For filename metadata
  includeBackground: boolean;
  backgroundColor: string;
}

class TemplateRasterizationService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private initializeCanvas(width: number, height: number): void {
    if (typeof window === 'undefined') return;

    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.ctx = this.canvas.getContext('2d');

    if (this.ctx) {
      // Enable high-quality rendering
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }
  }

  /**
   * Generate rasterized template from manual template and slots
   */
  async rasterizeTemplate(
    template: ManualTemplate,
    templateSlots: TemplateSlot[],
    photos: Photo[],
    options: Partial<RasterizationOptions> = {}
  ): Promise<RasterizedTemplate> {
    const settings: RasterizationOptions = {
      format: 'jpeg',
      quality: 0.95,
      dpi: 300,
      includeBackground: true,
      backgroundColor: '#ffffff',
      ...options
    };

    try {
      console.log('🎨 Starting template rasterization:', {
        templateName: template.name,
        templateType: template.template_type,
        dimensions: template.dimensions,
        slotsCount: templateSlots.length,
        photosCount: photos.length,
        settings
      });

      // Initialize canvas with template dimensions
      this.initializeCanvas(template.dimensions.width, template.dimensions.height);
      
      if (!this.canvas || !this.ctx) {
        throw new Error('Failed to initialize canvas');
      }

      // Clear canvas with background
      if (settings.includeBackground) {
        this.ctx.fillStyle = settings.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }

      // Load and draw PNG template background
      if (template.drive_file_id) {
        await this.drawTemplateBackground(template);
      }

      // Draw photos in their respective slots
      await this.drawPhotosInSlots(templateSlots, photos, template);

      // Generate blob
      const blob = await this.canvasToBlob(settings.format, settings.quality);
      const fileName = this.generateFileName(template, settings);

      console.log('✅ Template rasterization completed:', {
        fileName,
        blobSize: blob.size,
        dimensions: template.dimensions
      });

      return {
        blob,
        fileName,
        dimensions: template.dimensions,
        generatedAt: new Date()
      };

    } catch (error) {
      console.error('❌ Template rasterization failed:', error);
      throw new Error(`Failed to rasterize template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load and draw PNG template background
   */
  private async drawTemplateBackground(template: ManualTemplate): Promise<void> {
    if (!this.ctx) return;

    try {
      console.log('🖼️ Loading template background...');
      
      // Get PNG URL from Google Drive file ID
      const fileId = template.drive_file_id;
      let pngUrl: string;
      
      if (fileId.includes('drive.google.com')) {
        // Extract file ID from Google Drive URL
        const match = fileId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        if (match) {
          pngUrl = `https://lh3.googleusercontent.com/d/${match[1]}`;
        } else {
          throw new Error('Invalid Google Drive URL format');
        }
      } else {
        // Assume it's already a file ID
        pngUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      }

      const img = await this.loadImage(pngUrl);
      
      // Draw template background at full canvas size
      this.ctx.drawImage(img, 0, 0, this.canvas!.width, this.canvas!.height);
      
      console.log('✅ Template background drawn');
    } catch (error) {
      console.warn('⚠️ Failed to load template background, continuing without it:', error);
    }
  }

  /**
   * Draw photos in their respective template slots
   */
  private async drawPhotosInSlots(templateSlots: TemplateSlot[], photos: Photo[], template: ManualTemplate): Promise<void> {
    if (!this.ctx) return;

    console.log('📸 Drawing photos in slots...');

    for (const slot of templateSlots) {
      if (!slot.photoId) continue;

      try {
        const photo = photos.find(p => p.id === slot.photoId);
        if (!photo) {
          console.warn(`⚠️ Photo not found for slot ${slot.id}`);
          continue;
        }

        await this.drawPhotoInSlot(photo, slot, template);
      } catch (error) {
        console.error(`❌ Failed to draw photo in slot ${slot.id}:`, error);
        // Continue with other photos
      }
    }

    console.log('✅ All photos drawn');
  }

  /**
   * Draw a single photo in its template slot
   */
  private async drawPhotoInSlot(photo: Photo, slot: TemplateSlot, template: ManualTemplate): Promise<void> {
    if (!this.ctx) return;

    // Get high-resolution photo URL
    const highResUrls = getHighResPhotoUrls(photo);
    const photoUrl = highResUrls[0] || photo.url;

    // Load photo image
    const img = await this.loadImage(photoUrl);

    // Get hole data from template
    const hole = template.holes_data[slot.slotIndex];
    if (!hole) {
      console.warn(`⚠️ No hole data found for slot index ${slot.slotIndex}`);
      return;
    }

    console.log('🖼️ Drawing photo in slot:', {
      photoName: photo.name,
      slotIndex: slot.slotIndex,
      hasTransform: !!slot.transform,
      photoSize: { width: img.width, height: img.height },
      hole: { x: hole.x, y: hole.y, width: hole.width, height: hole.height }
    });

    // Apply photo transform if present
    if (slot.transform && isPhotoTransform(slot.transform)) {
      this.drawPhotoWithTransform(img, slot.transform, hole.x, hole.y, hole.width, hole.height);
    } else {
      // Default: fit photo in hole
      this.drawPhotoFitInHole(img, hole.x, hole.y, hole.width, hole.height);
    }
  }

  /**
   * Draw photo with PhotoTransform applied
   * Matches the CSS transform logic from PhotoRenderer exactly
   */
  private drawPhotoWithTransform(
    img: HTMLImageElement,
    transform: PhotoTransform,
    holeX: number,
    holeY: number,
    holeWidth: number,
    holeHeight: number
  ): void {
    if (!this.ctx) return;

    console.log('🎨 Drawing photo with transform:', {
      photoSize: { width: img.width, height: img.height },
      hole: { x: holeX, y: holeY, width: holeWidth, height: holeHeight },
      transform: {
        photoScale: transform.photoScale,
        photoCenterX: transform.photoCenterX,
        photoCenterY: transform.photoCenterY
      }
    });

    // Save context for clipping
    this.ctx.save();

    // Create clipping path for the hole
    this.ctx.beginPath();
    this.ctx.rect(holeX, holeY, holeWidth, holeHeight);
    this.ctx.clip();

    // === MATCH CSS LOGIC EXACTLY ===
    // CSS: transform: `translate(${translateX}%, ${translateY}%) scale(${photoScale})`
    // CSS: translateX = (0.5 - photoCenterX) * 100 (percentage of photo width)
    // CSS: translateY = (0.5 - photoCenterY) * 100 (percentage of photo height)

    // Step 1: Calculate "fit" scale to determine base photo size in hole
    const fitScale = Math.min(holeWidth / img.width, holeHeight / img.height);
    
    // Step 2: Apply user's photo scale on top of fit scale
    const finalScale = fitScale * transform.photoScale;
    const scaledWidth = img.width * finalScale;
    const scaledHeight = img.height * finalScale;

    // Step 3: Calculate percentage-based translation (same as CSS)
    const translateXPercent = (0.5 - transform.photoCenterX) * 100; // Percentage of photo width
    const translateYPercent = (0.5 - transform.photoCenterY) * 100; // Percentage of photo height

    // Step 4: Convert percentage translation to pixels
    const translateXPixels = (translateXPercent / 100) * scaledWidth;
    const translateYPixels = (translateYPercent / 100) * scaledHeight;

    // Step 5: Position photo center in hole center, then apply translation
    const holeCenterX = holeX + (holeWidth / 2);
    const holeCenterY = holeY + (holeHeight / 2);
    
    const drawX = holeCenterX - (scaledWidth / 2) + translateXPixels;
    const drawY = holeCenterY - (scaledHeight / 2) + translateYPixels;

    console.log('🎨 Transform calculations:', {
      fitScale,
      finalScale,
      scaledSize: { width: scaledWidth, height: scaledHeight },
      translatePercent: { x: translateXPercent, y: translateYPercent },
      translatePixels: { x: translateXPixels, y: translateYPixels },
      holeCenter: { x: holeCenterX, y: holeCenterY },
      finalPosition: { x: drawX, y: drawY }
    });

    // Draw the photo
    this.ctx.drawImage(img, drawX, drawY, scaledWidth, scaledHeight);

    // Restore context
    this.ctx.restore();
  }

  /**
   * Draw photo fit in hole (default behavior)
   */
  private drawPhotoFitInHole(
    img: HTMLImageElement,
    holeX: number,
    holeY: number,
    holeWidth: number,
    holeHeight: number
  ): void {
    if (!this.ctx) return;

    // Calculate scale to fit photo in hole
    const scale = Math.min(holeWidth / img.width, holeHeight / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    // Center the photo in the hole
    const offsetX = (holeWidth - scaledWidth) / 2;
    const offsetY = (holeHeight - scaledHeight) / 2;

    this.ctx.drawImage(
      img,
      holeX + offsetX,
      holeY + offsetY,
      scaledWidth,
      scaledHeight
    );
  }

  /**
   * Load image from URL
   */
  private async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      
      img.src = url;
    });
  }

  /**
   * Convert canvas to blob
   */
  private async canvasToBlob(format: 'jpeg' | 'png', quality: number = 0.95): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.canvas) {
        reject(new Error('Canvas not initialized'));
        return;
      }

      this.canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob from canvas'));
          }
        },
        format === 'jpeg' ? 'image/jpeg' : 'image/png',
        quality
      );
    });
  }

  /**
   * Generate filename for rasterized template
   */
  private generateFileName(template: ManualTemplate, options: RasterizationOptions): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
    const cleanName = template.name.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const extension = options.format === 'jpeg' ? 'jpg' : 'png';
    
    return `${cleanName}_${timestamp}.${extension}`;
  }

  /**
   * Download rasterized template
   */
  async downloadTemplate(rasterized: RasterizedTemplate): Promise<void> {
    try {
      // Create download link
      const url = URL.createObjectURL(rasterized.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = rasterized.fileName;
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up
      URL.revokeObjectURL(url);
      
      console.log('✅ Template download triggered:', rasterized.fileName);
    } catch (error) {
      console.error('❌ Failed to download template:', error);
      throw new Error('Failed to download template');
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
  }
}

// Export singleton instance
export const templateRasterizationService = new TemplateRasterizationService();
export default templateRasterizationService;