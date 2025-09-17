export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      organization_users: {
        Row: {
          created_at: string | null
          id: string
          invited_at: string | null
          invited_by: string | null
          joined_at: string | null
          organization_id: string | null
          role: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string | null
          role?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          joined_at?: string | null
          organization_id?: string | null
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_users_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          branding: Json | null
          created_at: string | null
          google_drive_tokens: Json | null
          id: string
          name: string
          settings: Json | null
          slug: string
          subscription_plan: string | null
          subscription_status: string | null
          trial_ends_at: string | null
          updated_at: string | null
          usage_current_month: number | null
          usage_limit: number | null
        }
        Insert: {
          branding?: Json | null
          created_at?: string | null
          google_drive_tokens?: Json | null
          id?: string
          name: string
          settings?: Json | null
          slug: string
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          usage_current_month?: number | null
          usage_limit?: number | null
        }
        Update: {
          branding?: Json | null
          created_at?: string | null
          google_drive_tokens?: Json | null
          id?: string
          name?: string
          settings?: Json | null
          slug?: string
          subscription_plan?: string | null
          subscription_status?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          usage_current_month?: number | null
          usage_limit?: number | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          client_folder_path: string | null
          client_name: string | null
          created_at: string | null
          created_by: string | null
          exports: Json | null
          id: string
          name: string
          organization_id: string
          photos: Json | null
          session_date: string | null
          status: string | null
          template_ids: string[] | null
          updated_at: string | null
        }
        Insert: {
          client_folder_path?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          exports?: Json | null
          id?: string
          name: string
          organization_id: string
          photos?: Json | null
          session_date?: string | null
          status?: string | null
          template_ids?: string[] | null
          updated_at?: string | null
        }
        Update: {
          client_folder_path?: string | null
          client_name?: string | null
          created_at?: string | null
          created_by?: string | null
          exports?: Json | null
          id?: string
          name?: string
          organization_id?: string
          photos?: Json | null
          session_date?: string | null
          status?: string | null
          template_ids?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          dimensions: Json
          id: string
          is_active: boolean | null
          name: string
          organization_id: string
          slots: Json
          thumbnail_url: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          dimensions: Json
          id?: string
          is_active?: boolean | null
          name: string
          organization_id: string
          slots?: Json
          thumbnail_url?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          dimensions?: Json
          id?: string
          is_active?: boolean | null
          name?: string
          organization_id?: string
          slots?: Json
          thumbnail_url?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

// Type aliases for easier usage
export type Organization = Tables<'organizations'>
export type OrganizationUser = Tables<'organization_users'>
export type UserProfile = Tables<'user_profiles'>
export type Template = Tables<'templates'>
export type Session = Tables<'sessions'>

export type OrganizationInsert = TablesInsert<'organizations'>
export type OrganizationUserInsert = TablesInsert<'organization_users'>
export type UserProfileInsert = TablesInsert<'user_profiles'>
export type TemplateInsert = TablesInsert<'templates'>
export type SessionInsert = TablesInsert<'sessions'>

export type OrganizationUpdate = TablesUpdate<'organizations'>
export type OrganizationUserUpdate = TablesUpdate<'organization_users'>
export type UserProfileUpdate = TablesUpdate<'user_profiles'>
export type TemplateUpdate = TablesUpdate<'templates'>
export type SessionUpdate = TablesUpdate<'sessions'>