/**
 * Template Rasterization Service
 * Generates high-quality rasterized images by combining PNG template backgrounds with positioned photos
 * Supports both manual templates (PNG-based) and handles photo transforms correctly
 */

import { TemplateSlot, Photo, PhotoTransform, isPhotoTransform, ManualTemplate } from '../types';
import { getHighResPhotoUrls } from '../utils/photoUrlUtils';
import { getPrintSizeDimensions } from '../utils/printSizeDimensions';

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
   * Creates images with correct pixel dimensions for printing at 300 DPI
   * (DPI metadata will show 96 due to browser limitations, but pixel count is correct)
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
      // Get dimensions - prefer PNG's actual dimensions over standard print sizes
      let canvasWidth: number;
      let canvasHeight: number;
      
      if (template.drive_file_id) {
        // Use PNG's actual dimensions for pixel-perfect export
        const pngDimensions = await this.getPngNaturalDimensions(template.drive_file_id);
        if (pngDimensions) {
          canvasWidth = pngDimensions.width;
          canvasHeight = pngDimensions.height;
          console.log('📐 Using PNG natural dimensions:', pngDimensions);
        } else {
          // Fallback to standard print dimensions if PNG dimensions can't be determined
          const expectedDimensions = getPrintSizeDimensions(template.print_size);
          canvasWidth = expectedDimensions.width;
          canvasHeight = expectedDimensions.height;
          console.log('⚠️ Using fallback print dimensions:', expectedDimensions);
        }
      } else {
        // No PNG, use standard print dimensions
        const expectedDimensions = getPrintSizeDimensions(template.print_size);
        canvasWidth = expectedDimensions.width;
        canvasHeight = expectedDimensions.height;
        console.log('📐 Using standard print dimensions (no PNG):', expectedDimensions);
      }
      
      // Log dimension information for debugging
      console.log('📐 Final canvas dimensions:', {
        width: canvasWidth,
        height: canvasHeight,
        printSize: template.print_size,
        storedDimensions: template.dimensions,
        dpi: settings.dpi
      });
      
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
        // Request high resolution version with =w4000 parameter
        pngUrl = match ? `https://lh3.googleusercontent.com/d/${match[1]}=w4000` : '';
        if (!pngUrl) throw new Error('Invalid Google Drive URL format');
      } else {
        // Request high resolution version with =w4000 parameter
        pngUrl = `https://lh3.googleusercontent.com/d/${driveFileId}=w4000`;
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
        // Request high resolution version with =w4000 parameter for full quality
        pngUrl = match ? `https://lh3.googleusercontent.com/d/${match[1]}=w4000` : '';
        if (!pngUrl) throw new Error('Invalid Google Drive URL format');
      } else {
        // Request high resolution version with =w4000 parameter for full quality
        pngUrl = `https://lh3.googleusercontent.com/d/${fileId}=w4000`;
      }

      console.log('🔗 Loading PNG template from:', pngUrl);
      const img = await this.loadImage(pngUrl);
      
      // Since canvas is now sized to match PNG, we draw at 1:1 scale
      // This ensures pixel-perfect template export
      this.templateScale = 1;
      this.templateOffsetX = 0;
      this.templateOffsetY = 0;
      
      console.log('🎨 Drawing PNG at natural size (1:1 scale):', {
        pngSize: { width: img.width, height: img.height },
        canvasSize: { width: this.canvas.width, height: this.canvas.height },
        scale: this.templateScale
      });
      
      // Draw the PNG at its natural size (1:1 pixel mapping)
      this.ctx.drawImage(img, 0, 0);
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

    // Debug slot to hole mapping
    console.log('🎯 Slot to Hole Mapping:', {
      slotId: slot.id,
      slotIndex: slot.slotIndex,
      slotTemplateType: slot.templateType,
      templateType: template.template_type,
      templateHolesCount: template.holes_data?.length || 0,
      availableIndexes: template.holes_data ? template.holes_data.map((_, i) => i) : []
    });

    const originalHole = template.holes_data[slot.slotIndex];
    if (!originalHole) {
      console.error(`❌ No hole data found for slot index ${slot.slotIndex}`, {
        slotIndex: slot.slotIndex,
        availableHoles: template.holes_data?.length || 0,
        template: template.name
      });
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
   * Draw photo with PhotoTransform - Using native Canvas transform methods
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

    // 2. Calculate object-fit: contain scale (same as PhotoRenderer with transforms)
    const containScale = Math.min(hole.width / img.width, hole.height / img.height);
    
    // 3. Get transform values
    const photoScale = transform.photoScale;
    const photoCenterX = transform.photoCenterX;
    const photoCenterY = transform.photoCenterY;
    
    // 4. Calculate the photo's rendered size after object-fit: contain
    const renderedWidth = img.width * containScale;
    const renderedHeight = img.height * containScale;
    
    // 5. Calculate where the contained image sits (centered in hole)
    const containedX = hole.x + (hole.width - renderedWidth) / 2;
    const containedY = hole.y + (hole.height - renderedHeight) / 2;
    
    // 6. NATIVE CANVAS TRANSFORMS - Replicate CSS transform-origin: center center
    // Move origin to center of the contained image (this is our transform-origin)
    const centerX = containedX + renderedWidth / 2;
    const centerY = containedY + renderedHeight / 2;
    
    // Move canvas origin to the center point
    this.ctx.translate(centerX, centerY);
    
    // 7. Apply CSS transforms in order (translate then scale)
    // CRITICAL FIX: CSS translate percentages are relative to the ELEMENT size (hole size),
    // NOT the contained image size! The element has "absolute inset-0" making it the hole size.
    const translateXPercent = (0.5 - photoCenterX) * 100;
    const translateYPercent = (0.5 - photoCenterY) * 100;
    const translateXPixels = (translateXPercent / 100) * hole.width;
    const translateYPixels = (translateYPercent / 100) * hole.height;
    
    // Apply translation
    this.ctx.translate(translateXPixels, translateYPixels);
    
    // Apply scale
    this.ctx.scale(photoScale, photoScale);
    
    // 8. Draw image centered at origin (since we've moved the origin to center)
    // We need to offset by half the rendered size to center it
    this.ctx.drawImage(
      img, 
      -renderedWidth / 2, 
      -renderedHeight / 2, 
      renderedWidth, 
      renderedHeight
    );
    
    console.log('🎨 NATIVE TRANSFORM RASTERIZATION:', {
      originalImage: { width: img.width, height: img.height },
      hole: { x: hole.x, y: hole.y, width: hole.width, height: hole.height },
      containScale: containScale.toFixed(3),
      transform: {
        photoScale: photoScale.toFixed(3),
        photoCenterX: photoCenterX.toFixed(3),
        photoCenterY: photoCenterY.toFixed(3)
      },
      positioning: {
        containedPosition: { x: containedX.toFixed(1), y: containedY.toFixed(1) },
        renderedSize: `${renderedWidth.toFixed(1)}x${renderedHeight.toFixed(1)}`,
        transformOrigin: { x: centerX.toFixed(1), y: centerY.toFixed(1) }
      },
      transforms: {
        translate: {
          percentX: translateXPercent.toFixed(1) + '%',
          percentY: translateYPercent.toFixed(1) + '%',
          pixelsX: translateXPixels.toFixed(1),
          pixelsY: translateYPixels.toFixed(1)
        },
        scale: photoScale.toFixed(3)
      },
      cssEquivalent: `object-fit:contain; transform: translate(${translateXPercent.toFixed(1)}%, ${translateYPercent.toFixed(1)}%) scale(${photoScale.toFixed(3)}); transform-origin: center`
    });

    this.ctx.restore();
  }

  /**
   * Draw photo fit in hole (object-fit: cover behavior)
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

    // Use Math.max for object-fit: cover (fills entire hole)
    // This matches PhotoRenderer's default behavior
    const scale = Math.max(hole.width / img.width, hole.height / img.height);
    const scaledWidth = img.width * scale;
    const scaledHeight = img.height * scale;

    // Center the scaled image in the hole
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
   * Note: Browser canvas API doesn't support DPI metadata, so images will show 96 DPI
   * but have correct pixel dimensions for printing at 300 DPI when printed at intended size
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