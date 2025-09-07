/**
 * Print Size Service - Dynamic print size configuration from database
 * Replaces hardcoded PRINT_SIZES constant with database-driven configuration
 */

import { supabase } from '../lib/supabase/client';
import { PrintSize } from '../types';

export interface PrintSizeConfig {
  name: PrintSize;
  label: string;
  dimensions: {
    width: number;
    height: number;
    dpi: number;
    inches: {
      width: number;
      height: number;
    };
  };
  description: string;
  is_custom_layouts: boolean;
  has_templates: boolean; // Whether this print size has any templates in database
}

class PrintSizeServiceImpl {
  private cache: PrintSizeConfig[] = [];
  private lastSync: Date | null = null;
  private readonly CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

  /**
   * Get all available print sizes from database - NO HARDCODING
   */
  async getAvailablePrintSizes(forceRefresh = false): Promise<PrintSizeConfig[]> {
    if (!forceRefresh && this.isCacheValid()) {
      return this.cache;
    }

    try {
      // Get unique print sizes from manual_templates
      const { data: templates, error } = await supabase
        .from('manual_templates')
        .select('print_size, dimensions')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching print sizes:', error);
        throw new Error(`Database error: ${error.message}`);
      }

      if (!templates || templates.length === 0) {
        console.error('❌ NO TEMPLATES FOUND - Cannot determine available print sizes');
        throw new Error('No active templates found in database.');
      }

      // Group by print size and create configurations
      const sizeMap = new Map<PrintSize, PrintSizeConfig>();

      for (const template of templates) {
        const printSize = template.print_size;
        if (!sizeMap.has(printSize)) {
          const config = this.createPrintSizeConfig(printSize, template.dimensions);
          sizeMap.set(printSize, config);
        }
      }

      this.cache = Array.from(sizeMap.values());
      this.lastSync = new Date();

      if (process.env.NODE_ENV === 'development') console.log(`✅ Loaded ${this.cache.length} print sizes from database:`, 
        this.cache.map(p => p.name).join(', '));

      return this.cache;
    } catch (error) {
      console.error('❌ CRITICAL: Failed to load print sizes from database:', error);
      throw error;
    }
  }

  /**
   * Get configuration for a specific print size
   */
  async getPrintSizeConfig(printSize: PrintSize): Promise<PrintSizeConfig | null> {
    const sizes = await this.getAvailablePrintSizes();
    return sizes.find(s => s.name === printSize) || null;
  }

  /**
   * Check if a print size is available
   */
  async isPrintSizeAvailable(printSize: PrintSize): Promise<boolean> {
    try {
      const config = await this.getPrintSizeConfig(printSize);
      return config !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get all print sizes that support custom layouts (4R typically)
   */
  async getCustomLayoutPrintSizes(): Promise<PrintSizeConfig[]> {
    const sizes = await this.getAvailablePrintSizes();
    return sizes.filter(s => s.is_custom_layouts);
  }

  /**
   * Get dimensions for a print size
   */
  async getPrintSizeDimensions(printSize: PrintSize): Promise<{ width: number; height: number } | null> {
    const config = await this.getPrintSizeConfig(printSize);
    return config ? { width: config.dimensions.width, height: config.dimensions.height } : null;
  }

  /**
   * Clear cache and force refresh
   */
  clearCache(): void {
    this.cache = [];
    this.lastSync = null;
    if (process.env.NODE_ENV === 'development') console.log('🗑️ Print size cache cleared - will reload from database');
  }

  /**
   * Create print size configuration from database data
   */
  private createPrintSizeConfig(printSize: PrintSize, dimensions: any): PrintSizeConfig {
    if (!dimensions || typeof dimensions.width !== 'number' || typeof dimensions.height !== 'number') {
      throw new Error(`Invalid dimensions for print size '${printSize}'`);
    }

    // Calculate inches from pixel dimensions at 300 DPI
    const dpi = 300;
    const widthInches = dimensions.width / dpi;
    const heightInches = dimensions.height / dpi;

    // Determine if this print size supports custom layouts
    // 4R typically supports custom layouts, others are usually full-size only
    const is_custom_layouts = printSize.toLowerCase().includes('4r') || 
                             (widthInches >= 3.5 && widthInches <= 4.5 && heightInches >= 5.5 && heightInches <= 6.5);

    return {
      name: printSize,
      label: this.generateLabel(printSize, widthInches, heightInches),
      dimensions: {
        width: dimensions.width,
        height: dimensions.height,
        dpi,
        inches: {
          width: widthInches,
          height: heightInches,
        },
      },
      description: this.generateDescription(printSize, widthInches, heightInches, is_custom_layouts),
      is_custom_layouts,
      has_templates: true, // If we found it in the database, it has templates
    };
  }

  /**
   * Generate human-readable label for print size
   */
  private generateLabel(printSize: PrintSize, widthInches: number, heightInches: number): string {
    const roundedWidth = Math.round(widthInches * 10) / 10;
    const roundedHeight = Math.round(heightInches * 10) / 10;
    return `${printSize} (${roundedWidth}×${roundedHeight}")`;
  }

  /**
   * Generate description for print size
   */
  private generateDescription(printSize: PrintSize, widthInches: number, heightInches: number, isCustomLayouts: boolean): string {
    const roundedWidth = Math.round(widthInches * 10) / 10;
    const roundedHeight = Math.round(heightInches * 10) / 10;
    const layoutType = isCustomLayouts ? 'custom layout support' : 'full-size only';
    return `Standard ${roundedWidth}×${roundedHeight} inch photo print, ${layoutType}`;
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
export const printSizeService = new PrintSizeServiceImpl();