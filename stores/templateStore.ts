import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Template, TemplateSlot, Photo, TemplateType, TemplateTypeInfo } from '../types';
import { PngTemplate } from '../services/pngTemplateService';
import { templateConfigService } from '../services/templateConfigService';

interface TemplateStore {
  templates: Template[];
  selectedTemplate: Template | null;
  templateSlots: TemplateSlot[];
  selectedSlot: TemplateSlot | null;
  templateCounts: Record<string, number>;
  templateTypes: TemplateTypeInfo[];
  loadingTemplateTypes: boolean;
  
  // PNG Template Support
  pngTemplates: PngTemplate[];
  selectedPngTemplate: PngTemplate | null;
  pngTemplatePhotos: Record<string, Photo>; // holeId -> Photo mapping
  
  setTemplates: (templates: Template[]) => void;
  addTemplate: (templateType: TemplateType) => void;
  removeTemplate: (templateId: string) => void;
  selectTemplate: (template: Template | null) => void;
  updateTemplate: (templateId: string, updates: Partial<Template>) => void;
  setTemplateSlots: (slots: TemplateSlot[]) => void;
  setSelectedSlot: (slot: TemplateSlot | null) => void;
  setTemplateCounts: (counts: Record<string, number>) => void;
  handleTemplateCountChange: (templateId: string, change: number, customLimit?: number) => void;
  getTotalTemplateCount: () => number;
  loadTemplateTypes: () => Promise<void>;
  refreshTemplateTypes: () => Promise<void>;
  selectPhotoForSlot: (templateId: string, slotId: string, photo: Photo) => void;
  removePhotoFromSlot: (templateId: string, slotId: string) => void;
  isTemplateComplete: (templateId: string) => boolean;
  getAllTemplatesComplete: () => boolean;
  clearTemplates: () => void;
  
  // PNG Template Actions
  setPngTemplates: (templates: PngTemplate[]) => void;
  selectPngTemplate: (template: PngTemplate | null) => void;
  assignPhotoToHole: (holeId: string, photo: Photo) => void;
  removePhotoFromHole: (holeId: string) => void;
  isPngTemplateComplete: () => boolean;
  clearPngTemplate: () => void;
}

const useTemplateStore = create<TemplateStore>()(
  devtools((set, get) => ({
    templates: [],
    selectedTemplate: null,
    templateSlots: [],
    selectedSlot: null,
    templateCounts: {},
    loadingTemplateTypes: false,
    
    // PNG Template Initial State
    pngTemplates: [],
    selectedPngTemplate: null,
    pngTemplatePhotos: {},
    templateTypes: [],
    
    setTemplates: (templates) => set({ templates }),
    
    addTemplate: async (templateType) => {
      try {
        const state = get();
        const id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const now = new Date();
        
        // Get PURE database configuration - NO FALLBACKS
        const dimensions = await templateConfigService.getTemplateDimensions(templateType, '4R');
        const layout = await templateConfigService.getTemplateLayout(templateType);
        
        const template: Template = {
          id,
          type: templateType,
          name: `${templateType.charAt(0).toUpperCase() + templateType.slice(1)} Template`,
          photoSlots: [],
          dimensions,
          layout: {
            type: templateType,
            slots: {
              count: layout.slots,
              arrangement: layout.arrangement,
              spacing: layout.spacing,
              padding: layout.padding,
            },
          },
          createdAt: now,
          updatedAt: now,
        };
        
        set((state) => ({
          templates: [...state.templates, template],
        }));
      } catch (error) {
        console.error(`❌ Failed to add template '${templateType}' - not found in database:`, error);
        throw error;
      }
    },
    
    removeTemplate: (templateId) => set((state) => ({
      templates: state.templates.filter(t => t.id !== templateId),
      selectedTemplate: state.selectedTemplate?.id === templateId ? null : state.selectedTemplate,
    })),
    
    selectTemplate: (template) => set({ selectedTemplate: template }),
    
    updateTemplate: (templateId, updates) => set((state) => ({
      templates: state.templates.map(t => 
        t.id === templateId ? { ...t, ...updates, updatedAt: new Date() } : t
      ),
    })),
    
    setTemplateSlots: (slots) => set({ templateSlots: slots }),
    setSelectedSlot: (slot) => set({ selectedSlot: slot }),
    setTemplateCounts: (counts) => set({ templateCounts: counts }),
    
    handleTemplateCountChange: (templateId, change, customLimit) => {
      const state = get();
      const currentCount = state.templateCounts[templateId] || 0;
      const newCount = Math.max(0, currentCount + change);
      const totalCount = Object.values(state.templateCounts).reduce((sum, count) => sum + count, 0) - currentCount + newCount;
      const limit = customLimit !== undefined ? customLimit : 10; // Default limit
      
      if (totalCount <= limit) {
        set({
          templateCounts: {
            ...state.templateCounts,
            [templateId]: newCount,
          },
        });
      }
    },
    
    getTotalTemplateCount: () => {
      const state = get();
      return Object.values(state.templateCounts).reduce((sum, count) => sum + count, 0);
    },
    
    selectPhotoForSlot: (templateId, slotId, photo) => {
      set((state) => ({
        templateSlots: state.templateSlots.map(slot =>
          slot.id === slotId ? { ...slot, photoId: photo.id } : slot
        ),
      }));
    },
    
    removePhotoFromSlot: (templateId, slotId) => {
      set((state) => ({
        templateSlots: state.templateSlots.map(slot =>
          slot.id === slotId ? { ...slot, photoId: undefined } : slot
        ),
      }));
    },
    
    isTemplateComplete: (templateId) => {
      const state = get();
      const template = state.templates.find(t => t.id === templateId);
      if (!template) return false;
      return template.photoSlots.every(slot => slot.photo !== undefined);
    },
    
    getAllTemplatesComplete: () => {
      const state = get();
      return state.templates.every(template => 
        template.photoSlots.every(slot => slot.photo !== undefined)
      );
    },
    
    clearTemplates: () => set({
      templates: [],
      selectedTemplate: null,
      templateSlots: [],
      selectedSlot: null,
      templateCounts: {},
    }),
    
    loadTemplateTypes: async () => {
      set({ loadingTemplateTypes: true });
      try {
        const templateTypeInfos = await templateConfigService.getTemplateTypeInfos();
        
        // Initialize template counts for all available types
        const initialCounts: Record<string, number> = {};
        templateTypeInfos.forEach(type => {
          initialCounts[type.id] = 0;
        });
        
        set({
          templateTypes: templateTypeInfos,
          templateCounts: initialCounts,
          loadingTemplateTypes: false
        });
      } catch (error) {
        console.error('Failed to load template types:', error);
        set({ loadingTemplateTypes: false });
      }
    },
    
    refreshTemplateTypes: async () => {
      templateConfigService.clearCache();
      await get().loadTemplateTypes();
    },
    
    // PNG Template Actions
    setPngTemplates: (templates) => set({ pngTemplates: templates }),
    
    selectPngTemplate: (template) => set({ 
      selectedPngTemplate: template,
      pngTemplatePhotos: {} // Clear photos when switching templates
    }),
    
    assignPhotoToHole: (holeId, photo) => set((state) => ({
      pngTemplatePhotos: {
        ...state.pngTemplatePhotos,
        [holeId]: photo
      }
    })),
    
    removePhotoFromHole: (holeId) => set((state) => {
      const newPhotos = { ...state.pngTemplatePhotos };
      delete newPhotos[holeId];
      return { pngTemplatePhotos: newPhotos };
    }),
    
    isPngTemplateComplete: () => {
      const state = get();
      if (!state.selectedPngTemplate) return false;
      
      // Check if all holes have photos assigned
      return state.selectedPngTemplate.holes.every(hole => 
        state.pngTemplatePhotos[hole.id] !== undefined
      );
    },
    
    clearPngTemplate: () => set({
      selectedPngTemplate: null,
      pngTemplatePhotos: {}
    }),
  }))
);

export default useTemplateStore;