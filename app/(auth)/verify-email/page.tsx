'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { supabase } from '@/lib/supabase/client'

export default function VerifyEmailPage() {
  const [verifying, setVerifying] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleEmailVerification = async () => {
      const token_hash = searchParams.get('token_hash')
      const type = searchParams.get('type')

      if (token_hash && type) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash,
          type: type as any,
        })

        if (error) {
          setError(error.message)
        } else {
          setSuccess(true)
          // Redirect to onboarding after successful verification
          setTimeout(() => {
            router.push('/auth/onboarding')
          }, 2000)
        }
      } else {
        setError('Invalid verification link')
      }
      setVerifying(false)
    }

    handleEmailVerification()
  }, [searchParams, router])

  if (verifying) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Verifying email</CardTitle>
          <CardDescription className="text-center">
            Please wait while we verify your email address...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (success) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Email verified</CardTitle>
          <CardDescription className="text-center">
            Your email has been successfully verified
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              Redirecting you to complete your account setup...
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Verification failed</CardTitle>
        <CardDescription className="text-center">
          We couldn't verify your email address
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>

        <div className="mt-6 text-center">
          <Link
            href="/auth/signup"
            className="text-blue-600 hover:text-blue-500"
          >
            Try signing up again
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}