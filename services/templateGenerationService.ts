// Updated: Template generation service - PURE DATABASE-DRIVEN
import { Template, Photo, TemplateGenerationOptions, GeneratedTemplate, PrintSize } from '../types';
import { EXPORT_SETTINGS, ERROR_MESSAGES } from '../utils/constants';
import { saveAs } from 'file-saver';
import googleDriveService from './googleDriveService';
import { templateConfigService } from './templateConfigService';

class TemplateGenerationService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;

  private async initializeCanvas(template?: Template): Promise<void> {
    if (typeof window === 'undefined') return;

    let dimensions = { width: 1200, height: 1800 }; // Default fallback
    
    if (template) {
      // Get dynamic dimensions from template configuration
      dimensions = await templateConfigService.getTemplateDimensions(template.type, '4R');
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = dimensions.width;
    this.canvas.height = dimensions.height;
    this.ctx = this.canvas.getContext('2d');

    if (this.ctx) {
      // Enable high-quality rendering
      this.ctx.imageSmoothingEnabled = true;
      this.ctx.imageSmoothingQuality = 'high';
    }
  }

  async generateTemplate(
    template: Template,
    options: Partial<TemplateGenerationOptions> = {}
  ): Promise<GeneratedTemplate> {
    try {
      if (!this.canvas || !this.ctx) {
        await this.initializeCanvas(template);
      }

      if (!this.canvas || !this.ctx) {
        throw new Error('Failed to initialize canvas');
      }

      // Get dynamic dimensions for this template using its print size
      const templateDimensions = await templateConfigService.getTemplateDimensions(template.type, template.printSize);
      
      const settings = {
        ...EXPORT_SETTINGS,
        ...options,
        dimensions: templateDimensions,
      };

      // Clear canvas
      this.ctx.fillStyle = settings.backgroundColor || '#ffffff';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Get photo slots from database using template's print size - NO FALLBACKS
      const slots = await templateConfigService.getPhotoSlots(template.type, template.printSize);
      
      // Load and draw photos
      const loadedPhotos: Photo[] = [];
      for (let i = 0; i < template.photoSlots.length; i++) {
        const slot = template.photoSlots[i];
        if (slot.photo && slots[i]) {
          const photo = await this.loadPhoto(slot.photo);
          await this.drawPhotoInSlot(photo, slots[i], template.type);
          loadedPhotos.push(slot.photo);
        }
      }

      // Generate output
      const blob = await this.canvasToBlob(settings.quality);
      const fileName = this.generateFileName(template);
      
      return {
        id: `generated_${Date.now()}`,
        templateId: template.id,
        templateType: template.type,
        fileName,
        fileUrl: URL.createObjectURL(blob),
        googleDriveId: '', // Will be set after upload
        dimensions: settings.dimensions,
        generatedAt: new Date(),
        photos: loadedPhotos,
      };
    } catch (error) {
      console.error('Failed to generate template:', error);
      throw new Error(ERROR_MESSAGES.TEMPLATE_GENERATION_FAILED);
    }
  }

  private async loadPhoto(photo: Photo): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${photo.name}`));
      
      // Use high-resolution URL for better quality
      img.src = photo.url;
    });
  }

  private async drawPhotoInSlot(
    img: HTMLImageElement,
    slot: { x: number; y: number; width: number; height: number },
    templateType: string
  ): Promise<void> {
    if (!this.ctx) return;

    const { x, y, width, height } = slot;
    
    // Calculate scaling to fit/fill the slot
    const scaleX = width / img.width;
    const scaleY = height / img.height;
    
    let scale: number;
    let drawWidth: number;
    let drawHeight: number;
    let offsetX = 0;
    let offsetY = 0;

    // Get template configuration to determine rendering behavior
    const layout = await templateConfigService.getTemplateLayout(templateType);
    const fillSlot = layout.padding === 0; // Templates with no padding fill the slot

    if (fillSlot) {
      // Fill the entire area (crop if necessary)
      scale = Math.max(scaleX, scaleY);
      drawWidth = img.width * scale;
      drawHeight = img.height * scale;
      offsetX = (width - drawWidth) / 2;
      offsetY = (height - drawHeight) / 2;
    } else {
      // Fit within the slot (letterbox if necessary)
      scale = Math.min(scaleX, scaleY);
      drawWidth = img.width * scale;
      drawHeight = img.height * scale;
      offsetX = (width - drawWidth) / 2;
      offsetY = (height - drawHeight) / 2;
    }

    // Draw the image
    this.ctx.drawImage(
      img,
      x + offsetX,
      y + offsetY,
      drawWidth,
      drawHeight
    );

    // Add border for templates with high padding (typically solo templates)
    if (layout.padding >= 50) {
      this.ctx.strokeStyle = '#cccccc';
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x, y, width, height);
    }
  }

  private async canvasToBlob(quality: number = 0.95): Promise<Blob> {
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
        'image/jpeg',
        quality
      );
    });
  }

  private generateFileName(template: Template): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const templateName = template.type.charAt(0).toUpperCase() + template.type.slice(1);
    return `${templateName}_${timestamp}.jpg`;
  }

  async generateMultipleTemplates(
    templates: Template[],
    options: Partial<TemplateGenerationOptions> = {}
  ): Promise<GeneratedTemplate[]> {
    const generated: GeneratedTemplate[] = [];
    
    for (const template of templates) {
      try {
        const result = await this.generateTemplate(template, options);
        generated.push(result);
      } catch (error) {
        console.error(`Failed to generate template ${template.id}:`, error);
        // Continue with other templates
      }
    }
    
    return generated;
  }

  async downloadTemplate(generatedTemplate: GeneratedTemplate): Promise<void> {
    try {
      const response = await fetch(generatedTemplate.fileUrl);
      const blob = await response.blob();
      saveAs(blob, generatedTemplate.fileName);
    } catch (error) {
      console.error('Failed to download template:', error);
      throw new Error(ERROR_MESSAGES.EXPORT_FAILED);
    }
  }

  async uploadToGoogleDrive(
    generatedTemplate: GeneratedTemplate,
    parentFolderId: string
  ): Promise<string> {
    try {
      const response = await fetch(generatedTemplate.fileUrl);
      const blob = await response.blob();
      
      const fileId = await googleDriveService.uploadFile(
        blob,
        generatedTemplate.fileName,
        parentFolderId,
        'image/jpeg'
      );
      
      return fileId;
    } catch (error) {
      console.error('Failed to upload template to Google Drive:', error);
      throw new Error(ERROR_MESSAGES.EXPORT_FAILED);
    }
  }

  async generatePreview(
    template: Template,
    maxWidth: number = 400
  ): Promise<string> {
    try {
      // Get dynamic dimensions for this template using its print size
      const templateDimensions = await templateConfigService.getTemplateDimensions(template.type, template.printSize);
      
      // Create smaller canvas for preview
      const previewCanvas = document.createElement('canvas');
      const previewCtx = previewCanvas.getContext('2d');
      
      if (!previewCtx) {
        throw new Error('Failed to create preview canvas');
      }

      const scale = maxWidth / templateDimensions.width;
      previewCanvas.width = templateDimensions.width * scale;
      previewCanvas.height = templateDimensions.height * scale;

      // Enable high-quality rendering
      previewCtx.imageSmoothingEnabled = true;
      previewCtx.imageSmoothingQuality = 'high';
      previewCtx.scale(scale, scale);

      // Clear canvas
      previewCtx.fillStyle = '#ffffff';
      previewCtx.fillRect(0, 0, templateDimensions.width, templateDimensions.height);

      // Get photo slots from database using template's print size
      const slots = await templateConfigService.getPhotoSlots(template.type, template.printSize);
      
      // Draw photos or placeholders
      for (let i = 0; i < template.photoSlots.length; i++) {
        const slot = template.photoSlots[i];
        const slotDimensions = slots[i];
        
        if (slot.photo && slotDimensions) {
          try {
            const img = await this.loadPhoto(slot.photo);
            previewCtx.save();
            previewCtx.scale(1, 1); // Reset scale for drawing
            await this.drawPhotoInSlot(img, slotDimensions, template.type);
            previewCtx.restore();
          } catch (error) {
            // Draw placeholder if photo fails to load
            this.drawPlaceholder(previewCtx, slotDimensions);
          }
        } else if (slotDimensions) {
          // Draw placeholder for empty slots
          this.drawPlaceholder(previewCtx, slotDimensions);
        }
      }

      return previewCanvas.toDataURL('image/jpeg', 0.8);
    } catch (error) {
      console.error('Failed to generate preview:', error);
      throw new Error('Failed to generate preview');
    }
  }

  private drawPlaceholder(
    ctx: CanvasRenderingContext2D,
    slot: { x: number; y: number; width: number; height: number }
  ): void {
    const { x, y, width, height } = slot;
    
    // Draw placeholder background
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(x, y, width, height);
    
    // Draw border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, width, height);
    
    // Draw placeholder text
    ctx.fillStyle = '#999999';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Tap to add photo', x + width / 2, y + height / 2);
  }

  async createTemplateFromType(
    templateType: string,
    photos: Photo[],
    printSize: PrintSize = '4R' // Default to 4R but make it configurable
  ): Promise<Template> {
    // Get pure database configuration - NO FALLBACKS
    const dimensions = await templateConfigService.getTemplateDimensions(templateType, printSize);
    const layout = await templateConfigService.getTemplateLayout(templateType);
    const slots = await templateConfigService.getPhotoSlots(templateType, printSize);
    
    const photoSlots = slots.map((slot, index) => ({
      id: `slot_${index}`,
      position: slot,
      photo: photos[index] || undefined,
      index,
      label: `Photo ${index + 1}`,
    }));

    return {
      id: `template_${Date.now()}`,
      type: templateType as any,
      name: `${templateType.charAt(0).toUpperCase() + templateType.slice(1)} Template`,
      printSize, // Include the print size in the template
      photoSlots,
      dimensions,
      layout: {
        type: templateType as any,
        slots: {
          count: layout.slots,
          arrangement: layout.arrangement,
          spacing: layout.spacing,
          padding: layout.padding,
        },
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  getTemplateStats(template: Template): {
    totalSlots: number;
    filledSlots: number;
    emptySlots: number;
    isComplete: boolean;
  } {
    const totalSlots = template.photoSlots.length;
    const filledSlots = template.photoSlots.filter(slot => slot.photo).length;
    const emptySlots = totalSlots - filledSlots;
    const isComplete = emptySlots === 0;

    return {
      totalSlots,
      filledSlots,
      emptySlots,
      isComplete,
    };
  }

  cleanup(): void {
    if (this.canvas) {
      this.canvas.remove();
      this.canvas = null;
      this.ctx = null;
    }
  }
}

// Export singleton instance
export const templateGenerationService = new TemplateGenerationService();
export default templateGenerationService; 