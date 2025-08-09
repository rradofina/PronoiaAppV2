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
  
  // Stores the transform applied to the template background to align photo holes correctly
  private templateScale: number = 1;
  private templateOffsetX: number = 0;
  private templateOffsetY: number = 0;

  private initializeCanvas(width: number, height: number): void {
    if (typeof window === 'undefined') return;

    // Reset transform state for each new rasterization
    this.templateScale = 1;
    this.templateOffsetX = 0;
    this.templateOffsetY = 0;

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
      // CLIPPING FIX: Use PNG natural dimensions for canvas to show full template
      let canvasWidth = template.dimensions.width;
      let canvasHeight = template.dimensions.height;
      
      if (template.drive_file_id) {
        const pngDimensions = await this.getPngNaturalDimensions(template.drive_file_id);
        if (pngDimensions) {
          canvasWidth = pngDimensions.width;
          canvasHeight = pngDimensions.height;
          console.log('🎨 Using PNG natural dimensions for canvas:', pngDimensions);
        }
      }
      
      this.initializeCanvas(canvasWidth, canvasHeight);
      if (!this.canvas || !this.ctx) {
        throw new Error('Failed to initialize canvas');
      }

      if (settings.includeBackground) {
        this.ctx.fillStyle = settings.backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
      }

      if (template.drive_file_id) {
        await this.drawTemplateBackground(template);
      }

      await this.drawPhotosInSlots(templateSlots, photos, template);

      const blob = await this.canvasToBlob(settings.format, settings.quality);
      const fileName = this.generateFileName(template, settings);

      const actualDimensions = { width: this.canvas.width, height: this.canvas.height };
      console.log('✅ Template rasterization completed:', { fileName, blobSize: blob.size, actualDimensions });
      return { blob, fileName, dimensions: actualDimensions, generatedAt: new Date() };

    } catch (error) {
      console.error('❌ Template rasterization failed:', error);
      throw new Error(`Failed to rasterize template: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get PNG natural dimensions without drawing it
   */
  private async getPngNaturalDimensions(driveFileId: string): Promise<{ width: number; height: number } | null> {
    try {
      let pngUrl: string;
      
      if (driveFileId.includes('drive.google.com')) {
        const match = driveFileId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        pngUrl = match ? `https://lh3.googleusercontent.com/d/${match[1]}` : '';
        if (!pngUrl) throw new Error('Invalid Google Drive URL format');
      } else {
        pngUrl = `https://lh3.googleusercontent.com/d/${driveFileId}`;
      }

      const img = await this.loadImage(pngUrl);
      return { width: img.width, height: img.height };
    } catch (error) {
      console.warn('⚠️ Failed to get PNG dimensions, using template dimensions:', error);
      return null;
    }
  }

  /**
   * Load and draw PNG template background at natural 1:1 scale
   */
  private async drawTemplateBackground(template: ManualTemplate): Promise<void> {
    if (!this.ctx || !this.canvas) return;

    try {
      const fileId = template.drive_file_id;
      let pngUrl: string;
      
      if (fileId.includes('drive.google.com')) {
        const match = fileId.match(/\/d\/([a-zA-Z0-9-_]+)/);
        pngUrl = match ? `https://lh3.googleusercontent.com/d/${match[1]}` : '';
        if (!pngUrl) throw new Error('Invalid Google Drive URL format');
      } else {
        pngUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
      }

      const img = await this.loadImage(pngUrl);
      
      // CLIPPING FIX: Draw PNG at natural 1:1 scale (no scaling)
      // Canvas is already sized to match PNG dimensions
      this.templateScale = 1;
      this.templateOffsetX = 0;
      this.templateOffsetY = 0;
      
      console.log('🎨 Drawing PNG at natural 1:1 scale:', {
        pngSize: { width: img.width, height: img.height },
        canvasSize: { width: this.canvas.width, height: this.canvas.height },
        scale: this.templateScale,
        offset: { x: this.templateOffsetX, y: this.templateOffsetY }
      });
      
      this.ctx.drawImage(img, 0, 0, img.width, img.height);
    } catch (error) {
      console.warn('⚠️ Failed to load template background, continuing without it:', error);
    }
  }

  /**
   * Draw photos in their respective template slots
   */
  private async drawPhotosInSlots(templateSlots: TemplateSlot[], photos: Photo[], template: ManualTemplate): Promise<void> {
    for (const slot of templateSlots) {
      if (!slot.photoId) continue;
      try {
        const photo = photos.find(p => p.id === slot.photoId);
        if (photo) {
          await this.drawPhotoInSlot(photo, slot, template);
        } else {
          console.warn(`⚠️ Photo not found for slot ${slot.id}`);
        }
      } catch (error) {
        console.error(`❌ Failed to draw photo in slot ${slot.id}:`, error);
      }
    }
  }

  /**
   * Draw a single photo in its template slot, handling all coordinate transforms
   */
  private async drawPhotoInSlot(photo: Photo, slot: TemplateSlot, template: ManualTemplate): Promise<void> {
    if (!this.ctx || !this.canvas) return;

    const highResUrls = getHighResPhotoUrls(photo);
    const photoUrl = highResUrls[0] || photo.url;
    const img = await this.loadImage(photoUrl);

    const originalHole = template.holes_data[slot.slotIndex];
    if (!originalHole) {
      console.warn(`⚠️ No hole data found for slot index ${slot.slotIndex}`);
      return;
    }

    // COORDINATE FIX: Scale hole coordinates from template.dimensions to PNG natural dimensions
    // Since PNG is drawn at 1:1 scale, we need to scale hole coordinates to match
    const scaleX = this.canvas.width / template.dimensions.width;
    const scaleY = this.canvas.height / template.dimensions.height;
    
    const transformedHole = {
      x: originalHole.x * scaleX,
      y: originalHole.y * scaleY,
      width: originalHole.width * scaleX,
      height: originalHole.height * scaleY
    };
    
    console.log('🔄 Hole coordinate scaling:', {
      templateDimensions: template.dimensions,
      canvasDimensions: { width: this.canvas.width, height: this.canvas.height },
      scaleFactors: { x: scaleX.toFixed(3), y: scaleY.toFixed(3) },
      originalHole: { x: originalHole.x, y: originalHole.y, width: originalHole.width, height: originalHole.height },
      transformedHole: { x: transformedHole.x.toFixed(1), y: transformedHole.y.toFixed(1), width: transformedHole.width.toFixed(1), height: transformedHole.height.toFixed(1) }
    });

    // Use transformed hole coordinates directly - no clamping to avoid clipping
    if (slot.transform && isPhotoTransform(slot.transform)) {
      this.drawPhotoWithTransform(img, slot.transform, transformedHole);
    } else {
      this.drawPhotoFitInHole(img, transformedHole);
    }
  }

  /**
   * Draw photo with PhotoTransform - FIXED to match UI CSS behavior exactly
   */
  private drawPhotoWithTransform(
    img: HTMLImageElement,
    transform: PhotoTransform,
    hole: { x: number, y: number, width: number, height: number }
  ): void {
    if (!this.ctx) return;

    this.ctx.save();

    // 1. Set the clipping region for the hole
    this.ctx.beginPath();
    this.ctx.rect(hole.x, hole.y, hole.width, hole.height);
    this.ctx.clip();

    // 2. Calculate object-fit: cover scale (same as UI)
    const coverScale = Math.max(hole.width / img.width, hole.height / img.height);
    
    // 3. SQUISHING FIX: Clamp photoScale to prevent coverage issues
    // photoScale < 1.0 would make finalScale < coverScale, breaking hole coverage
    const clampedPhotoScale = Math.max(1.0, transform.photoScale);
    const wasClampedScale = clampedPhotoScale !== transform.photoScale;
    
    // 4. Clamp photoCenterX/Y to valid bounds to prevent positioning issues
    const clampedCenterX = Math.max(0, Math.min(1, transform.photoCenterX));
    const clampedCenterY = Math.max(0, Math.min(1, transform.photoCenterY));
    const wasClampedPosition = clampedCenterX !== transform.photoCenterX || clampedCenterY !== transform.photoCenterY;
    
    // 5. Calculate the photo's rendered size after object-fit: cover
    const renderedWidth = img.width * coverScale;
    const renderedHeight = img.height * coverScale;
    
    // 6. Apply clamped zoom scale (ensures coverage is maintained)
    const finalScale = coverScale * clampedPhotoScale;
    const finalWidth = img.width * finalScale;
    const finalHeight = img.height * finalScale;
    
    // 7. EXACT CSS REPLICATION: Match browser's object-fit:cover + transform behavior
    // The key insight: CSS transform percentages are relative to the SCALED element size
    
    // Step 1: Calculate translation percentages (same as CSS)
    const translateXPercent = (0.5 - clampedCenterX) * 100;
    const translateYPercent = (0.5 - clampedCenterY) * 100;
    
    // Step 2: Translation in pixels - relative to the FINAL scaled size
    // This is where the magic happens - we use finalWidth/Height for percentage calculation
    const translateXPixels = (translateXPercent / 100) * finalWidth;
    const translateYPixels = (translateYPercent / 100) * finalHeight;
    
    // Step 3: Calculate the base position (centered in hole)
    // This is where object-fit:cover would place the image before transforms
    const baseCenterX = hole.x + hole.width / 2;
    const baseCenterY = hole.y + hole.height / 2;
    
    // Step 4: Apply translation from the center
    // The image is drawn from its top-left corner, so we offset by half its size
    const finalX = baseCenterX - (finalWidth / 2) + translateXPixels;
    const finalY = baseCenterY - (finalHeight / 2) + translateYPixels;
    
    console.log('🎨 CSS-EXACT RASTERIZATION:', {
      originalImage: { width: img.width, height: img.height },
      hole: { x: hole.x, y: hole.y, width: hole.width, height: hole.height },
      coverScale: coverScale.toFixed(3),
      userTransform: {
        photoScale: transform.photoScale.toFixed(3),
        photoCenterX: transform.photoCenterX.toFixed(3),
        photoCenterY: transform.photoCenterY.toFixed(3)
      },
      clampedTransform: {
        photoScale: clampedPhotoScale.toFixed(3),
        photoCenterX: clampedCenterX.toFixed(3),
        photoCenterY: clampedCenterY.toFixed(3)
      },
      calculatedValues: {
        finalScale: finalScale.toFixed(3),
        finalSize: `${finalWidth.toFixed(1)}x${finalHeight.toFixed(1)}`,
        translation: {
          percentX: translateXPercent.toFixed(1) + '%',
          percentY: translateYPercent.toFixed(1) + '%',
          pixelsX: translateXPixels.toFixed(1),
          pixelsY: translateYPixels.toFixed(1)
        },
        baseCenter: { x: baseCenterX.toFixed(1), y: baseCenterY.toFixed(1) },
        finalPosition: { x: finalX.toFixed(1), y: finalY.toFixed(1) }
      },
      cssEquivalent: `object-fit:cover; transform: translate(${translateXPercent.toFixed(1)}%, ${translateYPercent.toFixed(1)}%) scale(${clampedPhotoScale.toFixed(3)})`
    });

    // 7. Draw the photo at the calculated position and scale
    this.ctx.drawImage(img, finalX, finalY, finalWidth, finalHeight);

    this.ctx.restore();
  }

  /**
   * Draw photo fit in hole (object-fit: contain behavior)
   */
  private drawPhotoFitInHole(
    img: HTMLImageElement,
    hole: { x: number, y: number, width: number, height: number }
  ): void {
    if (!this.ctx) return;

    this.ctx.save();

    this.ctx.beginPath();
    this.ctx.rect(hole.x, hole.y, hole.width, hole.height);
    this.ctx.clip();

    const scale = Math.min(hole.width / img.width, hole.height / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    const offsetX = (hole.width - scaledWidth) / 2;
    const offsetY = (hole.height - scaledHeight) / 2;

    this.ctx.drawImage(img, hole.x + offsetX, hole.y + offsetY, scaledWidth, scaledHeight);
    
    this.ctx.restore();
  }

  /**
   * Load image from URL
   */
  private async loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => {
        console.error('Failed to load image:', url, e);
        reject(new Error(`Failed to load image: ${url}`));
      };
      img.src = url;
    });
  }

  /**
   * Convert canvas to blob
   */
  private async canvasToBlob(format: 'jpeg' | 'png', quality: number = 0.95): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.canvas) {
        return reject(new Error('Canvas not initialized'));
      }
      this.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob from canvas'));
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
    return `${cleanName}_${options.dpi}dpi_${timestamp}.${extension}`;
  }

  /**
   * Download rasterized template
   */
  async downloadTemplate(rasterized: RasterizedTemplate): Promise<void> {
    try {
      const url = URL.createObjectURL(rasterized.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = rasterized.fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
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