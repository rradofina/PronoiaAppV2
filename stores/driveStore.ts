import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { DriveFolder, Photo, Screen } from '../types';
import { STORAGE_KEYS } from '../utils/constants';

interface DriveStore {
  currentScreen: Screen;
  driveFolders: DriveFolder[];
  selectedMainFolder: DriveFolder | null;
  clientFolders: DriveFolder[];
  selectedClientFolder: DriveFolder | null;
  mainSessionsFolder: { id: string; name: string } | null;
  photos: Photo[];
  
  setCurrentScreen: (screen: Screen) => void;
  setDriveFolders: (folders: DriveFolder[]) => void;
  setSelectedMainFolder: (folder: DriveFolder | null) => void;
  setClientFolders: (folders: DriveFolder[]) => void;
  setSelectedClientFolder: (folder: DriveFolder | null) => void;
  setMainSessionsFolder: (folder: { id: string; name: string } | null) => void;
  setPhotos: (photos: Photo[]) => void;
  addPhoto: (photo: Photo) => void;
  removePhoto: (photoId: string) => void;
  clearDriveData: () => void;
}

const useDriveStore = create<DriveStore>()(
  devtools(
    persist(
      (set, get) => ({
        currentScreen: 'drive-setup',
        driveFolders: [],
        selectedMainFolder: null,
        clientFolders: [],
        selectedClientFolder: null,
        mainSessionsFolder: null,
        photos: [],
        
        setCurrentScreen: (screen) => set({ currentScreen: screen }),
        setDriveFolders: (folders) => set({ driveFolders: folders }),
        setSelectedMainFolder: (folder) => set({ selectedMainFolder: folder }),
        setClientFolders: (folders) => set({ clientFolders: folders }),
        setSelectedClientFolder: (folder) => set({ selectedClientFolder: folder }),
        
        setMainSessionsFolder: (folder) => {
          set({ mainSessionsFolder: folder });
          if (folder) {
            try {
              localStorage.setItem(STORAGE_KEYS.MAIN_SESSIONS_FOLDER, JSON.stringify(folder));
            } catch (error) {
              console.error('Failed to save main sessions folder:', error);
            }
          } else {
            try {
              localStorage.removeItem(STORAGE_KEYS.MAIN_SESSIONS_FOLDER);
            } catch (error) {
              console.error('Failed to remove main sessions folder:', error);
            }
          }
        },
        
        setPhotos: (photos) => set({ photos }),
        addPhoto: (photo) => set((state) => ({
          photos: [...state.photos, photo],
        })),
        removePhoto: (photoId) => set((state) => ({
          photos: state.photos.filter(p => p.id !== photoId),
        })),
        
        clearDriveData: () => set({
          currentScreen: 'drive-setup',
          driveFolders: [],
          selectedMainFolder: null,
          clientFolders: [],
          selectedClientFolder: null,
          photos: [],
        }),
      }),
      {
        name: 'drive-storage',
        partialize: (state) => ({
          mainSessionsFolder: state.mainSessionsFolder,
          currentScreen: state.currentScreen,
        }),
      }
    )
  )
);

export default useDriveStore;