import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { UIState, LoadingState, PhotoSlot, Screen } from '../types';

interface UIStore extends UIState, LoadingState {
  currentScreen: Screen;
  error: string | null;
  eventLog: string[];
  
  setCurrentScreen: (screen: Screen) => void;
  setSelectedPhotoSlot: (slot: PhotoSlot | null) => void;
  setViewMode: (mode: 'grid' | 'list') => void;
  setSortBy: (sortBy: 'name' | 'date' | 'size') => void;
  setSortOrder: (order: 'asc' | 'desc') => void;
  togglePhotoSelector: () => void;
  toggleTemplatePreview: () => void;
  setLoading: (loading: boolean, message?: string, progress?: number) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  addEvent: (event: string) => void;
  clearEvents: () => void;
}

const useUIStore = create<UIStore>()(
  devtools((set, get) => ({
    // Screen State
    currentScreen: 'drive-setup',
    
    // UI State
    showPhotoSelector: false,
    showTemplatePreview: false,
    showProgressBar: false,
    selectedPhotoSlot: null,
    viewMode: 'grid',
    sortBy: 'name',
    sortOrder: 'asc',
    
    // Loading State
    isLoading: false,
    message: undefined,
    progress: undefined,
    
    // Error State
    error: null,
    
    // Event Log
    eventLog: [],
    
    setCurrentScreen: (screen) => set({ currentScreen: screen }),
    setSelectedPhotoSlot: (slot) => set({ selectedPhotoSlot: slot }),
    setViewMode: (mode) => set({ viewMode: mode }),
    setSortBy: (sortBy) => set({ sortBy }),
    setSortOrder: (order) => set({ sortOrder: order }),
    
    togglePhotoSelector: () => set((state) => ({
      showPhotoSelector: !state.showPhotoSelector,
    })),
    
    toggleTemplatePreview: () => set((state) => ({
      showTemplatePreview: !state.showTemplatePreview,
    })),
    
    setLoading: (isLoading, message, progress) => set({
      isLoading,
      message,
      progress,
    }),
    
    setError: (error) => set({ error }),
    clearError: () => set({ error: null }),
    
    addEvent: (event) => set((state) => ({ 
      eventLog: [...state.eventLog, `${new Date().toISOString()}: ${event}`] 
    })),
    
    clearEvents: () => set({ eventLog: [] }),
  }))
);

export default useUIStore;