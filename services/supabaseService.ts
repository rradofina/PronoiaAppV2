import { supabase } from '../lib/supabase/client';
import { Database } from '../lib/supabase/types';
import { Session, Template, PhotoSlot } from '../types';

type DbUser = Database['public']['Tables']['users']['Row'];
type DbSession = Database['public']['Tables']['sessions']['Row'];
type DbTemplate = Database['public']['Tables']['templates']['Row'];
type DbPhotoSlot = Database['public']['Tables']['photo_slots']['Row'];

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
    package_type: 'A' | 'B' | 'C' | 'D';
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
      packageType: data.package_type as any,
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