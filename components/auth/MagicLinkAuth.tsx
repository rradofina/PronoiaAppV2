import { useState } from 'react'
import { useSupabaseAuthStore } from '../../stores/supabaseAuthStore'

interface MagicLinkAuthProps {
  onSuccess?: () => void
  onError?: (error: string) => void
}

export default function MagicLinkAuth({ onSuccess, onError }: MagicLinkAuthProps) {
  const [email, setEmail] = useState('')
  const [isEmailSent, setIsEmailSent] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const { signInWithMagicLink, loading } = useSupabaseAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim()) {
      onError?.('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)
    
    const { error } = await signInWithMagicLink(email.trim())
    
    if (error) {
      console.error('Magic link error:', error)
      onError?.(error.message || 'Failed to send magic link')
      setIsSubmitting(false)
    } else {
      setIsEmailSent(true)
      setIsSubmitting(false)
      onSuccess?.()
    }
  }

  const handleResend = () => {
    setIsEmailSent(false)
    handleSubmit({ preventDefault: () => {} } as React.FormEvent)
  }

  if (isEmailSent) {
    return (
      <div className="text-center p-6 bg-blue-50 rounded-lg border border-blue-200">
        <div className="text-4xl mb-4">📧</div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2">Check Your Email</h3>
        <p className="text-gray-600 mb-4">
          We've sent a magic link to <strong>{email}</strong>
        </p>
        <p className="text-sm text-gray-500 mb-4">
          Click the link in your email to sign in instantly. No password required!
        </p>
        <button
          onClick={handleResend}
          className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          disabled={isSubmitting}
        >
          Resend magic link
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to PronoiaApp</h2>
        <p className="text-gray-600">Sign in with your email - no password needed!</p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email address"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
            disabled={isSubmitting || loading}
          />
        </div>
        
        <button
          type="submit"
          disabled={isSubmitting || loading || !email.trim()}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting || loading ? (
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Sending Magic Link...
            </div>
          ) : (
            'Send Magic Link'
          )}
        </button>
      </form>
      
      <div className="mt-6 text-center">
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-gray-500">or</span>
          </div>
        </div>
      </div>
    </div>
  )
}