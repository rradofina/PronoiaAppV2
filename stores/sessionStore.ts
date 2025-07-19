import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Session, Package } from '../types';
import { STORAGE_KEYS } from '../utils/constants';
import { supabaseService } from '../services/supabaseService';

interface SessionStore {
  session: Session | null;
  selectedPackage: Package | null;
  clientName: string;
  packages: Package[];
  currentStep: 'package' | 'template' | 'photos' | 'preview' | 'complete';
  userSessions: any[];
  
  setSession: (session: Session | null) => void;
  updateSession: (updates: Partial<Session>) => void;
  setSelectedPackage: (pkg: Package | null) => void;
  setClientName: (name: string) => void;
  setCurrentStep: (step: 'package' | 'template' | 'photos' | 'preview' | 'complete') => void;
  nextStep: () => void;
  previousStep: () => void;
  
  // Enhanced methods with Supabase
  createSessionWithSupabase: (userId: string, sessionData: {
    clientName: string;
    packageType: 'A' | 'B' | 'C' | 'D';
    googleDriveFolderId: string;
    maxTemplates: number;
  }) => Promise<void>;
  saveSessionToSupabase: () => Promise<void>;
  loadUserSessions: (userId: string) => Promise<void>;
  
  // Legacy methods (still work)
  saveSession: () => void;
  loadSession: () => void;
  clearSession: () => void;
}

const useSessionStore = create<SessionStore>()(
  devtools(
    persist(
      (set, get) => ({
        session: null,
        selectedPackage: null,
        clientName: '',
        currentStep: 'package',
        userSessions: [],
        packages: [
          { 
            id: 'A', 
            name: 'Package A', 
            templateCount: 1, 
            price: 249,
            description: 'Perfect for a single memorable print'
          },
          { 
            id: 'B', 
            name: 'Package B', 
            templateCount: 2, 
            price: 549,
            description: 'Great for couples or small groups'
          },
          { 
            id: 'C', 
            name: 'Package C', 
            templateCount: 5, 
            price: 999,
            description: 'Ideal for families and events'
          },
          { 
            id: 'D', 
            name: 'Package D', 
            templateCount: 10, 
            price: 1999,
            description: 'Complete collection for special occasions'
          },
        ],
        
        setSession: (session) => set({ session }),
        updateSession: (updates) => set((state) => ({
          session: state.session ? { ...state.session, ...updates, updatedAt: new Date() } : null,
        })),
        setSelectedPackage: (pkg) => set({ selectedPackage: pkg }),
        setClientName: (name) => set({ clientName: name }),
        setCurrentStep: (step) => set({ currentStep: step }),
        
        nextStep: () => {
          const state = get();
          const steps = ['package', 'template', 'photos', 'preview', 'complete'] as const;
          const currentIndex = steps.indexOf(state.currentStep);
          if (currentIndex < steps.length - 1) {
            set({ currentStep: steps[currentIndex + 1] });
          }
        },
        
        previousStep: () => {
          const state = get();
          const steps = ['package', 'template', 'photos', 'preview', 'complete'] as const;
          const currentIndex = steps.indexOf(state.currentStep);
          if (currentIndex > 0) {
            set({ currentStep: steps[currentIndex - 1] });
          }
        },
        
        saveSession: () => {
          const state = get();
          if (state.session) {
            try {
              localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(state.session));
            } catch (error) {
              console.error('Failed to save session:', error);
            }
          }
        },
        
        loadSession: () => {
          try {
            const saved = localStorage.getItem(STORAGE_KEYS.SESSION);
            if (saved) {
              const session = JSON.parse(saved);
              set({ 
                session,
                currentStep: session.isCompleted ? 'complete' : 'template',
              });
            }
          } catch (error) {
            console.error('Failed to load session:', error);
          }
        },
        
        // Enhanced Supabase methods
        createSessionWithSupabase: async (userId, sessionData) => {
          try {
            const session = await supabaseService.createSession({
              user_id: userId,
              client_name: sessionData.clientName,
              package_type: sessionData.packageType,
              google_drive_folder_id: sessionData.googleDriveFolderId,
              max_templates: sessionData.maxTemplates,
            });
            
            set({ session, clientName: sessionData.clientName });
            console.log('✅ Session created in Supabase:', session.id);
          } catch (error) {
            console.error('❌ Failed to create session in Supabase:', error);
            // Fallback to localStorage
            const fallbackSession: Session = {
              id: `local_${Date.now()}`,
              clientName: sessionData.clientName,
              packageType: sessionData.packageType,
              selectedTemplates: [],
              maxTemplates: sessionData.maxTemplates,
              usedTemplates: 0,
              googleDriveFolderId: sessionData.googleDriveFolderId,
              createdAt: new Date(),
              updatedAt: new Date(),
              isCompleted: false,
            };
            set({ session: fallbackSession, clientName: sessionData.clientName });
          }
        },
        
        saveSessionToSupabase: async () => {
          try {
            const { session } = get();
            if (!session || session.id.startsWith('local_')) {
              console.log('No Supabase session to save');
              return;
            }
            
            await supabaseService.updateSession(session.id, {
              client_name: session.clientName,
              used_templates: session.usedTemplates,
              output_folder_id: session.outputFolderId,
              is_completed: session.isCompleted,
            });
            
            console.log('✅ Session saved to Supabase');
          } catch (error) {
            console.error('❌ Failed to save session to Supabase:', error);
          }
        },
        
        loadUserSessions: async (userId) => {
          try {
            const sessions = await supabaseService.getUserSessions(userId);
            set({ userSessions: sessions });
            console.log(`✅ Loaded ${sessions.length} sessions from Supabase`);
          } catch (error) {
            console.error('❌ Failed to load user sessions:', error);
          }
        },
        
        clearSession: () => {
          set({
            session: null,
            selectedPackage: null,
            clientName: '',
            currentStep: 'package',
          });
          try {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
          } catch (error) {
            console.error('Failed to clear session:', error);
          }
        },
      }),
      {
        name: 'session-storage',
        partialize: (state) => ({
          session: state.session,
          selectedPackage: state.selectedPackage,
          clientName: state.clientName,
          currentStep: state.currentStep,
        }),
      }
    )
  )
);

export default useSessionStore;