/**
 * Template Configuration Service - PURE DATABASE-DRIVEN
 * No fallbacks, no hardcoded values - everything comes from the database
 */

import { supabase } from '../lib/supabase/client';
import { TemplateType, PrintSize, TemplateTypeInfo } from '../types';

export interface TemplateTypeConfig {
  id: string;
  name: string;
  description: string;
  icon: string;
  preview: string;
  slots: number;
  layout: {
    arrangement: 'single' | 'grid' | 'strip';
    spacing: number;
    padding: number;
  };
  print_sizes: PrintSize[];
  dimensions: Record<PrintSize, { width: number; height: number }>;
  is_active: boolean;
}

export interface DatabaseTemplate {
  template_type: string;
  print_size: PrintSize;
  dimensions: { width: number; height: number };
  holes_data: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  name: string;
  description?: string;
}

class TemplateConfigServiceImpl {
  private cache: TemplateTypeConfig[] = [];
  private lastSync: Date | null = null;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  /**
   * Get all available template types from database - NO FALLBACKS
   */
  async getTemplateTypes(forceRefresh = false): Promise<TemplateTypeConfig[]> {
    if (!forceRefresh && this.isCacheValid()) {
      return this.cache;
    }

    try {
      // Get ALL data from manual_templates - we need holes_data, dimensions, etc.
      const { data: manualTemplates, error: manualError } = await supabase
        .from('manual_templates')
        .select('template_type, print_size, dimensions, holes_data, name, description')
        .eq('is_active', true);

      if (manualError) {
        console.error('Error fetching manual templates:', manualError);
        throw new Error(`Database error: ${manualError.message}`);
      }

      if (!manualTemplates || manualTemplates.length === 0) {
        console.error('❌ NO TEMPLATES FOUND IN DATABASE - System requires templates to function');
        throw new Error('No active templates found in database. Please add templates through the admin panel.');
      }

      // Group templates by type to build configuration
      const typeConfigs = new Map<string, TemplateTypeConfig>();

      for (const template of manualTemplates) {
        const typeId = template.template_type;
        
        if (!typeConfigs.has(typeId)) {
          // Create new config from first template of this type
          const config = this.createConfigFromTemplate(template);
          typeConfigs.set(typeId, config);
        } else {
          // Add additional print sizes and dimensions to existing config
          const config = typeConfigs.get(typeId)!;
          
          if (!config.print_sizes.includes(template.print_size)) {
            config.print_sizes.push(template.print_size);
          }
          
          if (template.dimensions) {
            (config.dimensions as any)[template.print_size] = template.dimensions;
          }
        }
      }

      this.cache = Array.from(typeConfigs.values());
      this.lastSync = new Date();

      console.log(`✅ Loaded ${this.cache.length} template types from database:`, 
        this.cache.map(t => `${t.id} (${t.slots} slots)`).join(', '));

      return this.cache;
    } catch (error) {
      console.error('❌ CRITICAL: Failed to load template types from database:', error);
      // NO FALLBACKS - if database fails, the system should fail
      throw error;
    }
  }

  /**
   * Get configuration for a specific template type - NO FALLBACKS
   */
  async getTemplateTypeConfig(templateType: string): Promise<TemplateTypeConfig | null> {
    const types = await this.getTemplateTypes();
    const config = types.find(t => t.id === templateType);
    
    if (!config) {
      console.error(`❌ Template type '${templateType}' not found in database`);
      return null;
    }
    
    return config;
  }

  /**
   * Get available print sizes for a template type - NO FALLBACKS
   */
  async getAvailablePrintSizes(templateType: string): Promise<PrintSize[]> {
    const config = await this.getTemplateTypeConfig(templateType);
    
    if (!config) {
      throw new Error(`Template type '${templateType}' not found in database`);
    }
    
    return config.print_sizes;
  }

  /**
   * Get dimensions for a template type and print size - NO FALLBACKS
   */
  async getTemplateDimensions(templateType: string, printSize: PrintSize): Promise<{ width: number; height: number }> {
    const config = await this.getTemplateTypeConfig(templateType);
    
    if (!config) {
      throw new Error(`Template type '${templateType}' not found in database`);
    }

    const dimensions = config.dimensions[printSize];
    if (!dimensions) {
      throw new Error(`Dimensions for template type '${templateType}' and print size '${printSize}' not found in database`);
    }

    return dimensions;
  }

  /**
   * Get layout configuration for a template type - NO FALLBACKS
   */
  async getTemplateLayout(templateType: string): Promise<{
    slots: number;
    arrangement: 'single' | 'grid' | 'strip';
    spacing: number;
    padding: number;
  }> {
    const config = await this.getTemplateTypeConfig(templateType);
    
    if (!config) {
      throw new Error(`Template type '${templateType}' not found in database`);
    }

    return {
      slots: config.slots,
      arrangement: config.layout.arrangement,
      spacing: config.layout.spacing,
      padding: config.layout.padding
    };
  }

  /**
   * Get photo slots for a template type and print size - PURE DATABASE CALCULATION
   */
  async getPhotoSlots(templateType: string, printSize: PrintSize): Promise<Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>> {
    // Get the actual template from database with holes_data
    const { data: template, error } = await supabase
      .from('manual_templates')
      .select('holes_data, dimensions')
      .eq('template_type', templateType)
      .eq('print_size', printSize)
      .eq('is_active', true)
      .single();

    if (error || !template) {
      throw new Error(`Template for type '${templateType}' and print size '${printSize}' not found in database`);
    }

    if (!template.holes_data || !Array.isArray(template.holes_data)) {
      throw new Error(`Invalid holes_data for template '${templateType}' - ${printSize}`);
    }

    // Return the exact holes_data from database
    return template.holes_data;
  }

  /**
   * Convert to TemplateTypeInfo format for backward compatibility
   */
  async getTemplateTypeInfos(): Promise<TemplateTypeInfo[]> {
    const configs = await this.getTemplateTypes();
    
    return configs.map(config => ({
      id: config.id as TemplateType,
      name: config.name,
      description: config.description,
      icon: config.icon,
      preview: config.preview,
      slots: config.slots
    }));
  }

  /**
   * Clear cache and force refresh
   */
  clearCache(): void {
    this.cache = [];
    this.lastSync = null;
    console.log('🗑️ Template config cache cleared - will reload from database');
  }

  /**
   * Create template type config from database template - NO DEFAULTS
   */
  private createConfigFromTemplate(template: DatabaseTemplate): TemplateTypeConfig {
    if (!template.holes_data || !Array.isArray(template.holes_data)) {
      throw new Error(`Invalid holes_data for template '${template.template_type}'`);
    }

    if (!template.dimensions) {
      throw new Error(`Missing dimensions for template '${template.template_type}'`);
    }

    const slots = template.holes_data.length;
    const layout = this.calculateLayoutFromHoles(template.holes_data, template.dimensions);
    
    return {
      id: template.template_type,
      name: template.name || this.generateDisplayName(template.template_type),
      description: template.description || `${slots} photo template`,
      icon: this.generateIcon(template.template_type, slots),
      preview: this.generatePreview(template.template_type, slots),
      slots,
      layout,
      print_sizes: [template.print_size],
      dimensions: {
        [template.print_size]: template.dimensions
      } as Record<PrintSize, { width: number; height: number }>,
      is_active: true
    };
  }

  /**
   * Calculate layout properties from holes data
   */
  private calculateLayoutFromHoles(holes: Array<{ x: number; y: number; width: number; height: number }>, dimensions: { width: number; height: number }): {
    arrangement: 'single' | 'grid' | 'strip';
    spacing: number;
    padding: number;
  } {
    if (holes.length === 1) {
      const hole = holes[0];
      const padding = Math.min(hole.x, hole.y);
      return {
        arrangement: 'single',
        spacing: 0,
        padding
      };
    }

    // Calculate spacing between holes
    let minSpacing = Infinity;
    for (let i = 0; i < holes.length; i++) {
      for (let j = i + 1; j < holes.length; j++) {
        const dx = Math.abs(holes[i].x - holes[j].x);
        const dy = Math.abs(holes[i].y - holes[j].y);
        const spacing = Math.min(dx, dy);
        if (spacing > 0 && spacing < minSpacing) {
          minSpacing = spacing;
        }
      }
    }

    const spacing = minSpacing === Infinity ? 0 : minSpacing;
    const padding = Math.min(...holes.map(h => Math.min(h.x, h.y)));

    // Determine arrangement from hole positions
    const xPositions = [...new Set(holes.map(h => h.x))].sort((a, b) => a - b);
    const yPositions = [...new Set(holes.map(h => h.y))].sort((a, b) => a - b);

    if (xPositions.length === 1) {
      return { arrangement: 'strip', spacing, padding };
    } else if (yPositions.length === 1) {
      return { arrangement: 'strip', spacing, padding };
    } else {
      return { arrangement: 'grid', spacing, padding };
    }
  }

  /**
   * Generate display name from template type
   */
  private generateDisplayName(templateType: string): string {
    return templateType
      .split(/[-_]/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') + ' Template';
  }

  /**
   * Generate icon based on template type and slot count
   */
  private generateIcon(templateType: string, slots: number): string {
    if (slots === 1) return '🖼️';
    if (slots <= 4) return '🏁';
    if (slots <= 6) return '📸';
    return '📋';
  }

  /**
   * Generate preview text based on template type and slot count
   */
  private generatePreview(templateType: string, slots: number): string {
    return `${slots} photo${slots > 1 ? 's' : ''} layout`;
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
}

// Export singleton instance
export const templateConfigService = new TemplateConfigServiceImpl();