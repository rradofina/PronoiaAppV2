/**
 * Manual Package Service
 * Manages manual packages with their associated templates
 * Provides CRUD operations for the manual template/package system
 */

import { supabase } from '../lib/supabase/client';
import { 
  ManualPackage, 
  ManualPackageWithTemplates, 
  CreateManualPackageRequest,
  PrintSize,
  ManualPackageService as IManualPackageService
} from '../types';

class ManualPackageServiceImpl implements IManualPackageService {
  private cache: ManualPackage[] = [];
  private lastSync: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all packages (active and inactive)
   */
  async getAllPackages(): Promise<ManualPackage[]> {
    if (this.isCacheValid()) {
      console.log('📦 Using cached packages');
      return this.cache;
    }

    try {
      console.log('🔄 Loading packages from database...');
      
      const { data, error } = await supabase
        .from('manual_packages')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      this.cache = data || [];
      this.lastSync = new Date();

      console.log(`✅ Loaded ${this.cache.length} packages from database`);
      return this.cache;
    } catch (error) {
      console.error('❌ Error loading packages:', error);
      throw error;
    }
  }

  /**
   * Get only active packages
   */
  async getActivePackages(): Promise<ManualPackage[]> {
    const allPackages = await this.getAllPackages();
    return allPackages.filter(pkg => pkg.is_active);
  }

  /**
   * Get packages by print size
   */
  async getPackagesByPrintSize(printSize: PrintSize): Promise<ManualPackage[]> {
    const allPackages = await this.getAllPackages();
    return allPackages.filter(pkg => pkg.print_size === printSize);
  }

  /**
   * Get single package with its templates
   */
  async getPackageWithTemplates(id: string): Promise<ManualPackageWithTemplates | null> {
    try {
      console.log(`🔄 Loading package with templates: ${id}`);
      
      const { data, error } = await supabase
        .from('manual_packages')
        .select(`
          *,
          package_templates (
            id,
            order_index,
            template:manual_templates (*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Package not found
        }
        throw new Error(`Database error: ${error.message}`);
      }

      console.log('🔍 RAW DATABASE RESPONSE:', JSON.stringify(data, null, 2));

      // Transform the response to match expected structure
      const packageWithTemplates: ManualPackageWithTemplates = {
        ...data,
        templates: data.package_templates?.map((pt: any) => pt.template).filter(Boolean) || []
      };

      console.log(`✅ Loaded package with ${packageWithTemplates.templates?.length || 0} templates`);
      console.log('📋 Template details:', packageWithTemplates.templates?.map(t => ({
        id: t?.id,
        name: t?.name,
        type: t?.template_type
      })));
      
      return packageWithTemplates;
    } catch (error) {
      console.error(`❌ Error loading package ${id}:`, error);
      throw error;
    }
  }

  /**
   * Create new package
   */
  async createPackage(packageData: CreateManualPackageRequest): Promise<ManualPackage> {
    try {
      console.log('🔄 Creating new package...');
      
      // Start transaction
      const { data: newPackage, error: packageError } = await supabase
        .from('manual_packages')
        .insert({
          name: packageData.name,
          description: packageData.description,
          thumbnail_url: packageData.thumbnail_url,
          print_size: packageData.print_size,
          template_count: packageData.template_count,
          price: packageData.price,
          photo_limit: packageData.photo_limit,
          is_unlimited_photos: packageData.is_unlimited_photos,
          is_active: true,
          is_default: false,
          sort_order: 999 // Will be updated by trigger
        })
        .select()
        .single();

      if (packageError) {
        throw new Error(`Failed to create package: ${packageError.message}`);
      }

      // Add templates to package with position-based approach
      if (packageData.template_ids.length > 0) {
        const packageTemplateInserts = packageData.template_ids.map((templateId, index) => ({
          package_id: newPackage.id,
          template_id: templateId,
          order_index: index,
          position: index + 1 // 1-based position to allow duplicate templates
        }));

        const { error: templateError } = await supabase
          .from('package_templates')
          .insert(packageTemplateInserts);

        if (templateError) {
          // Rollback package creation if template association fails
          await supabase
            .from('manual_packages')
            .delete()
            .eq('id', newPackage.id);
          
          throw new Error(`Failed to associate templates: ${templateError.message}`);
        }
      }

      this.clearCache();
      console.log(`✅ Package created: ${newPackage.name}`);
      return newPackage;
    } catch (error) {
      console.error('❌ Error creating package:', error);
      throw error;
    }
  }

  /**
   * Update existing package
   */
  async updatePackage(id: string, updates: Partial<ManualPackage>): Promise<ManualPackage> {
    try {
      console.log(`🔄 Updating package: ${id}`);
      
      const { data, error } = await supabase
        .from('manual_packages')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update package: ${error.message}`);
      }

      this.clearCache();
      console.log(`✅ Package updated: ${data.name}`);
      return data;
    } catch (error) {
      console.error(`❌ Error updating package ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete package (and its template associations)
   */
  async deletePackage(id: string): Promise<void> {
    try {
      console.log(`🔄 Deleting package: ${id}`);
      
      // Delete template associations first (due to foreign key constraint)
      const { error: templateError } = await supabase
        .from('package_templates')
        .delete()
        .eq('package_id', id);

      if (templateError) {
        throw new Error(`Failed to delete template associations: ${templateError.message}`);
      }

      // Delete the package
      const { error: packageError } = await supabase
        .from('manual_packages')
        .delete()
        .eq('id', id);

      if (packageError) {
        throw new Error(`Failed to delete package: ${packageError.message}`);
      }

      this.clearCache();
      console.log('✅ Package deleted successfully');
    } catch (error) {
      console.error(`❌ Error deleting package ${id}:`, error);
      throw error;
    }
  }

  /**
   * Add templates to package
   */
  async addTemplatesToPackage(packageId: string, templateIds: string[]): Promise<void> {
    try {
      console.log(`🔄 Adding ${templateIds.length} templates to package ${packageId}`);
      
      // Get current max position and order index
      const { data: existingTemplates } = await supabase
        .from('package_templates')
        .select('order_index, position')
        .eq('package_id', packageId)
        .order('position', { ascending: false })
        .limit(1);

      const startOrderIndex = existingTemplates?.[0]?.order_index + 1 || 0;
      const startPosition = existingTemplates?.[0]?.position + 1 || 1;

      const inserts = templateIds.map((templateId, index) => ({
        package_id: packageId,
        template_id: templateId,
        order_index: startOrderIndex + index,
        position: startPosition + index
      }));

      const { error } = await supabase
        .from('package_templates')
        .insert(inserts);

      if (error) {
        throw new Error(`Failed to add templates: ${error.message}`);
      }

      // Update package template count
      await this.updatePackageTemplateCount(packageId);
      
      console.log('✅ Templates added to package');
    } catch (error) {
      console.error(`❌ Error adding templates to package:`, error);
      throw error;
    }
  }

  /**
   * Remove templates from package
   */
  async removeTemplatesFromPackage(packageId: string, templateIds: string[]): Promise<void> {
    try {
      console.log(`🔄 Removing ${templateIds.length} templates from package ${packageId}`);
      
      const { error } = await supabase
        .from('package_templates')
        .delete()
        .eq('package_id', packageId)
        .in('template_id', templateIds);

      if (error) {
        throw new Error(`Failed to remove templates: ${error.message}`);
      }

      // Update package template count
      await this.updatePackageTemplateCount(packageId);
      
      console.log('✅ Templates removed from package');
    } catch (error) {
      console.error(`❌ Error removing templates from package:`, error);
      throw error;
    }
  }

  /**
   * Reorder templates in package
   */
  async reorderPackageTemplates(packageId: string, templateOrder: { template_id: string; order_index: number }[]): Promise<void> {
    try {
      console.log(`🔄 Reordering templates in package ${packageId}`);
      
      // Update order for each template
      for (const item of templateOrder) {
        const { error } = await supabase
          .from('package_templates')
          .update({ order_index: item.order_index })
          .eq('package_id', packageId)
          .eq('template_id', item.template_id);

        if (error) {
          throw new Error(`Failed to reorder templates: ${error.message}`);
        }
      }
      
      console.log('✅ Templates reordered successfully');
    } catch (error) {
      console.error(`❌ Error reordering templates:`, error);
      throw error;
    }
  }

  /**
   * Activate package
   */
  async activatePackage(id: string): Promise<void> {
    await this.updatePackage(id, { is_active: true });
  }

  /**
   * Deactivate package
   */
  async deactivatePackage(id: string): Promise<void> {
    await this.updatePackage(id, { is_active: false });
  }

  /**
   * Set package as default for its print size
   */
  async setAsDefault(id: string): Promise<void> {
    try {
      console.log(`🔄 Setting package ${id} as default`);
      
      // Get the package to know its print size
      const pkg = await this.getPackageWithTemplates(id);
      if (!pkg) {
        throw new Error('Package not found');
      }

      // Remove default flag from all packages of the same print size
      const { error: clearError } = await supabase
        .from('manual_packages')
        .update({ is_default: false })
        .eq('print_size', pkg.print_size);

      if (clearError) {
        throw new Error(`Failed to clear default flags: ${clearError.message}`);
      }

      // Set this package as default
      await this.updatePackage(id, { is_default: true });
      
      console.log('✅ Package set as default');
    } catch (error) {
      console.error(`❌ Error setting default package:`, error);
      throw error;
    }
  }

  /**
   * Get package statistics
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    byPrintSize: Record<PrintSize, number>;
    totalTemplates: number;
  }> {
    const packages = await this.getAllPackages();
    
    const active = packages.filter(p => p.is_active);
    
    const byPrintSize = packages.reduce((acc, pkg) => {
      acc[pkg.print_size] = (acc[pkg.print_size] || 0) + 1;
      return acc;
    }, {} as Record<PrintSize, number>);

    const totalTemplates = packages.reduce((sum, pkg) => sum + pkg.template_count, 0);

    return {
      total: packages.length,
      active: active.length,
      byPrintSize,
      totalTemplates
    };
  }

  /**
   * Clear cache and force refresh
   */
  clearCache(): void {
    this.cache = [];
    this.lastSync = null;
    console.log('🗑️ Package cache cleared');
  }

  /**
   * Update package template count based on actual associated templates
   */
  private async updatePackageTemplateCount(packageId: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('package_templates')
        .select('id')
        .eq('package_id', packageId);

      if (error) {
        throw new Error(`Failed to count templates: ${error.message}`);
      }

      const count = data?.length || 0;
      
      await supabase
        .from('manual_packages')
        .update({ 
          template_count: count,
          updated_at: new Date().toISOString()
        })
        .eq('id', packageId);

      this.clearCache();
    } catch (error) {
      console.error('❌ Error updating template count:', error);
      // Don't throw here as this is a maintenance operation
    }
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
export const manualPackageService = new ManualPackageServiceImpl();