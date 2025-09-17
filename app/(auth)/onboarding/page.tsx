'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { createOrganization } from '@/lib/organizations/actions'

export default function OnboardingPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Auto-generate slug when name changes
  const handleNameChange = (value: string) => {
    setName(value)
    const generatedSlug = value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 50)
    setSlug(generatedSlug)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    if (name.trim().length < 2) {
      setError('Organization name must be at least 2 characters')
      setLoading(false)
      return
    }

    if (slug.trim().length < 2) {
      setError('Organization URL must be at least 2 characters')
      setLoading(false)
      return
    }

    try {
      const result = await createOrganization(name.trim(), slug.trim())
      if (result?.error) {
        setError(result.error)
      }
      // If successful, the action will redirect automatically
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl text-center">Create your organization</CardTitle>
        <CardDescription className="text-center">
          Set up your photo studio workspace and start your 14-day free trial
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="name">Studio Name</Label>
            <Input
              id="name"
              type="text"
              placeholder="e.g., Sunset Photography Studio"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              disabled={loading}
              maxLength={100}
            />
            <p className="text-xs text-gray-500">
              This will be the name of your photo studio workspace
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Organization URL</Label>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500">pronoia.app/</span>
              <Input
                id="slug"
                type="text"
                placeholder="studio-url"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                required
                disabled={loading}
                maxLength={50}
                pattern="^[a-z0-9-]+$"
              />
            </div>
            <p className="text-xs text-gray-500">
              This will be your unique URL for accessing your workspace
            </p>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">Your 14-day free trial includes:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Unlimited templates and sessions</li>
              <li>• Visual template designer</li>
              <li>• Google Drive integration</li>
              <li>• Export to multiple formats</li>
              <li>• No credit card required</li>
            </ul>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Creating organization...' : 'Create organization & start trial'}
          </Button>
        </form>

        <div className="mt-4 text-center text-xs text-gray-500">
          By creating an organization, you agree to our Terms of Service and Privacy Policy.
        </div>
      </CardContent>
    </Card>
  )
}