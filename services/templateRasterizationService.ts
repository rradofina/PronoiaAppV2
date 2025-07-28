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
      
      // Draw template background maintaining aspect ratio (like CSS object-contain)
      const canvasAspectRatio = this.canvas!.width / this.canvas!.height;
      const imgAspectRatio = img.width / img.height;
      
      let drawWidth, drawHeight, drawX, drawY;
      
      if (imgAspectRatio > canvasAspectRatio) {
        // Image is wider - fit to canvas width
        drawWidth = this.canvas!.width;
        drawHeight = this.canvas!.width / imgAspectRatio;
        drawX = 0;
        drawY = (this.canvas!.height - drawHeight) / 2;
      } else {
        // Image is taller - fit to canvas height
        drawWidth = this.canvas!.height * imgAspectRatio;
        drawHeight = this.canvas!.height;
        drawX = (this.canvas!.width - drawWidth) / 2;
        drawY = 0;
      }
      
      console.log('🎨 Template background sizing:', {
        canvasSize: { width: this.canvas!.width, height: this.canvas!.height },
        imgSize: { width: img.width, height: img.height },
        canvasAspectRatio: canvasAspectRatio.toFixed(3),
        imgAspectRatio: imgAspectRatio.toFixed(3),
        drawSize: { width: drawWidth, height: drawHeight },
        drawPosition: { x: drawX, y: drawY }
      });
      
      this.ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
      
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
   * CRITICAL: Must match UI coordinate system exactly
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
      hole: { x: hole.x, y: hole.y, width: hole.width, height: hole.height },
      templateDimensions: template.dimensions,
      canvasDimensions: { width: this.canvas?.width, height: this.canvas?.height }
    });

    // Apply photo transform if present
    if (slot.transform && isPhotoTransform(slot.transform)) {
      this.drawPhotoWithTransform(img, slot.transform, hole, template);
    } else {
      // Default: fit photo in hole
      this.drawPhotoFitInHole(img, hole.x, hole.y, hole.width, hole.height);
    }
  }

  /**
   * Draw photo with PhotoTransform applied
   * CRITICAL: Must exactly match PhotoRenderer CSS behavior
   */
  private drawPhotoWithTransform(
    img: HTMLImageElement,
    transform: PhotoTransform,
    hole: { x: number, y: number, width: number, height: number },
    template: ManualTemplate
  ): void {
    if (!this.ctx) return;

    console.log('🎨 Drawing photo with transform (COORDINATE SYSTEM FIX):', {
      photoSize: { width: img.width, height: img.height },
      hole,
      template: { width: template.dimensions.width, height: template.dimensions.height },
      canvas: { width: this.canvas?.width, height: this.canvas?.height },
      transform
    });

    // Save context for clipping
    this.ctx.save();

    // Create clipping path for the hole
    this.ctx.beginPath();
    this.ctx.rect(hole.x, hole.y, hole.width, hole.height);
    this.ctx.clip();

    // === MATCH CSS PHOTORENDERER BEHAVIOR EXACTLY ===
    // 
    // CSS PhotoRenderer logic:
    // 1. Photo fills hole container (width: 100%, height: 100%) 
    // 2. object-fit: cover (photo scales to fill, may crop)
    // 3. transform: translate(X%, Y%) scale(photoScale)
    //
    // The KEY insight: CSS transforms happen at the container level,
    // not at the native template resolution!

    // Step 1: Photo fills the hole container (like CSS width/height 100%)
    // At this stage, the photo dimensions match the hole dimensions
    const containerPhotoWidth = hole.width;   // Photo width at hole scale
    const containerPhotoHeight = hole.height; // Photo height at hole scale

    // Step 2: Apply PhotoTransform scale (like CSS scale())
    const scaledWidth = containerPhotoWidth * transform.photoScale;
    const scaledHeight = containerPhotoHeight * transform.photoScale;

    // Step 3: Calculate CSS-style percentage translations
    // CSS: translate(X%, Y%) where % is relative to the element size (scaled photo)
    const translateXPercent = (0.5 - transform.photoCenterX) * 100;
    const translateYPercent = (0.5 - transform.photoCenterY) * 100;

    // Step 4: Convert percentage to pixels (relative to scaled photo dimensions)
    const translateXPixels = (translateXPercent / 100) * scaledWidth;
    const translateYPixels = (translateYPercent / 100) * scaledHeight;

    // Step 5: Position photo in hole (like CSS container positioning)
    const holeCenterX = hole.x + (hole.width / 2);
    const holeCenterY = hole.y + (hole.height / 2);
    
    const drawX = holeCenterX - (scaledWidth / 2) + translateXPixels;
    const drawY = holeCenterY - (scaledHeight / 2) + translateYPixels;

    console.log('🎨 COORDINATE SYSTEM FIX - Transform calculations:', {
      containerPhotoSize: { width: containerPhotoWidth, height: containerPhotoHeight },
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