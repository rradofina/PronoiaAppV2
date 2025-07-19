import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface SupabaseAuthState {
  user: User | null
  session: Session | null
  loading: boolean
  isSignedIn: boolean
  
  // Actions
  signInWithMagicLink: (email: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
  
  // Initialize auth listener
  initialize: () => void
}

export const useSupabaseAuthStore = create<SupabaseAuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      loading: true,
      isSignedIn: false,

      signInWithMagicLink: async (email: string) => {
        set({ loading: true })
        
        try {
          console.log('Attempting to send magic link to:', email)
          console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
          
          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              // Redirect to the current page after sign in
              emailRedirectTo: `${window.location.origin}`,
            },
          })
          
          if (error) {
            console.error('Supabase auth error:', error)
          } else {
            console.log('Magic link sent successfully')
          }
          
          set({ loading: false })
          return { error }
        } catch (err) {
          console.error('Network error:', err)
          set({ loading: false })
          return { error: { message: 'Network error. Please check your connection and try again.' } }
        }
      },

      signOut: async () => {
        set({ loading: true })
        
        const { error } = await supabase.auth.signOut()
        
        if (!error) {
          set({ 
            user: null, 
            session: null, 
            isSignedIn: false,
            loading: false 
          })
        } else {
          set({ loading: false })
        }
      },

      setUser: (user: User | null) => {
        set({ 
          user,
          isSignedIn: !!user 
        })
      },

      setSession: (session: Session | null) => {
        set({ 
          session,
          user: session?.user || null,
          isSignedIn: !!session?.user 
        })
      },

      setLoading: (loading: boolean) => {
        set({ loading })
      },

      initialize: () => {
        // Listen for auth changes
        supabase.auth.onAuthStateChange((event, session) => {
          console.log('Auth state changed:', event, session?.user?.email)
          
          const { setSession, setLoading } = get()
          
          setSession(session)
          setLoading(false)
          
          // Handle different auth events
          if (event === 'SIGNED_IN') {
            console.log('User signed in:', session?.user?.email)
          } else if (event === 'SIGNED_OUT') {
            console.log('User signed out')
          } else if (event === 'TOKEN_REFRESHED') {
            console.log('Token refreshed')
          }
        })

        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
          const { setSession, setLoading } = get()
          setSession(session)
          setLoading(false)
        })
      },
    }),
    {
      name: 'supabase-auth-storage',
      partialize: (state) => ({ 
        user: state.user,
        session: state.session,
        isSignedIn: state.isSignedIn 
      }),
    }
  )
)