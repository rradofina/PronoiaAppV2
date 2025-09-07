import { supabase } from '../lib/supabase/client';

export interface User {
  id: string;
  email: string;
  preferences: {
    role?: 'admin' | 'super_admin';
    [key: string]: any;
  } | null;
  created_at: string;
}

export interface SQLQueryResult {
  data: any[] | null;
  error: string | null;
  rowCount: number;
}

class AdminServiceImpl {
  /**
   * Get all users from the database
   */
  async getAllUsers(): Promise<User[]> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, email, preferences, created_at')
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch users: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      console.error('❌ Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Update user role
   */
  async updateUserRole(userId: string, role: 'admin' | 'super_admin' | null): Promise<void> {
    try {
      if (process.env.NODE_ENV === 'development') console.log(`🔄 Updating user role: ${userId} to ${role}`);

      const updates: any = {
        preferences: role 
          ? { role } 
          : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to update user role: ${error.message}`);
      }

      if (process.env.NODE_ENV === 'development') console.log(`✅ User role updated successfully`);
    } catch (error) {
      console.error(`❌ Error updating user role:`, error);
      throw error;
    }
  }

  /**
   * Update user role by email
   */
  async updateUserRoleByEmail(email: string, role: 'admin' | 'super_admin' | null): Promise<void> {
    // Validate email - prevent updating placeholder emails
    if (!email || email === 'Authenticated' || email.trim() === '') {
      throw new Error('Cannot update role for invalid email address.');
    }
    
    try {
      if (process.env.NODE_ENV === 'development') console.log(`🔄 Updating user role by email: ${email} to ${role}`);

      const updates: any = {
        preferences: role 
          ? { role } 
          : null,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('email', email);

      if (error) {
        throw new Error(`Failed to update user role: ${error.message}`);
      }

      if (process.env.NODE_ENV === 'development') console.log(`✅ User role updated successfully`);
    } catch (error) {
      console.error(`❌ Error updating user role by email:`, error);
      throw error;
    }
  }

  /**
   * Check if current user is admin
   */
  async isCurrentUserAdmin(): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return false;

      const { data, error } = await supabase
        .from('users')
        .select('preferences')
        .eq('email', user.email)
        .single();

      if (error) return false;

      const role = data?.preferences?.role;
      return role === 'admin' || role === 'super_admin';
    } catch (error) {
      console.error('❌ Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Execute SQL query (for convenience) - Simplified version
   */
  async executeSQL(query: string): Promise<SQLQueryResult> {
    // For now, return a message that SQL execution is not available
    // This can be expanded later with proper Supabase RPC functions
    return {
      data: null,
      error: "SQL execution not available yet. Use the user management features above or run queries in Supabase dashboard.",
      rowCount: 0
    };
  }

  /**
   * Create a new user
   */
  async createUser(userData: {
    email: string;
    name?: string;
    role?: 'admin' | 'super_admin' | null;
  }): Promise<User> {
    // Validate email - prevent invalid emails
    if (!userData.email || userData.email === 'Authenticated' || userData.email.trim() === '') {
      throw new Error('Invalid email address.');
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', userData.email)
      .single();

    if (existingUser) {
      throw new Error(`User with email ${userData.email} already exists.`);
    }

    try {
      if (process.env.NODE_ENV === 'development') console.log(`🔄 Creating user: ${userData.email}`);

      const newUser = {
        email: userData.email,
        name: userData.name || null,
        google_id: `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Temporary ID
        avatar_url: null,
        preferences: userData.role ? { role: userData.role } : null,
      };

      const { data, error } = await supabase
        .from('users')
        .insert([newUser])
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create user: ${error.message}`);
      }

      if (process.env.NODE_ENV === 'development') console.log(`✅ User created successfully:`, data);
      return data as User;
    } catch (error) {
      console.error('❌ Error creating user:', error);
      throw error;
    }
  }


  /**
   * Get current user info
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) return null;

      const { data, error } = await supabase
        .from('users')
        .select('id, email, preferences, created_at')
        .eq('email', user.email)
        .single();

      if (error) {
        throw new Error(`Failed to fetch current user: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('❌ Error fetching current user:', error);
      return null;
    }
  }
}

export const adminService = new AdminServiceImpl();