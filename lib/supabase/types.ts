export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          google_id: string;
          avatar_url: string | null;
          preferences: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          google_id: string;
          avatar_url?: string | null;
          preferences?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          google_id?: string;
          avatar_url?: string | null;
          preferences?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      sessions: {
        Row: {
          id: string;
          user_id: string;
          client_name: string;
          package_type: string;
          google_drive_folder_id: string;
          output_folder_id: string | null;
          max_templates: number;
          used_templates: number;
          is_completed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_name: string;
          package_type: string;
          google_drive_folder_id: string;
          output_folder_id?: string | null;
          max_templates: number;
          used_templates?: number;
          is_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          client_name?: string;
          package_type?: string;
          google_drive_folder_id?: string;
          output_folder_id?: string | null;
          max_templates?: number;
          used_templates?: number;
          is_completed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      templates: {
        Row: {
          id: string;
          session_id: string;
          user_id: string;
          type: string; // Dynamic template types
          name: string;
          dimensions: Json;
          layout_config: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          user_id: string;
          type: string; // Dynamic template types
          name: string;
          dimensions: Json;
          layout_config: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          user_id?: string;
          type?: string; // Dynamic template types
          name?: string;
          dimensions?: Json;
          layout_config?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      photo_slots: {
        Row: {
          id: string;
          template_id: string;
          slot_index: number;
          photo_google_id: string | null;
          photo_metadata: Json | null;
          transform_data: Json | null;
          position_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          slot_index: number;
          photo_google_id?: string | null;
          photo_metadata?: Json | null;
          transform_data?: Json | null;
          position_data: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          slot_index?: number;
          photo_google_id?: string | null;
          photo_metadata?: Json | null;
          transform_data?: Json | null;
          position_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
      };
      custom_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          print_size: string;
          orientation: 'portrait' | 'landscape';
          layout_data: Json;
          photo_slots: Json;
          dimensions: Json;
          margins: Json | null;
          background_color: string | null;
          created_by: string | null;
          category: string | null;
          tags: string[] | null;
          is_active: boolean;
          is_default: boolean;
          sort_order: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          print_size?: string;
          orientation?: 'portrait' | 'landscape';
          layout_data?: Json;
          photo_slots?: Json;
          dimensions?: Json;
          margins?: Json | null;
          background_color?: string | null;
          created_by?: string | null;
          category?: string | null;
          tags?: string[] | null;
          is_active?: boolean;
          is_default?: boolean;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          print_size?: string;
          orientation?: 'portrait' | 'landscape';
          layout_data?: Json;
          photo_slots?: Json;
          dimensions?: Json;
          margins?: Json | null;
          background_color?: string | null;
          created_by?: string | null;
          category?: string | null;
          tags?: string[] | null;
          is_active?: boolean;
          is_default?: boolean;
          sort_order?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      template_categories: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          color: string | null;
          icon: string | null;
          sort_order: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          sort_order?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          color?: string | null;
          icon?: string | null;
          sort_order?: number | null;
          created_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];