/**
 * Manual Template Service
 * Handles CRUD operations for manually configured templates
 * Works alongside existing auto-detection system during gradual migration
 */

import { supabase } from '../lib/supabase/client';
import { 
  ManualTemplate, 
  ManualTemplateService as IManualTemplateService,
  CreateManualTemplateRequest,
  PrintSize,
  TemplateType 
} from '../types';

class ManualTemplateServiceImpl implements IManualTemplateService {
  private cache: ManualTemplate[] = [];
  private lastSync: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all templates (with caching)
   */
  async getAllTemplates(): Promise<ManualTemplate[]> {
    if (this.isCacheValid()) {
      console.log('📦 Using cached manual templates');
      return this.cache;
    }

    try {
      console.log('🔄 Loading manual templates from database...');
      
      const { data, error } = await supabase
        .from('manual_templates')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error loading manual templates:', error);
        throw new Error(`Failed to load manual templates: ${error.message}`);
      }

      this.cache = data || [];
      this.lastSync = new Date();
      
      console.log(`✅ Loaded ${this.cache.length} manual templates:`, {
        totalTemplates: this.cache.length,
        templatesByType: this.cache.reduce((acc, t) => {
          acc[t.template_type] = (acc[t.template_type] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
        activeTemplates: this.cache.filter(t => t.is_active).length,
        printSizes: [...new Set(this.cache.map(t => t.print_size))],
        templateDetails: this.cache.map(t => ({
          name: t.name,
          template_type: t.template_type,
          print_size: t.print_size,
          is_active: t.is_active
        }))
      });
      return this.cache;
    } catch (error) {
      console.error('❌ Manual template service error:', error);
      throw error;
    }
  }

  /**
   * Get active templates only
   */
  async getActiveTemplates(): Promise<ManualTemplate[]> {
    const templates = await this.getAllTemplates();
    const activeTemplates = templates.filter(t => t.is_active);
    
    console.log('🎯 MANUAL TEMPLATE SERVICE - getActiveTemplates() result:', {
      totalTemplatesFromDB: templates.length,
      activeTemplates: activeTemplates.length,
      templatesByType: activeTemplates.reduce((acc, t) => {
        acc[t.template_type] = (acc[t.template_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      templateDetails: activeTemplates.map(t => ({
        id: t.id,
        name: t.name,
        template_type: t.template_type,
        print_size: t.print_size,
        is_active: t.is_active,
        drive_file_id: t.drive_file_id
      }))
    });
    
    return activeTemplates;
  }

  /**
   * Get available template types from database
   */
  async getAvailableTemplateTypes(): Promise<string[]> {
    // Use existing getUniqueTemplateTypes method without print size filter
    return this.getUniqueTemplateTypes();
  }

  /**
   * Get templates by print size
   */
  async getTemplatesByPrintSize(printSize: PrintSize): Promise<ManualTemplate[]> {
    const templates = await this.getActiveTemplates();
    return templates.filter(t => t.print_size === printSize);
  }

  /**
   * Get single template by ID
   */
  async getTemplate(id: string): Promise<ManualTemplate | null> {
    const templates = await this.getAllTemplates();
    return templates.find(t => t.id === id) || null;
  }

  /**
   * Create new manual template
   */
  async createTemplate(templateData: CreateManualTemplateRequest): Promise<ManualTemplate> {
    try {
      console.log('📝 Creating manual template:', templateData.name);

      const { data, error } = await supabase
        .from('manual_templates')
        .insert({
          name: templateData.name,
          description: templateData.description,
          template_type: templateData.template_type,
          print_size: templateData.print_size,
          drive_file_id: templateData.drive_file_id,
          holes_data: templateData.holes_data,
          dimensions: templateData.dimensions,
          thumbnail_url: templateData.thumbnail_url,
          sample_image_url: templateData.sample_image_url,
          category_id: templateData.category_id,
          custom_width_inches: templateData.custom_width_inches,
          custom_height_inches: templateData.custom_height_inches,
          custom_dpi: templateData.custom_dpi,
          created_by: await this.getCurrentUserEmail(),
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Error creating manual template:', error);
        throw new Error(`Failed to create template: ${error.message}`);
      }

      // Invalidate cache
      this.clearCache();
      
      console.log('✅ Manual template created successfully:', data.id);
      return data as ManualTemplate;
    } catch (error) {
      console.error('❌ Create template error:', error);
      throw error;
    }
  }

  /**
   * Update existing template
   */
  async updateTemplate(id: string, updates: Partial<ManualTemplate>): Promise<ManualTemplate> {
    try {
      console.log('📝 Updating manual template:', id);

      // Remove readonly fields
      const { created_at, updated_at, ...updateData } = updates;

      const { data, error } = await supabase
        .from('manual_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('❌ Error updating manual template:', error);
        throw new Error(`Failed to update template: ${error.message}`);
      }

      if (!data) {
        throw new Error('Template not found');
      }

      // Invalidate cache
      this.clearCache();
      
      console.log('✅ Manual template updated successfully');
      return data as ManualTemplate;
    } catch (error) {
      console.error('❌ Update template error:', error);
      throw error;
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(id: string): Promise<void> {
    try {
      console.log('🗑️ Deleting manual template:', id);

      const { error } = await supabase
        .from('manual_templates')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Error deleting manual template:', error);
        throw new Error(`Failed to delete template: ${error.message}`);
      }

      // Invalidate cache
      this.clearCache();
      
      console.log('✅ Manual template deleted successfully');
    } catch (error) {
      console.error('❌ Delete template error:', error);
      throw error;
    }
  }

  /**
   * Soft delete (deactivate) template
   */
  async deactivateTemplate(id: string): Promise<void> {
    await this.updateTemplate(id, { is_active: false });
    console.log('⏸️ Template deactivated:', id);
  }

  /**
   * Activate template
   */
  async activateTemplate(id: string): Promise<void> {
    await this.updateTemplate(id, { is_active: true });
    console.log('▶️ Template activated:', id);
  }

  /**
   * Get templates by category
   */
  async getTemplatesByCategory(categoryId: string): Promise<ManualTemplate[]> {
    const templates = await this.getActiveTemplates();
    return templates.filter(t => t.category_id === categoryId);
  }

  /**
   * Get templates by type and size (for hybrid loading)
   */
  async getTemplatesByTypeAndSize(type: TemplateType, size: PrintSize): Promise<ManualTemplate[]> {
    const templates = await this.getActiveTemplates();
    return templates.filter(t => t.template_type === type && t.print_size === size);
  }

  /**
   * Search templates by name or description
   */
  async searchTemplates(query: string): Promise<ManualTemplate[]> {
    const templates = await this.getActiveTemplates();
    const lowerQuery = query.toLowerCase();
    return templates.filter(t => 
      t.name.toLowerCase().includes(lowerQuery) || 
      (t.description && t.description.toLowerCase().includes(lowerQuery))
    );
  }

  /**
   * Get unique template types available in the database
   * @param printSize - Optional filter by print size
   * @returns Array of unique template types
   */
  async getUniqueTemplateTypes(printSize?: PrintSize): Promise<string[]> {
    const templates = await this.getActiveTemplates();
    
    const filteredTemplates = printSize 
      ? templates.filter(t => t.print_size === printSize)
      : templates;
    
    const uniqueTypes = [...new Set(filteredTemplates.map(t => t.template_type))];
    
    console.log('📋 Available template types:', {
      printSize: printSize || 'all',
      templateTypes: uniqueTypes,
      totalTemplates: filteredTemplates.length
    });
    
    return uniqueTypes;
  }

  /**
   * Get templates grouped by type for a specific print size
   * @param printSize - Print size to filter by
   * @returns Object with template types as keys and template arrays as values
   */
  async getTemplatesGroupedByType(printSize: PrintSize): Promise<Record<TemplateType, ManualTemplate[]>> {
    const templates = await this.getActiveTemplates();
    const filteredTemplates = templates.filter(t => t.print_size === printSize);
    
    const grouped = filteredTemplates.reduce((acc, template) => {
      if (!acc[template.template_type]) {
        acc[template.template_type] = [];
      }
      acc[template.template_type].push(template);
      return acc;
    }, {} as Record<TemplateType, ManualTemplate[]>);

    console.log('🏷️ Templates grouped by type for', printSize + ':', {
      availableTypes: Object.keys(grouped),
      counts: Object.entries(grouped).reduce((acc, [type, templates]) => {
        acc[type] = templates.length;
        return acc;
      }, {} as Record<string, number>)
    });

    return grouped;
  }

  /**
   * Find template by exact template type match
   * Prioritizes exact template_type match over other fields
   * @param targetType - Template type to find
   * @param printSize - Print size to filter by
   * @returns First matching template or null
   */
  async findTemplateByType(targetType: TemplateType, printSize: PrintSize): Promise<ManualTemplate | null> {
    const templates = await this.getActiveTemplates();
    
    // Filter by print size first
    const sizedTemplates = templates.filter(t => t.print_size === printSize);
    
    // Find exact template_type match
    const exactMatch = sizedTemplates.find(t => t.template_type === targetType);
    
    if (exactMatch) {
      console.log('✅ Found exact template type match:', {
        targetType,
        printSize,
        foundTemplate: {
          id: exactMatch.id,
          name: exactMatch.name,
          template_type: exactMatch.template_type
        }
      });
      return exactMatch;
    }

    console.log('❌ No exact template type match found:', {
      targetType,
      printSize,
      availableTypes: sizedTemplates.map(t => t.template_type)
    });
    
    return null;
  }

  /**
   * Bulk import from auto-detection system
   */
  async importFromAutoDetection(autoTemplates: any[]): Promise<ManualTemplate[]> {
    console.log(`📥 Importing ${autoTemplates.length} templates from auto-detection...`);
    const imported: ManualTemplate[] = [];

    for (const autoTemplate of autoTemplates) {
      try {
        const manualTemplate = await this.createTemplate({
          name: autoTemplate.name,
          description: `Imported from auto-detection`,
          template_type: autoTemplate.templateType,
          print_size: autoTemplate.printSize,
          drive_file_id: autoTemplate.driveFileId || autoTemplate.id,
          holes_data: autoTemplate.holes || [],
          dimensions: autoTemplate.dimensions,
          thumbnail_url: autoTemplate.pngUrl,
        });
        
        imported.push(manualTemplate);
        console.log(`✅ Imported: ${autoTemplate.name}`);
      } catch (error) {
        console.error(`❌ Failed to import: ${autoTemplate.name}`, error);
      }
    }

    console.log(`📦 Successfully imported ${imported.length} templates`);
    return imported;
  }

  /**
   * Clear cache and force reload
   */
  clearCache(): void {
    this.cache = [];
    this.lastSync = null;
    console.log('🗑️ Manual template cache cleared');
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
   * Get current user email for audit trail
   */
  private async getCurrentUserEmail(): Promise<string | undefined> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      return user?.email || undefined;
    } catch (error) {
      console.warn('Could not get current user email:', error);
      return undefined;
    }
  }

  /**
   * Debug method to check current user's admin status
   */
  async checkAdminStatus(): Promise<{isAdmin: boolean; email: string | null; userRecord: any}> {
    const email = await this.getCurrentUserEmail();
    
    if (!email) {
      return { isAdmin: false, email: null, userRecord: null };
    }

    // Check if user exists in users table with admin role
    const { data: userRecord, error } = await supabase
      .from('users')
      .select('email, preferences')
      .eq('email', email)
      .single();

    if (error || !userRecord) {
      console.log('❌ No user record found for:', email);
      return { isAdmin: false, email, userRecord: null };
    }

    const isAdmin = userRecord.preferences?.role === 'admin' || userRecord.preferences?.role === 'super_admin';
    
    console.log('🔍 Admin status check:', {
      email,
      preferences: userRecord.preferences,
      isAdmin
    });

    return { isAdmin, email, userRecord };
  }

  /**
   * Get statistics about manual templates
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    byType: Record<TemplateType, number>;
    bySize: Record<PrintSize, number>;
  }> {
    const templates = await this.getAllTemplates();
    const activeTemplates = templates.filter(t => t.is_active);

    const byType = templates.reduce((acc, t) => {
      acc[t.template_type] = (acc[t.template_type] || 0) + 1;
      return acc;
    }, {} as Record<TemplateType, number>);

    const bySize = templates.reduce((acc, t) => {
      acc[t.print_size] = (acc[t.print_size] || 0) + 1;
      return acc;
    }, {} as Record<PrintSize, number>);

    return {
      total: templates.length,
      active: activeTemplates.length,
      byType,
      bySize
    };
  }
}

// Export singleton instance
export const manualTemplateService = new ManualTemplateServiceImpl();