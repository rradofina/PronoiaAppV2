import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Settings,
  CreditCard,
  Users,
  Palette,
  HardDrive,
  Shield
} from 'lucide-react'

interface SettingsPageProps {
  params: { org: string }
}

export default async function SettingsPage({ params }: SettingsPageProps) {
  const supabase = createClient()

  const { data: orgData } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', params.org)
    .single()

  const trialDaysLeft = orgData?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(orgData.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600">Manage your organization settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Organization Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Settings className="mr-2 h-5 w-5" />
              <CardTitle>Organization</CardTitle>
            </div>
            <CardDescription>
              Basic information about your organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Name</dt>
                <dd className="text-sm text-gray-900">{orgData?.name}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">URL</dt>
                <dd className="text-sm text-gray-900">pronoia.app/{orgData?.slug}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Created</dt>
                <dd className="text-sm text-gray-900">
                  {orgData?.created_at ? new Date(orgData.created_at).toLocaleDateString() : 'N/A'}
                </dd>
              </div>
            </dl>
            <Button className="mt-4" variant="outline" size="sm">
              Edit Details
            </Button>
          </CardContent>
        </Card>

        {/* Subscription */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <CreditCard className="mr-2 h-5 w-5" />
                <CardTitle>Subscription</CardTitle>
              </div>
              <Badge variant={orgData?.subscription_status === 'trial' ? 'secondary' : 'default'}>
                {orgData?.subscription_plan || 'trial'}
              </Badge>
            </div>
            <CardDescription>
              Manage your subscription and billing
            </CardDescription>
          </CardHeader>
          <CardContent>
            {orgData?.subscription_status === 'trial' ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  {trialDaysLeft > 0
                    ? `Your free trial ends in ${trialDaysLeft} days`
                    : 'Your free trial has ended'
                  }
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">Trial includes:</p>
                  <ul className="text-xs text-gray-500 space-y-1">
                    <li>• Unlimited templates</li>
                    <li>• Up to 80 sessions/month</li>
                    <li>• Google Drive integration</li>
                  </ul>
                </div>
                <Button size="sm">
                  Upgrade to Pro
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Current plan: {orgData?.subscription_plan}
                </p>
                <Button size="sm" variant="outline">
                  Manage Billing
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Team Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Users className="mr-2 h-5 w-5" />
              <CardTitle>Team</CardTitle>
            </div>
            <CardDescription>
              Manage team members and permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              You are the owner of this organization.
            </p>
            <Button size="sm" variant="outline" disabled>
              Invite Members (Coming Soon)
            </Button>
          </CardContent>
        </Card>

        {/* Branding */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Palette className="mr-2 h-5 w-5" />
              <CardTitle>Branding</CardTitle>
            </div>
            <CardDescription>
              Customize your organization's appearance
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Upload your logo and customize colors to match your brand.
            </p>
            <Button size="sm" variant="outline" disabled>
              Customize Branding (Coming Soon)
            </Button>
          </CardContent>
        </Card>

        {/* Google Drive */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <HardDrive className="mr-2 h-5 w-5" />
              <CardTitle>Google Drive</CardTitle>
            </div>
            <CardDescription>
              Connect your Google Drive for photo storage
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600 mb-4">
              Connect your Google Drive to access client photos and export templates.
            </p>
            <Button size="sm" variant="outline" disabled>
              Connect Drive (Coming Soon)
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>
              Security and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Two-factor authentication</span>
                <Badge variant="secondary">Not enabled</Badge>
              </div>
              <Button size="sm" variant="outline" disabled>
                Security Settings (Coming Soon)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}