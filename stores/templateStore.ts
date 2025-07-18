import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { Template, TemplateSlot, Photo, TemplateType, TemplateTypeInfo } from '../types';

interface TemplateStore {
  templates: Template[];
  selectedTemplate: Template | null;
  templateSlots: TemplateSlot[];
  selectedSlot: TemplateSlot | null;
  templateCounts: Record<string, number>;
  templateTypes: TemplateTypeInfo[];
  
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
  selectPhotoForSlot: (templateId: string, slotId: string, photo: Photo) => void;
  removePhotoFromSlot: (templateId: string, slotId: string) => void;
  isTemplateComplete: (templateId: string) => boolean;
  getAllTemplatesComplete: () => boolean;
  clearTemplates: () => void;
}

const useTemplateStore = create<TemplateStore>()(
  devtools((set, get) => ({
    templates: [],
    selectedTemplate: null,
    templateSlots: [],
    selectedSlot: null,
    templateCounts: {
      solo: 0,
      collage: 0,
      photocard: 0,
      photostrip: 0,
    },
    templateTypes: [
      {
        id: 'solo',
        name: 'Solo Print',
        description: 'Single photo with white border',
        icon: '🖼️',
        preview: 'One large photo with elegant white border',
        slots: 1
      },
      {
        id: 'collage',
        name: 'Collage Print',
        description: '4 photos in 2x2 grid layout',
        icon: '🏁',
        preview: 'Four photos arranged in a perfect grid',
        slots: 4
      },
      {
        id: 'photocard',
        name: 'Photocard Print',
        description: '4 photos edge-to-edge, no borders',
        icon: '🎴',
        preview: 'Four photos seamlessly connected without borders',
        slots: 4
      },
      {
        id: 'photostrip',
        name: 'Photo Strip Print',
        description: '6 photos in 3 rows of 2',
        icon: '📸',
        preview: 'Six photos arranged in three horizontal rows',
        slots: 6
      }
    ],
    
    setTemplates: (templates) => set({ templates }),
    
    addTemplate: (templateType) => {
      const state = get();
      const id = `template_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();
      
      const template: Template = {
        id,
        type: templateType,
        name: `${templateType.charAt(0).toUpperCase() + templateType.slice(1)} Template`,
        photoSlots: [],
        dimensions: {
          width: 1200,
          height: 1800,
        },
        layout: {
          type: templateType,
          slots: {
            count: templateType === 'solo' ? 1 : templateType === 'collage' ? 4 : templateType === 'photostrip' ? 6 : 1,
            arrangement: templateType === 'collage' ? 'grid' : templateType === 'photostrip' ? 'strip' : 'single',
            spacing: templateType === 'collage' ? 20 : templateType === 'photostrip' ? 15 : 0,
            padding: templateType === 'photocard' ? 0 : templateType === 'solo' ? 60 : templateType === 'collage' ? 40 : 30,
          },
        },
        createdAt: now,
        updatedAt: now,
      };
      
      set((state) => ({
        templates: [...state.templates, template],
      }));
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
      templateCounts: {
        solo: 0,
        collage: 0,
        photocard: 0,
        photostrip: 0,
      },
    }),
  }))
);

export default useTemplateStore;