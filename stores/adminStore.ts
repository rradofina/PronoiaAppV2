import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { supabaseService } from '../services/supabaseService';
import { useAuthStore } from './authStore';
import { CustomTemplate, TemplateCategory, PrintSize } from '../types';

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  google_id: string;
  avatar_url: string | null;
  preferences: any;
  role: 'admin' | 'super_admin';
  created_at: string;
  updated_at: string;
}

interface AdminState {
  // Auth state
  isAdminAuthenticated: boolean;
  adminUser: AdminUser | null;
  isCheckingAdminAuth: boolean;
  
  // Template management
  customTemplates: CustomTemplate[];
  templateCategories: TemplateCategory[];
  selectedTemplate: CustomTemplate | null;
  selectedPrintSize: PrintSize;
  
  // UI state
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  successMessage: string | null;
  
  // Template builder state
  builderMode: 'create' | 'edit' | 'duplicate';
  builderTemplate: Partial<CustomTemplate> | null;
  builderCanvas: {
    zoom: number;
    panX: number;
    panY: number;
    showGrid: boolean;
    snapToGrid: boolean;
  };
}

interface AdminActions {
  // Auth actions
  checkAdminAuth: () => Promise<boolean>;
  clearAdminAuth: () => void;
  
  // Template management actions
  loadCustomTemplates: (printSize?: PrintSize) => Promise<void>;
  loadTemplateCategories: () => Promise<void>;
  createCustomTemplate: (templateData: any) => Promise<void>;
  updateCustomTemplate: (templateId: string, updates: any) => Promise<void>;
  deleteCustomTemplate: (templateId: string) => Promise<void>;
  duplicateCustomTemplate: (templateId: string, newName: string) => Promise<void>;
  
  // Template selection
  setSelectedTemplate: (template: CustomTemplate | null) => void;
  setSelectedPrintSize: (printSize: PrintSize) => void;
  
  // Template builder actions
  initializeBuilder: (mode: 'create' | 'edit' | 'duplicate', template?: CustomTemplate) => void;
  updateBuilderTemplate: (updates: Partial<CustomTemplate>) => void;
  updateBuilderCanvas: (updates: Partial<AdminState['builderCanvas']>) => void;
  resetBuilder: () => void;
  
  // UI actions
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;
  setSuccessMessage: (message: string | null) => void;
  clearMessages: () => void;
}

export const useAdminStore = create<AdminState & AdminActions>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isAdminAuthenticated: false,
    adminUser: null,
    isCheckingAdminAuth: false,
    customTemplates: [],
    templateCategories: [],
    selectedTemplate: null,
    selectedPrintSize: '4R',
    isLoading: false,
    isSaving: false,
    error: null,
    successMessage: null,
    builderMode: 'create',
    builderTemplate: null,
    builderCanvas: {
      zoom: 1,
      panX: 0,
      panY: 0,
      showGrid: true,
      snapToGrid: true,
    },

    // Auth actions
    checkAdminAuth: async () => {
      set({ isCheckingAdminAuth: true });
      
      try {
        const { googleUser } = useAuthStore.getState();
        
        if (!googleUser) {
          set({ isAdminAuthenticated: false, adminUser: null, isCheckingAdminAuth: false });
          return false;
        }

        const isAdmin = await supabaseService.isUserAdmin(googleUser.googleId);
        
        if (isAdmin) {
          const user = await supabaseService.getUserByGoogleId(googleUser.googleId);
          const role = user?.preferences?.role || 'admin';
          
          set({
            isAdminAuthenticated: true,
            adminUser: user ? { ...user, role } : null,
            isCheckingAdminAuth: false,
          });
          return true;
        } else {
          set({
            isAdminAuthenticated: false,
            adminUser: null,
            isCheckingAdminAuth: false,
          });
          return false;
        }
      } catch (error) {
        console.error('Admin auth check failed:', error);
        set({
          isAdminAuthenticated: false,
          adminUser: null,
          isCheckingAdminAuth: false,
          error: 'Failed to verify admin permissions',
        });
        return false;
      }
    },

    clearAdminAuth: () => {
      set({
        isAdminAuthenticated: false,
        adminUser: null,
        customTemplates: [],
        templateCategories: [],
        selectedTemplate: null,
      });
    },

    // Template management actions
    loadCustomTemplates: async (printSize?: PrintSize) => {
      set({ isLoading: true, error: null });
      
      try {
        const templates = await supabaseService.getCustomTemplates(printSize);
        
        // Convert DB templates to app format
        const appTemplates: CustomTemplate[] = templates.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description || '',
          print_size: template.print_size as PrintSize,
          orientation: template.orientation as 'portrait' | 'landscape',
          layout_data: template.layout_data as any,
          photo_slots: template.photo_slots as any,
          dimensions: template.dimensions as any,
          margins: template.margins as any,
          background_color: template.background_color || '#FFFFFF',
          created_by: template.created_by,
          category: template.category,
          tags: template.tags || [],
          is_active: template.is_active,
          is_default: template.is_default,
          sort_order: template.sort_order,
          created_at: new Date(template.created_at),
          updated_at: new Date(template.updated_at),
        }));

        set({ customTemplates: appTemplates, isLoading: false });
      } catch (error) {
        console.error('Failed to load custom templates:', error);
        set({ error: 'Failed to load templates', isLoading: false });
      }
    },

    loadTemplateCategories: async () => {
      try {
        const categories = await supabaseService.getTemplateCategories();
        const appCategories: TemplateCategory[] = categories.map(cat => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          color: cat.color,
          icon: cat.icon,
          sort_order: cat.sort_order,
          created_at: new Date(cat.created_at),
        }));
        
        set({ templateCategories: appCategories });
      } catch (error) {
        console.error('Failed to load template categories:', error);
        set({ error: 'Failed to load template categories' });
      }
    },

    createCustomTemplate: async (templateData: any) => {
      set({ isSaving: true, error: null });
      
      try {
        const { adminUser } = get();
        const newTemplate = await supabaseService.createCustomTemplate({
          ...templateData,
          created_by: adminUser?.id,
        });
        
        // Reload templates to get the new one
        await get().loadCustomTemplates(get().selectedPrintSize);
        
        set({
          isSaving: false,
          successMessage: 'Template created successfully',
        });
      } catch (error) {
        console.error('Failed to create template:', error);
        set({
          isSaving: false,
          error: 'Failed to create template',
        });
      }
    },

    updateCustomTemplate: async (templateId: string, updates: any) => {
      set({ isSaving: true, error: null });
      
      try {
        await supabaseService.updateCustomTemplate(templateId, updates);
        
        // Update local state
        set(state => ({
          customTemplates: state.customTemplates.map(template =>
            template.id === templateId ? { ...template, ...updates } : template
          ),
          isSaving: false,
          successMessage: 'Template updated successfully',
        }));
      } catch (error) {
        console.error('Failed to update template:', error);
        set({
          isSaving: false,
          error: 'Failed to update template',
        });
      }
    },

    deleteCustomTemplate: async (templateId: string) => {
      set({ isLoading: true, error: null });
      
      try {
        await supabaseService.deleteCustomTemplate(templateId);
        
        set(state => ({
          customTemplates: state.customTemplates.filter(t => t.id !== templateId),
          selectedTemplate: state.selectedTemplate?.id === templateId ? null : state.selectedTemplate,
          isLoading: false,
          successMessage: 'Template deleted successfully',
        }));
      } catch (error) {
        console.error('Failed to delete template:', error);
        set({
          isLoading: false,
          error: 'Failed to delete template',
        });
      }
    },

    duplicateCustomTemplate: async (templateId: string, newName: string) => {
      set({ isSaving: true, error: null });
      
      try {
        const { adminUser } = get();
        await supabaseService.duplicateCustomTemplate(templateId, newName, adminUser?.id);
        
        // Reload templates to get the new duplicate
        await get().loadCustomTemplates(get().selectedPrintSize);
        
        set({
          isSaving: false,
          successMessage: 'Template duplicated successfully',
        });
      } catch (error) {
        console.error('Failed to duplicate template:', error);
        set({
          isSaving: false,
          error: 'Failed to duplicate template',
        });
      }
    },

    // Template selection
    setSelectedTemplate: (template: CustomTemplate | null) => {
      set({ selectedTemplate: template });
    },

    setSelectedPrintSize: (printSize: PrintSize) => {
      set({ selectedPrintSize: printSize });
      // Auto-load templates for the new print size
      get().loadCustomTemplates(printSize);
    },

    // Template builder actions
    initializeBuilder: (mode: 'create' | 'edit' | 'duplicate', template?: CustomTemplate) => {
      const { selectedPrintSize } = get();
      
      let builderTemplate: Partial<CustomTemplate>;
      
      if (mode === 'create') {
        builderTemplate = {
          name: '',
          description: '',
          print_size: selectedPrintSize,
          orientation: 'portrait',
          layout_data: { type: 'custom', padding: 0, spacing: 0, arrangement: 'custom' },
          photo_slots: [],
          dimensions: { width: 1200, height: 1800, dpi: 300 },
          margins: { top: 0, right: 0, bottom: 0, left: 0 },
          background_color: '#FFFFFF',
          category: 'Custom',
          tags: [],
          is_active: true,
          is_default: false,
          sort_order: 0,
        };
      } else if (template) {
        builderTemplate = mode === 'duplicate' 
          ? { ...template, id: undefined, name: `${template.name} (Copy)` }
          : { ...template };
      } else {
        builderTemplate = {};
      }

      set({
        builderMode: mode,
        builderTemplate,
        builderCanvas: {
          zoom: 1,
          panX: 0,
          panY: 0,
          showGrid: true,
          snapToGrid: true,
        },
      });
    },

    updateBuilderTemplate: (updates: Partial<CustomTemplate>) => {
      set(state => ({
        builderTemplate: state.builderTemplate ? { ...state.builderTemplate, ...updates } : updates,
      }));
    },

    updateBuilderCanvas: (updates: Partial<AdminState['builderCanvas']>) => {
      set(state => ({
        builderCanvas: { ...state.builderCanvas, ...updates },
      }));
    },

    resetBuilder: () => {
      set({
        builderMode: 'create',
        builderTemplate: null,
        builderCanvas: {
          zoom: 1,
          panX: 0,
          panY: 0,
          showGrid: true,
          snapToGrid: true,
        },
      });
    },

    // UI actions
    setLoading: (loading: boolean) => set({ isLoading: loading }),
    setSaving: (saving: boolean) => set({ isSaving: saving }),
    setError: (error: string | null) => set({ error }),
    setSuccessMessage: (message: string | null) => set({ successMessage: message }),
    clearMessages: () => set({ error: null, successMessage: null }),
  }))
);

// Initialize admin auth check when auth state changes
useAuthStore.subscribe(
  (state) => state.googleUser,
  (googleUser) => {
    if (googleUser) {
      useAdminStore.getState().checkAdminAuth();
    } else {
      useAdminStore.getState().clearAdminAuth();
    }
  }
);