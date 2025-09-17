import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useOrganization } from '@/lib/organizations/context'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import {
  Image,
  FolderOpen,
  Users,
  Calendar,
  TrendingUp,
  Clock
} from 'lucide-react'

interface DashboardPageProps {
  params: { org: string }
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  const supabase = createClient()

  // Get dashboard stats
  const { data: { user } } = await supabase.auth.getUser()

  const { data: orgData } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', params.org)
    .single()

  const { data: templates } = await supabase
    .from('templates')
    .select('id')
    .eq('organization_id', orgData?.id || '')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('organization_id', orgData?.id || '')

  const templateCount = templates?.length || 0
  const sessionCount = sessions?.length || 0
  const activeSessionCount = sessions?.filter((s: any) => s.status === 'in_progress').length || 0

  const trialDaysLeft = orgData?.trial_ends_at
    ? Math.max(0, Math.ceil((new Date(orgData.trial_ends_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)))
    : 0

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Welcome back to {orgData?.name}</p>
      </div>

      {/* Trial Banner */}
      {orgData?.subscription_status === 'trial' && (
        <Card className="mb-8 border-blue-200 bg-blue-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-blue-900">Free Trial Active</CardTitle>
                <CardDescription className="text-blue-700">
                  {trialDaysLeft > 0
                    ? `${trialDaysLeft} days remaining`
                    : 'Trial expired'
                  }
                </CardDescription>
              </div>
              <Button asChild>
                <Link href={`/app/${params.org}/settings/billing`}>
                  Upgrade Now
                </Link>
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Templates</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templateCount}</div>
            <p className="text-xs text-muted-foreground">
              Available templates
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sessions</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sessionCount}</div>
            <p className="text-xs text-muted-foreground">
              Total sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Sessions</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSessionCount}</div>
            <p className="text-xs text-muted-foreground">
              In progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usage</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{orgData?.usage_current_month || 0}</div>
            <p className="text-xs text-muted-foreground">
              Sessions this month
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Create Template</CardTitle>
            <CardDescription>
              Design a new photo template for your sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/app/${params.org}/templates/new`}>
                <Image className="mr-2 h-4 w-4" />
                New Template
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Start Session</CardTitle>
            <CardDescription>
              Begin a new photo session with a client
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href={`/app/${params.org}/sessions/new`}>
                <FolderOpen className="mr-2 h-4 w-4" />
                New Session
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Organization Settings</CardTitle>
            <CardDescription>
              Manage your organization and team settings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href={`/app/${params.org}/settings`}>
                <Users className="mr-2 h-4 w-4" />
                Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}