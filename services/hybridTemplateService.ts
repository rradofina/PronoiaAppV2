/**
 * Hybrid Template Service
 * Combines manual template system with existing auto-detection
 * Allows gradual migration from auto-detection to manual configuration
 */

import { ManualTemplate, PrintSize, TemplateType } from '../types';
import { manualTemplateService } from './manualTemplateService';
import { pngTemplateService, PngTemplate } from './pngTemplateService';

export interface HybridTemplate {
  id: string;
  name: string;
  description?: string;
  template_type: TemplateType;
  print_size: PrintSize;
  drive_file_id: string;
  driveFileId?: string; // For FullscreenTemplateEditor compatibility (alias for drive_file_id)
  holes: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  dimensions: {
    width: number;
    height: number;
  };
  thumbnail_url?: string;
  sample_image_url?: string; // Sample image showing template filled with photos
  base64_preview?: string; // Base64-encoded small preview for instant loading
  source: 'manual' | 'auto'; // Track source for debugging/migration
  is_active?: boolean;
}

class HybridTemplateServiceImpl {
  private cache: HybridTemplate[] = [];
  private lastSync: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all templates (manual + auto-detection)
   * Manual templates take precedence over auto-detected ones
   */
  async getAllTemplates(forceRefresh = false): Promise<HybridTemplate[]> {
    if (!forceRefresh && this.isCacheValid()) {
      console.log('📦 Using cached hybrid templates');
      return this.cache;
    }

    try {
      console.log('🔄 Loading hybrid templates (manual + auto)...');
      
      // Load manual templates first
      const manualTemplates = await manualTemplateService.getActiveTemplates();
      console.log(`📋 HYBRID SERVICE - Manual templates loaded:`, {
        count: manualTemplates.length,
        types: manualTemplates.map(t => `${t.name} (${t.template_type})`),
        driveFileIds: manualTemplates.map(t => t.drive_file_id)
      });

      // Load auto-detected templates
      const autoTemplates = await pngTemplateService.loadTemplates();
      console.log(`🤖 HYBRID SERVICE - Auto templates loaded:`, {
        count: autoTemplates.length,
        types: autoTemplates.map(t => `${t.name} (${t.templateType})`),
        driveFileIds: autoTemplates.map(t => t.driveFileId || t.id)
      });

      // Convert to hybrid format
      const hybridManual = this.convertManualToHybrid(manualTemplates);
      const hybridAuto = this.convertAutoToHybrid(autoTemplates);

      // Remove auto-detected templates that have manual overrides
      const manualDriveFileIds = new Set(manualTemplates.map(t => t.drive_file_id));
      const filteredAuto = hybridAuto.filter(autoTemplate => 
        !manualDriveFileIds.has(autoTemplate.drive_file_id)
      );

      console.log(`🔀 HYBRID SERVICE - Filtering auto templates:`, {
        manualDriveFileIds: Array.from(manualDriveFileIds),
        autoTemplatesBeforeFilter: hybridAuto.length,
        autoTemplatesAfterFilter: filteredAuto.length,
        filteredOutCount: hybridAuto.length - filteredAuto.length,
        remainingAutoTemplates: filteredAuto.map(t => `${t.name} (${t.template_type})`)
      });

      // Combine templates (manual first, then auto)
      this.cache = [...hybridManual, ...filteredAuto];
      this.lastSync = new Date();

      console.log(`✅ HYBRID SERVICE - Final combined result:`, {
        totalTemplates: this.cache.length,
        manualCount: hybridManual.length,
        autoCount: filteredAuto.length,
        finalTemplatesList: this.cache.map(t => `${t.name} (${t.template_type}, ${t.print_size})`),
        finalTemplatesByType: this.cache.reduce((acc, t) => {
          acc[t.template_type] = (acc[t.template_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      });
      
      // CRITICAL DEBUG: Check template type distribution  
      const typeDistribution = this.cache.reduce((acc, t) => {
        acc[t.template_type] = (acc[t.template_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      console.log('📊 Hybrid template type distribution:', {
        typeDistribution,
        totalTemplates: this.cache.length,
        templateDetails: this.cache.map(t => ({
          name: t.name,
          template_type: t.template_type,
          print_size: t.print_size,
          source: t.source,
          drive_file_id: t.drive_file_id
        })),
        // Dynamic template types from database
        availableTypes: [...new Set(this.cache.map(t => t.template_type))]
      });

      return this.cache;
    } catch (error) {
      console.error('❌ Error loading hybrid templates:', error);
      throw error;
    }
  }

  /**
   * Get templates by print size
   */
  async getTemplatesByPrintSize(printSize: PrintSize, forceRefresh = false): Promise<HybridTemplate[]> {
    const templates = await this.getAllTemplates(forceRefresh);
    return templates.filter(t => t.print_size === printSize);
  }

  /**
   * Get templates by type and size
   */
  async getTemplatesByTypeAndSize(type: TemplateType, size: PrintSize, forceRefresh = false): Promise<HybridTemplate[]> {
    const templates = await this.getAllTemplates(forceRefresh);
    return templates.filter(t => t.template_type === type && t.print_size === size);
  }

  /**
   * Get single template by ID
   */
  async getTemplate(id: string): Promise<HybridTemplate | null> {
    const templates = await this.getAllTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * Get template by drive file ID (for matching in FullscreenTemplateEditor)
   */
  async getTemplateByDriveFileId(driveFileId: string): Promise<HybridTemplate | null> {
    const templates = await this.getAllTemplates();
    return templates.find(t => t.drive_file_id === driveFileId) || null;
  }

  /**
   * Search templates by name or description
   */
  async searchTemplates(query: string): Promise<HybridTemplate[]> {
    const templates = await this.getAllTemplates();
    const lowerQuery = query.toLowerCase();
    return templates.filter(t => 
      t.name.toLowerCase().includes(lowerQuery) || 
      (t.description && t.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get statistics about template sources
   */
  async getStats(): Promise<{
    total: number;
    manual: number;
    auto: number;
    byType: Record<TemplateType, { manual: number; auto: number }>;
    bySize: Record<PrintSize, { manual: number; auto: number }>;
  }> {
    const templates = await this.getAllTemplates();
    
    const manual = templates.filter(t => t.source === 'manual');
    const auto = templates.filter(t => t.source === 'auto');

    const byType = templates.reduce((acc, t) => {
      if (!acc[t.template_type]) {
        acc[t.template_type] = { manual: 0, auto: 0 };
      }
      acc[t.template_type][t.source]++;
      return acc;
    }, {} as Record<TemplateType, { manual: number; auto: number }>);

    const bySize = templates.reduce((acc, t) => {
      if (!acc[t.print_size]) {
        acc[t.print_size] = { manual: 0, auto: 0 };
      }
      acc[t.print_size][t.source]++;
      return acc;
    }, {} as Record<PrintSize, { manual: number; auto: number }>);

    return {
      total: templates.length,
      manual: manual.length,
      auto: auto.length,
      byType,
      bySize
    };
  }

  /**
   * Clear cache and force refresh
   */
  clearCache(): void {
    this.cache = [];
    this.lastSync = null;
    console.log('🗑️ Hybrid template cache cleared');
  }

  /**
   * Convert manual templates to hybrid format
   */
  private convertManualToHybrid(manualTemplates: ManualTemplate[]): HybridTemplate[] {
    return manualTemplates.map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      template_type: template.template_type,
      print_size: template.print_size,
      drive_file_id: template.drive_file_id,
      driveFileId: template.drive_file_id, // Add for FullscreenTemplateEditor compatibility
      holes: template.holes_data,
      dimensions: template.dimensions,
      thumbnail_url: template.thumbnail_url,
      sample_image_url: template.sample_image_url, // Include sample image for template previews
      base64_preview: template.base64_preview, // Include base64 preview for instant loading
      source: 'manual' as const,
      is_active: template.is_active
    }));
  }

  /**
   * Convert auto-detected templates to hybrid format
   */
  private convertAutoToHybrid(autoTemplates: PngTemplate[]): HybridTemplate[] {
    return autoTemplates.map(template => ({
      id: template.id,
      name: template.name,
      description: undefined,
      template_type: template.templateType,
      print_size: template.printSize,
      drive_file_id: template.driveFileId || template.id,
      driveFileId: template.driveFileId || template.id, // Add for FullscreenTemplateEditor compatibility
      holes: template.holes,
      dimensions: template.dimensions,
      thumbnail_url: template.pngUrl,
      source: 'auto' as const,
      is_active: true
    }));
  }

  /**
   * Check if cache is valid
   */
  private isCacheValid(): boolean {
    if (!this.lastSync || this.cache.length === 0) {
      return false;
    }
    
    const now = new Date();
    const cacheAge = now.getTime() - this.lastSync.getTime();
    return cacheAge < this.CACHE_DURATION;
  }

  /**
   * Get migration recommendations
   */
  async getMigrationRecommendations(): Promise<{
    autoTemplatesWithoutManual: HybridTemplate[];
    duplicatesDetected: Array<{
      manual: HybridTemplate;
      auto: HybridTemplate[];
    }>;
  }> {
    const templates = await this.getAllTemplates();
    
    const manualTemplates = templates.filter(t => t.source === 'manual');
    const autoTemplates = templates.filter(t => t.source === 'auto');
    
    // Find auto templates without manual equivalents
    const manualDriveFileIds = new Set(manualTemplates.map(t => t.drive_file_id));
    const autoTemplatesWithoutManual = autoTemplates.filter(t => 
      !manualDriveFileIds.has(t.drive_file_id)
    );

    // Find potential duplicates (same name or similar)
    const duplicatesDetected: Array<{ manual: HybridTemplate; auto: HybridTemplate[] }> = [];
    for (const manual of manualTemplates) {
      const similarAuto = autoTemplates.filter(auto => 
        auto.name.toLowerCase().includes(manual.name.toLowerCase()) ||
        manual.name.toLowerCase().includes(auto.name.toLowerCase()) ||
        (auto.template_type === manual.template_type && auto.print_size === manual.print_size)
      );
      
      if (similarAuto.length > 0) {
        duplicatesDetected.push({ manual, auto: similarAuto });
      }
    }

    return {
      autoTemplatesWithoutManual,
      duplicatesDetected
    };
  }
}

// Export singleton instance
export const hybridTemplateService = new HybridTemplateServiceImpl();