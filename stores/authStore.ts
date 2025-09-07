import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { GoogleAuth, GoogleUserInfo, SupabaseUser } from '../types';
import { supabaseService } from '../services/supabaseService';

interface AuthStore {
  googleAuth: GoogleAuth;
  isGapiLoaded: boolean;
  supabaseUser: SupabaseUser | null;
  
  setGoogleAuth: (auth: GoogleAuth) => void;
  setIsGapiLoaded: (loaded: boolean) => void;
  setSupabaseUser: (user: SupabaseUser | null) => void;
  syncWithSupabase: (googleUserInfo?: GoogleUserInfo) => Promise<void>;
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
              if (process.env.NODE_ENV === 'development') console.log('🔄 Not syncing - not signed in or no user info');
              return;
            }

            if (process.env.NODE_ENV === 'development') console.log('🔄 Syncing user with Supabase:', googleUserInfo.email);

            // Create or update user in Supabase
            const userData = {
              email: googleUserInfo.email || googleAuth.userEmail || '',
              name: googleUserInfo.name || undefined,
              google_id: googleUserInfo.id || googleUserInfo.sub || '',
              avatar_url: googleUserInfo.picture || undefined,
            };

            const supabaseUser = await supabaseService.createOrUpdateUser(userData);
            set({ supabaseUser: supabaseUser as SupabaseUser });
            
            if (process.env.NODE_ENV === 'development') console.log('✅ Successfully synced with Supabase:', supabaseUser.email);
          } catch (error) {
            console.warn('⚠️ Supabase sync failed (app will continue without database features):', error);
            // Don't throw - keep the app working even if Supabase fails
            // Set a fallback user object so the app knows the sync was attempted
            set({ 
              supabaseUser: null 
            });
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