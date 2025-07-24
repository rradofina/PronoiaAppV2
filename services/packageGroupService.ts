/**
 * Package Group Service
 * Manages package groups for organizing packages into categories
 * Provides CRUD operations for package groups
 */

import { supabase } from '../lib/supabase/client';
import { PackageGroup, CreatePackageGroupRequest } from '../types';

class PackageGroupServiceImpl {
  private cache: PackageGroup[] = [];
  private lastSync: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /**
   * Get all package groups
   */
  async getAllGroups(): Promise<PackageGroup[]> {
    if (this.isCacheValid()) {
      console.log('📦 Using cached package groups');
      return this.cache;
    }

    try {
      console.log('🔄 Loading package groups from database...');
      
      const { data, error } = await supabase
        .from('package_groups')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      this.cache = data || [];
      this.lastSync = new Date();

      console.log(`✅ Loaded ${this.cache.length} package groups from database`);
      return this.cache;
    } catch (error) {
      console.error('❌ Error loading package groups:', error);
      throw error;
    }
  }

  /**
   * Get only active groups
   */
  async getActiveGroups(): Promise<PackageGroup[]> {
    const allGroups = await this.getAllGroups();
    return allGroups.filter(group => group.is_active);
  }

  /**
   * Get single group by ID
   */
  async getGroup(id: string): Promise<PackageGroup | null> {
    const groups = await this.getAllGroups();
    return groups.find(g => g.id === id) || null;
  }

  /**
   * Create new package group
   */
  async createGroup(groupData: CreatePackageGroupRequest): Promise<PackageGroup> {
    try {
      console.log('🔄 Creating new package group...');
      
      const { data, error } = await supabase
        .from('package_groups')
        .insert({
          name: groupData.name,
          description: groupData.description,
          sort_order: groupData.sort_order || 999, // Will be updated by trigger
          is_active: true,
          created_by: await this.getCurrentUserEmail()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create package group: ${error.message}`);
      }

      this.clearCache();
      console.log(`✅ Package group created: ${data.name}`);
      return data;
    } catch (error) {
      console.error('❌ Error creating package group:', error);
      throw error;
    }
  }

  /**
   * Update existing group
   */
  async updateGroup(id: string, updates: Partial<PackageGroup>): Promise<PackageGroup> {
    try {
      console.log(`🔄 Updating package group: ${id}`);
      
      const { data, error } = await supabase
        .from('package_groups')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update package group: ${error.message}`);
      }

      this.clearCache();
      console.log(`✅ Package group updated: ${data.name}`);
      return data;
    } catch (error) {
      console.error(`❌ Error updating package group ${id}:`, error);
      throw error;
    }
  }

  /**
   * Delete group (and ungroup its packages)
   */
  async deleteGroup(id: string): Promise<void> {
    try {
      console.log(`🔄 Deleting package group: ${id}`);
      
      // First, ungroup all packages in this group
      const { error: ungroupError } = await supabase
        .from('manual_packages')
        .update({ group_id: null })
        .eq('group_id', id);

      if (ungroupError) {
        throw new Error(`Failed to ungroup packages: ${ungroupError.message}`);
      }

      // Delete the group
      const { error: deleteError } = await supabase
        .from('package_groups')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(`Failed to delete package group: ${deleteError.message}`);
      }

      this.clearCache();
      console.log('✅ Package group deleted successfully');
    } catch (error) {
      console.error(`❌ Error deleting package group ${id}:`, error);
      throw error;
    }
  }

  /**
   * Reorder groups
   */
  async reorderGroups(groupOrder: { group_id: string; sort_order: number }[]): Promise<void> {
    try {
      console.log(`🔄 Reordering ${groupOrder.length} package groups`);
      
      // Update sort order for each group
      for (const item of groupOrder) {
        const { error } = await supabase
          .from('package_groups')
          .update({ sort_order: item.sort_order })
          .eq('id', item.group_id);

        if (error) {
          throw new Error(`Failed to reorder groups: ${error.message}`);
        }
      }
      
      this.clearCache();
      console.log('✅ Groups reordered successfully');
    } catch (error) {
      console.error('❌ Error reordering groups:', error);
      throw error;
    }
  }

  /**
   * Activate group
   */
  async activateGroup(id: string): Promise<void> {
    await this.updateGroup(id, { is_active: true });
  }

  /**
   * Deactivate group
   */
  async deactivateGroup(id: string): Promise<void> {
    await this.updateGroup(id, { is_active: false });
  }

  /**
   * Get groups with their packages
   */
  async getGroupsWithPackages(): Promise<PackageGroup[]> {
    try {
      console.log('🔄 Loading groups with packages...');
      
      const { data, error } = await supabase
        .from('package_groups')
        .select(`
          *,
          packages:manual_packages (
            id,
            name,
            description,
            thumbnail_url,
            print_size,
            template_count,
            price,
            is_active,
            is_default,
            sort_order,
            created_at,
            updated_at
          )
        `)
        .order('sort_order', { ascending: true });

      if (error) {
        throw new Error(`Failed to load groups with packages: ${error.message}`);
      }

      console.log(`✅ Loaded ${data?.length || 0} groups with packages`);
      return data || [];
    } catch (error) {
      console.error('❌ Error loading groups with packages:', error);
      throw error;
    }
  }

  /**
   * Clear cache and force refresh
   */
  clearCache(): void {
    this.cache = [];
    this.lastSync = null;
    console.log('🗑️ Package group cache cleared');
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
}

// Export singleton instance
export const packageGroupService = new PackageGroupServiceImpl();