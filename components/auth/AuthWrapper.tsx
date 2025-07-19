import { useEffect, ReactNode } from 'react'
import { useSupabaseAuthStore } from '../../stores/supabaseAuthStore'

interface AuthWrapperProps {
  children: ReactNode
}

export default function AuthWrapper({ children }: AuthWrapperProps) {
  const { initialize, loading } = useSupabaseAuthStore()

  useEffect(() => {
    // Initialize Supabase auth listener
    initialize()
  }, [initialize])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}