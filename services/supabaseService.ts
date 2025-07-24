import { supabase } from '../lib/supabase/client';
import { Database } from '../lib/supabase/types';
import { Session, Template, PhotoSlot, CustomTemplate, TemplateCategory, PrintSize, CustomTemplateLayout, CustomPhotoSlot, SupabaseUser, TemplateCacheData } from '../types';

type DbUser = Database['public']['Tables']['users']['Row'];
type DbSession = Database['public']['Tables']['sessions']['Row'];
type DbTemplate = Database['public']['Tables']['templates']['Row'];
type DbPhotoSlot = Database['public']['Tables']['photo_slots']['Row'];
type DbCustomTemplate = Database['public']['Tables']['custom_templates']['Row'];
type DbTemplateCategory = Database['public']['Tables']['template_categories']['Row'];

export class SupabaseService {
  // User management
  async createOrUpdateUser(userData: {
    email: string;
    name?: string;
    google_id: string;
    avatar_url?: string;
  }): Promise<DbUser> {
    // First try to find existing user
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', userData.google_id)
      .single();

    if (existingUser) {
      // Update existing user
      const { data, error } = await supabase
        .from('users')
        .update({
          email: userData.email,
          name: userData.name,
          avatar_url: userData.avatar_url,
        })
        .eq('id', existingUser.id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } else {
      // Create new user
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select()
        .single();

      if (error) throw error;
      return data;
    }
  }

  async getUserByGoogleId(googleId: string): Promise<DbUser | null> {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('google_id', googleId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  // Session management - integrate with your existing Session type
  async createSession(sessionData: {
    user_id: string;
    client_name: string;
    package_id: string; // Updated to use manual package UUID
    google_drive_folder_id: string;
    max_templates: number;
  }): Promise<Session> {
    const { data, error } = await supabase
      .from('sessions')
      .insert([sessionData])
      .select()
      .single();

    if (error) throw error;

    // Convert DB session to your app's Session type
    return {
      id: data.id,
      clientName: data.client_name,
      package_id: data.package_id, // Updated to use manual package ID
      selectedTemplates: [], // Will be loaded separately
      maxTemplates: data.max_templates,
      usedTemplates: data.used_templates,
      googleDriveFolderId: data.google_drive_folder_id,
      outputFolderId: data.output_folder_id || undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
      isCompleted: data.is_completed,
    };
  }

  async getUserSessions(userId: string): Promise<DbSession[]> {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  async updateSession(sessionId: string, updates: Partial<DbSession>): Promise<DbSession> {
    const { data, error } = await supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Template management
  async saveTemplate(templateData: {
    session_id: string;
    user_id: string;
    type: 'solo' | 'collage' | 'photocard' | 'photostrip';
    name: string;
    dimensions: object;
    layout_config: object;
  }): Promise<DbTemplate> {
    const { data, error } = await supabase
      .from('templates')
      .insert([templateData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getSessionTemplates(sessionId: string): Promise<DbTemplate[]> {
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Photo slot management
  async savePhotoSlot(slotData: {
    template_id: string;
    slot_index: number;
    photo_google_id?: string;
    photo_metadata?: object;
    transform_data?: object;
    position_data: object;
  }): Promise<DbPhotoSlot> {
    const { data, error } = await supabase
      .from('photo_slots')
      .upsert([slotData], {
        onConflict: 'template_id,slot_index'
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async getTemplatePhotoSlots(templateId: string): Promise<DbPhotoSlot[]> {
    const { data, error } = await supabase
      .from('photo_slots')
      .select('*')
      .eq('template_id', templateId)
      .order('slot_index', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  // Analytics
  async getUserStats(userId: string) {
    const { data: sessions, error: sessionsError } = await supabase
      .from('sessions')
      .select('id, package_type, is_completed, created_at')
      .eq('user_id', userId);

    if (sessionsError) throw sessionsError;

    const { data: templates, error: templatesError } = await supabase
      .from('templates')
      .select('type, created_at')
      .eq('user_id', userId);

    if (templatesError) throw templatesError;

    return {
      totalSessions: sessions?.length || 0,
      completedSessions: sessions?.filter(s => s.is_completed).length || 0,
      totalTemplates: templates?.length || 0,
      packageTypeBreakdown: sessions?.reduce((acc, s) => {
        acc[s.package_type] = (acc[s.package_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
      templateTypeBreakdown: templates?.reduce((acc, t) => {
        acc[t.type] = (acc[t.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {},
    };
  }

  // Custom Template Management
  async getCustomTemplates(printSize?: PrintSize): Promise<DbCustomTemplate[]> {
    let query = supabase
      .from('custom_templates')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (printSize) {
      query = query.eq('print_size', printSize);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getCustomTemplate(templateId: string): Promise<DbCustomTemplate | null> {
    const { data, error } = await supabase
      .from('custom_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  async createCustomTemplate(templateData: {
    name: string;
    description?: string;
    print_size: PrintSize;
    orientation: 'portrait' | 'landscape';
    layout_data: CustomTemplateLayout;
    photo_slots: CustomPhotoSlot[];
    dimensions?: object;
    margins?: object;
    background_color?: string;
    created_by?: string;
    category?: string;
    tags?: string[];
    sort_order?: number;
  }): Promise<DbCustomTemplate> {
    const { data, error } = await supabase
      .from('custom_templates')
      .insert([templateData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async updateCustomTemplate(templateId: string, updates: Partial<DbCustomTemplate>): Promise<DbCustomTemplate> {
    const { data, error } = await supabase
      .from('custom_templates')
      .update(updates)
      .eq('id', templateId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteCustomTemplate(templateId: string): Promise<void> {
    const { error } = await supabase
      .from('custom_templates')
      .delete()
      .eq('id', templateId);

    if (error) throw error;
  }

  async duplicateCustomTemplate(templateId: string, newName: string, userId?: string): Promise<DbCustomTemplate> {
    // Get original template
    const original = await this.getCustomTemplate(templateId);
    if (!original) throw new Error('Template not found');

    // Create duplicate with new name
    const duplicateData = {
      name: newName,
      description: original.description ? `Copy of ${original.description}` : `Copy of ${original.name}`,
      print_size: original.print_size,
      orientation: original.orientation,
      layout_data: original.layout_data as any,
      photo_slots: (original.photo_slots as any) || [],
      dimensions: original.dimensions as any,
      margins: original.margins as any,
      background_color: original.background_color || undefined,
      created_by: userId || original.created_by || undefined,
      category: original.category || undefined,
      tags: (original.tags as any) || [],
      sort_order: original.sort_order || undefined,
    };

    return await this.createCustomTemplate(duplicateData);
  }

  // Template Categories
  async getTemplateCategories(): Promise<DbTemplateCategory[]> {
    const { data, error } = await supabase
      .from('template_categories')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async createTemplateCategory(categoryData: {
    name: string;
    description?: string;
    color?: string;
    icon?: string;
    sort_order?: number;
  }): Promise<DbTemplateCategory> {
    const { data, error } = await supabase
      .from('template_categories')
      .insert([categoryData])
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Admin helpers
  async isUserAdmin(userId: string): Promise<boolean> {
    try {
      const user = await this.getUserByGoogleId(userId);
      if (!user) return false;
      
      // Check environment-based admin list first (for production deployments)
      const adminEmails = process.env.ADMIN_EMAILS?.split(',').map(email => email.trim()) || [];
      if (adminEmails.length > 0 && adminEmails.includes(user.email)) {
        // Auto-grant admin role if not already set
        if (!(user.preferences as any)?.role) {
          await this.grantAdminRole(user.email);
        }
        return true;
      }
      
      // Check database role
      if (!user.preferences) return false;
      const prefs = user.preferences as { role?: string };
      return prefs.role === 'admin' || prefs.role === 'super_admin';
    } catch {
      return false;
    }
  }

  // Helper method to grant admin role
  async grantAdminRole(userEmail: string): Promise<void> {
    try {
      await supabase
        .from('users')
        .update({
          preferences: { role: 'admin' }
        })
        .eq('email', userEmail);
      
      console.log('✅ Auto-granted admin role to:', userEmail);
    } catch (error) {
      console.error('❌ Failed to auto-grant admin role:', error);
    }
  }

  async getTemplatesByCategory(category: string, printSize?: PrintSize): Promise<DbCustomTemplate[]> {
    let query = supabase
      .from('custom_templates')
      .select('*')
      .eq('category', category)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (printSize) {
      query = query.eq('print_size', printSize);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  // App Settings Management
  async getSetting(key: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.value || null;
    } catch (error) {
      console.error(`Error getting setting ${key}:`, error);
      return null;
    }
  }

  async setSetting(key: string, value: string, description?: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert({
          key,
          value,
          description: description || undefined
        });

      if (error) throw error;
    } catch (error) {
      console.error(`Error setting ${key}:`, error);
      throw error;
    }
  }

  async updateSetting(key: string, value: string): Promise<void> {
    return this.setSetting(key, value);
  }

  // Template Cache Management  
  async getCachedTemplate(driveFileId: string) {
    try {
      const { data, error } = await supabase
        .from('template_cache')
        .select('*')
        .eq('drive_file_id', driveFileId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error getting cached template:', error);
      return null;
    }
  }

  async cacheTemplate(templateData: TemplateCacheData) {
    try {
      const { error } = await supabase
        .from('template_cache')
        .upsert(templateData);

      if (error) throw error;
    } catch (error) {
      console.error('Error caching template:', error);
      throw error;
    }
  }

  async clearTemplateCache(): Promise<void> {
    try {
      const { error } = await supabase
        .from('template_cache')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

      if (error) throw error;
    } catch (error) {
      console.error('Error clearing template cache:', error);
      throw error;
    }
  }

  // Test connection
  async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase.from('users').select('count').limit(1);
      return !error;
    } catch {
      return false;
    }
  }
}

export const supabaseService = new SupabaseService();