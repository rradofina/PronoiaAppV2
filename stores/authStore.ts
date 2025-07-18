import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { GoogleAuth } from '../types';

interface AuthStore {
  googleAuth: GoogleAuth;
  isGapiLoaded: boolean;
  
  setGoogleAuth: (auth: GoogleAuth) => void;
  setIsGapiLoaded: (loaded: boolean) => void;
  clearAuth: () => void;
}

const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set) => ({
        googleAuth: { isSignedIn: false, userEmail: null },
        isGapiLoaded: false,
        
        setGoogleAuth: (auth) => set({ googleAuth: auth }),
        setIsGapiLoaded: (loaded) => set({ isGapiLoaded: loaded }),
        clearAuth: () => set({ 
          googleAuth: { isSignedIn: false, userEmail: null } 
        }),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          googleAuth: state.googleAuth,
        }),
      }
    )
  )
);

export default useAuthStore;