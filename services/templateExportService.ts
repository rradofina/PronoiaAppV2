/**
 * Template Export Service
 * Handles exporting PNG templates with configuration data for backup, sharing, and migration
 */

import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { 
  ExportedTemplate, 
  TemplateExportMetadata, 
  TemplateExportPackage, 
  TemplateExportOptions,
  TemplateImportResult,
  TemplateExportService as ITemplateExportService,
  TemplateType,
  PrintSize,
  ManualTemplate
} from '../types';
import { pngTemplateService, PngTemplate } from './pngTemplateService';
import { manualTemplateService } from './manualTemplateService';
import { googleDriveService } from './googleDriveService';

class TemplateExportServiceImpl implements ITemplateExportService {
  private readonly EXPORT_VERSION = '1.0.0';

  /**
   * Export a single template by ID
   */
  async exportSingleTemplate(id: string, options: Partial<TemplateExportOptions> = {}): Promise<Blob> {
    if (process.env.NODE_ENV === 'development') console.log('📤 Exporting single template:', id);
    
    const template = await this.getTemplateById(id);
    if (!template) {
      throw new Error(`Template with ID ${id} not found`);
    }

    const exportedTemplate = await this.convertToExportedTemplate(template);
    return await this.createExportBlob([exportedTemplate], options);
  }

  /**
   * Export all templates of a specific type
   */
  async exportTemplatesByType(type: TemplateType, options: Partial<TemplateExportOptions> = {}): Promise<Blob> {
    if (process.env.NODE_ENV === 'development') console.log('📤 Exporting templates by type:', type);
    
    const templates = await this.getTemplatesByFilters({ templateTypes: [type], ...options });
    const exportedTemplates = await Promise.all(
      templates.map(template => this.convertToExportedTemplate(template))
    );
    
    return await this.createExportBlob(exportedTemplates, { ...options, filters: { templateType: type } });
  }

  /**
   * Export all templates of a specific print size
   */
  async exportTemplatesBySize(size: PrintSize, options: Partial<TemplateExportOptions> = {}): Promise<Blob> {
    if (process.env.NODE_ENV === 'development') console.log('📤 Exporting templates by size:', size);
    
    const templates = await this.getTemplatesByFilters({ printSizes: [size], ...options });
    const exportedTemplates = await Promise.all(
      templates.map(template => this.convertToExportedTemplate(template))
    );
    
    return await this.createExportBlob(exportedTemplates, { ...options, filters: { printSize: size } });
  }

  /**
   * Export all templates
   */
  async exportAllTemplates(options: Partial<TemplateExportOptions> = {}): Promise<Blob> {
    if (process.env.NODE_ENV === 'development') console.log('📤 Exporting all templates');
    
    const templates = await this.getTemplatesByFilters(options);
    const exportedTemplates = await Promise.all(
      templates.map(template => this.convertToExportedTemplate(template))
    );
    
    return await this.createExportBlob(exportedTemplates, options);
  }

  /**
   * Export templates to JSON string
   */
  async exportToJSON(templates: ExportedTemplate[]): Promise<string> {
    const exportPackage: TemplateExportPackage = {
      metadata: {
        exportId: `export_${Date.now()}`,
        exportedAt: new Date(),
        exportVersion: this.EXPORT_VERSION,
        totalTemplates: templates.length,
        templateSources: [...new Set(templates.map(t => t.source))],
        includesPngFiles: templates.some(t => !!t.pngUrl),
        includesBase64Data: templates.some(t => !!t.base64Data)
      },
      templates
    };

    return JSON.stringify(exportPackage, null, 2);
  }

  /**
   * Import templates from exported file
   */
  async importFromExport(file: File): Promise<TemplateImportResult> {
    if (process.env.NODE_ENV === 'development') console.log('📥 Importing templates from file:', file.name);
    
    const result: TemplateImportResult = {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errorCount: 0,
      errors: [],
      duplicates: []
    };

    try {
      const validation = await this.validateExportFile(file);
      if (!validation.valid) {
        throw new Error(`Invalid export file: ${validation.errors.join(', ')}`);
      }

      let exportPackage: TemplateExportPackage;

      if (file.name.endsWith('.zip')) {
        exportPackage = await this.extractFromZip(file);
      } else {
        const text = await file.text();
        exportPackage = JSON.parse(text);
      }

      // Import each template
      for (const template of exportPackage.templates) {
        try {
          const existing = await this.getTemplateById(template.id);
          
          if (existing) {
            result.duplicates.push({
              templateId: template.id,
              templateName: template.name,
              action: 'skipped' // Duplicate handling: skip by default, can be overwritten or merged in future versions
            });
            result.skippedCount++;
            continue;
          }

          // Import based on source type
          if (template.source === 'manual') {
            await this.importManualTemplate(template);
          } else {
            // Auto-detected templates would need special handling
            console.warn('Auto-detected template import not implemented:', template.id);
            result.skippedCount++;
            continue;
          }

          result.importedCount++;
        } catch (error) {
          result.errors.push({
            templateId: template.id,
            templateName: template.name,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          result.errorCount++;
        }
      }

      result.success = result.errorCount === 0;
      if (process.env.NODE_ENV === 'development') console.log('📥 Import completed:', result);
      return result;

    } catch (error) {
      console.error('❌ Import failed:', error);
      result.errors.push({
        templateId: 'unknown',
        templateName: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      result.errorCount++;
      return result;
    }
  }

  /**
   * Validate export file format
   */
  async validateExportFile(file: File): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    try {
      if (file.name.endsWith('.zip')) {
        // Validate ZIP structure
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(file);
        
        if (!zipContent.files['metadata.json']) {
          errors.push('Missing metadata.json in ZIP file');
        }
        
        if (!zipContent.folder('templates')) {
          errors.push('Missing templates folder in ZIP file');
        }
      } else if (file.name.endsWith('.json')) {
        // Validate JSON structure
        const text = await file.text();
        const parsed = JSON.parse(text);
        
        if (!parsed.metadata || !parsed.templates) {
          errors.push('Invalid JSON structure - missing metadata or templates');
        }
        
        if (!Array.isArray(parsed.templates)) {
          errors.push('Templates must be an array');
        }
      } else {
        errors.push('Unsupported file format - must be .zip or .json');
      }
    } catch (error) {
      errors.push(`File validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Get template by ID from either auto-detected or manual sources
   */
  private async getTemplateById(id: string): Promise<PngTemplate | ManualTemplate | null> {
    // Try manual templates first
    const manualTemplate = await manualTemplateService.getTemplate(id);
    if (manualTemplate) {
      return manualTemplate;
    }

    // Try auto-detected templates
    await pngTemplateService.loadTemplates();
    const pngTemplate = pngTemplateService.getTemplate(id);
    return pngTemplate;
  }

  /**
   * Get templates by filters
   */
  private async getTemplatesByFilters(filters: Partial<TemplateExportOptions> = {}): Promise<(PngTemplate | ManualTemplate)[]> {
    const templates: (PngTemplate | ManualTemplate)[] = [];

    // Get manual templates if requested
    if (!filters.sources || filters.sources.includes('manual')) {
      const manualTemplates = await manualTemplateService.getAllTemplates();
      templates.push(...manualTemplates.filter(t => {
        if (filters.activeOnly && !t.is_active) return false;
        if (filters.templateTypes && !filters.templateTypes.includes(t.template_type)) return false;
        if (filters.printSizes && !filters.printSizes.includes(t.print_size)) return false;
        return true;
      }));
    }

    // Get auto-detected templates if requested
    if (!filters.sources || filters.sources.includes('auto-detected')) {
      await pngTemplateService.loadTemplates();
      const pngTemplates = pngTemplateService['templates']; // Access private property
      templates.push(...pngTemplates.filter(t => {
        if (filters.templateTypes && !filters.templateTypes.includes(t.templateType)) return false;
        if (filters.printSizes && !filters.printSizes.includes(t.printSize as PrintSize)) return false;
        return true;
      }));
    }

    return templates;
  }

  /**
   * Convert template to exported format
   */
  private async convertToExportedTemplate(template: PngTemplate | ManualTemplate): Promise<ExportedTemplate> {
    const isManual = 'template_type' in template;
    const now = new Date();

    let base64Data: string | undefined;
    let pngBlob: Blob | undefined;

    // Download PNG data if needed
    const fileId = isManual ? (template as ManualTemplate).drive_file_id : (template as PngTemplate).driveFileId;
    if (fileId) {
      try {
        pngBlob = await googleDriveService.downloadTemplate(fileId);
        
        // Convert to base64 for embedding
        const arrayBuffer = await pngBlob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
        base64Data = `data:image/png;base64,${base64}`;
      } catch (error) {
        console.warn('Failed to download PNG data for template:', template.id, error);
      }
    }

    if (isManual) {
      const manual = template as ManualTemplate;
      return {
        id: manual.id,
        name: manual.name,
        templateType: manual.template_type,
        printSize: manual.print_size,
        pngUrl: manual.thumbnail_url,
        driveFileId: manual.drive_file_id,
        base64Data,
        holes: manual.holes_data.map(hole => ({
          id: hole.id,
          x: hole.x,
          y: hole.y,
          width: hole.width,
          height: hole.height
        })),
        dimensions: {
          width: manual.dimensions.width,
          height: manual.dimensions.height
        },
        hasInternalBranding: false, // Manual templates don't have this field
        createdAt: new Date(manual.created_at),
        lastUpdated: new Date(manual.updated_at),
        source: 'manual',
        description: manual.description,
        categoryId: manual.category_id,
        thumbnailUrl: manual.thumbnail_url,
        sampleImageUrl: manual.sample_image_url,
        isActive: manual.is_active,
        exportedAt: now,
        exportVersion: this.EXPORT_VERSION
      };
    } else {
      const png = template as PngTemplate;
      return {
        id: png.id,
        name: png.name,
        templateType: png.templateType,
        printSize: png.printSize as PrintSize,
        pngUrl: png.pngUrl,
        driveFileId: png.driveFileId,
        base64Data,
        holes: png.holes.map(hole => ({
          id: hole.id,
          x: hole.x,
          y: hole.y,
          width: hole.width,
          height: hole.height
        })),
        dimensions: {
          width: png.dimensions.width,
          height: png.dimensions.height
        },
        hasInternalBranding: png.hasInternalBranding,
        createdAt: png.createdAt,
        lastUpdated: png.lastUpdated,
        source: 'auto-detected',
        exportedAt: now,
        exportVersion: this.EXPORT_VERSION
      };
    }
  }

  /**
   * Create export blob (ZIP or JSON)
   */
  private async createExportBlob(
    templates: ExportedTemplate[], 
    options: Partial<TemplateExportOptions> = {}
  ): Promise<Blob> {
    const defaultOptions: TemplateExportOptions = {
      format: 'zip',
      includePngFiles: true,
      includeBase64Data: false,
      ...options
    };

    if (defaultOptions.format === 'json') {
      const jsonString = await this.exportToJSON(templates);
      return new Blob([jsonString], { type: 'application/json' });
    }

    // Create ZIP file
    const zip = new JSZip();
    
    // Add metadata
    const metadata: TemplateExportMetadata = {
      exportId: `export_${Date.now()}`,
      exportedAt: new Date(),
      exportVersion: this.EXPORT_VERSION,
      totalTemplates: templates.length,
      templateSources: [...new Set(templates.map(t => t.source))],
      filters: options.filters,
      includesPngFiles: defaultOptions.includePngFiles,
      includesBase64Data: defaultOptions.includeBase64Data
    };
    
    zip.file('metadata.json', JSON.stringify(metadata, null, 2));

    // Add templates
    const templatesFolder = zip.folder('templates');
    if (!templatesFolder) {
      throw new Error('Failed to create templates folder in ZIP');
    }

    for (const template of templates) {
      const templateFolder = templatesFolder.folder(this.sanitizeFileName(template.name));
      if (!templateFolder) continue;

      // Add template configuration
      const templateConfig = { ...template };
      if (!defaultOptions.includeBase64Data) {
        delete templateConfig.base64Data;
      }
      
      templateFolder.file('template.json', JSON.stringify(templateConfig, null, 2));

      // Add PNG file if available and requested
      if (defaultOptions.includePngFiles && template.base64Data) {
        try {
          const base64Data = template.base64Data.split(',')[1]; // Remove data URL prefix
          templateFolder.file('template.png', base64Data, { base64: true });
        } catch (error) {
          console.warn('Failed to add PNG file for template:', template.id, error);
        }
      }
    }

    return await zip.generateAsync({ type: 'blob' });
  }

  /**
   * Extract templates from ZIP file
   */
  private async extractFromZip(file: File): Promise<TemplateExportPackage> {
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    
    // Read metadata
    const metadataFile = zipContent.files['metadata.json'];
    if (!metadataFile) {
      throw new Error('Missing metadata.json in ZIP file');
    }
    
    const metadataText = await metadataFile.async('text');
    const metadata: TemplateExportMetadata = JSON.parse(metadataText);
    
    // Read templates
    const templates: ExportedTemplate[] = [];
    const templatesFolder = zipContent.folder('templates');
    
    if (templatesFolder) {
      for (const [path, file] of Object.entries(zipContent.files)) {
        if (path.startsWith('templates/') && path.endsWith('/template.json')) {
          const templateText = await file.async('text');
          const template: ExportedTemplate = JSON.parse(templateText);
          templates.push(template);
        }
      }
    }
    
    return {
      metadata,
      templates
    };
  }

  /**
   * Import manual template from exported data
   */
  private async importManualTemplate(template: ExportedTemplate): Promise<void> {
    if (!template.driveFileId && !template.base64Data) {
      throw new Error('Template has no PNG data to import');
    }

    // If we have base64 data but no drive file, we'd need to upload it first
    let driveFileId = template.driveFileId;
    if (!driveFileId && template.base64Data) {
      // Note: Base64 to Google Drive upload requires authentication and Drive API
      // This feature would need Google Drive service integration to:
      // 1. Convert base64 to blob
      // 2. Upload to Drive using gapi.client.drive.files.create
      // 3. Get the new file ID
      throw new Error('Template import requires Google Drive file. Please upload the template image to Google Drive first.');
    }

    if (!driveFileId) {
      throw new Error('No valid drive file ID for template');
    }

    // Create manual template
    await manualTemplateService.createTemplate({
      name: template.name,
      description: template.description,
      template_type: template.templateType,
      print_size: template.printSize,
      drive_file_id: driveFileId,
      holes_data: template.holes.map(hole => ({
        id: hole.id,
        x: hole.x,
        y: hole.y,
        width: hole.width,
        height: hole.height
      })),
      dimensions: template.dimensions,
      thumbnail_url: template.thumbnailUrl,
      sample_image_url: template.sampleImageUrl,
      category_id: template.categoryId
    });
  }

  /**
   * Sanitize filename for file system compatibility
   */
  private sanitizeFileName(name: string): string {
    return name.replace(/[^a-zA-Z0-9\-_\s]/g, '').replace(/\s+/g, '_');
  }

  /**
   * Download export as file
   */
  async downloadExport(blob: Blob, filename: string): Promise<void> {
    saveAs(blob, filename);
  }
}

// Export singleton instance
export const templateExportService = new TemplateExportServiceImpl();