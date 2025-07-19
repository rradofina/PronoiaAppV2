import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { GoogleAuth } from '../types';
import { supabaseService } from '../services/supabaseService';

interface AuthStore {
  googleAuth: GoogleAuth;
  isGapiLoaded: boolean;
  supabaseUser: any | null;
  
  setGoogleAuth: (auth: GoogleAuth) => void;
  setIsGapiLoaded: (loaded: boolean) => void;
  setSupabaseUser: (user: any | null) => void;
  syncWithSupabase: (googleUserInfo?: any) => Promise<void>;
  clearAuth: () => void;
}

const useAuthStore = create<AuthStore>()(
  devtools(
    persist(
      (set, get) => ({
        googleAuth: { isSignedIn: false, userEmail: null },
        isGapiLoaded: false,
        supabaseUser: null,
        
        setGoogleAuth: (auth) => set({ googleAuth: auth }),
        setIsGapiLoaded: (loaded) => set({ isGapiLoaded: loaded }),
        setSupabaseUser: (user) => set({ supabaseUser: user }),
        
        syncWithSupabase: async (googleUserInfo) => {
          try {
            const { googleAuth } = get();
            
            if (!googleAuth.isSignedIn || !googleUserInfo) {
              console.log('Not syncing - not signed in or no user info');
              return;
            }

            // Create or update user in Supabase
            const userData = {
              email: googleUserInfo.email || googleAuth.userEmail || '',
              name: googleUserInfo.name || null,
              google_id: googleUserInfo.id || googleUserInfo.sub || '',
              avatar_url: googleUserInfo.picture || null,
            };

            const supabaseUser = await supabaseService.createOrUpdateUser(userData);
            set({ supabaseUser });
            
            console.log('✅ Synced with Supabase:', supabaseUser.email);
          } catch (error) {
            console.error('❌ Failed to sync with Supabase:', error);
            // Don't throw - keep the app working even if Supabase fails
          }
        },
        
        clearAuth: () => set({ 
          googleAuth: { isSignedIn: false, userEmail: null },
          supabaseUser: null,
        }),
      }),
      {
        name: 'auth-storage',
        partialize: (state) => ({
          googleAuth: state.googleAuth,
          supabaseUser: state.supabaseUser,
        }),
      }
    )
  )
);

export default useAuthStore;