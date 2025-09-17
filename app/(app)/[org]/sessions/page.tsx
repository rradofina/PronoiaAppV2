import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FolderOpen, Plus, Calendar } from 'lucide-react'

interface SessionsPageProps {
  params: { org: string }
}

export default async function SessionsPage({ params }: SessionsPageProps) {
  const supabase = createClient()

  const { data: orgData } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', params.org)
    .single()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('organization_id', orgData?.id || '')
    .order('created_at', { ascending: false })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'in_progress':
        return 'bg-blue-100 text-blue-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      case 'archived':
        return 'bg-gray-100 text-gray-600'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Sessions</h1>
          <p className="text-gray-600">Manage your photo sessions</p>
        </div>
        <Button asChild>
          <Link href={`/app/${params.org}/sessions/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Session
          </Link>
        </Button>
      </div>

      {!sessions || sessions.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <FolderOpen className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <CardTitle>No sessions yet</CardTitle>
            <CardDescription>
              Start your first photo session to organize client photos
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href={`/app/${params.org}/sessions/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Session
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session: any) => (
            <Card key={session.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="truncate">{session.name}</CardTitle>
                    {session.client_name && (
                      <CardDescription>
                        Client: {session.client_name}
                      </CardDescription>
                    )}
                  </div>
                  <Badge className={getStatusColor(session.status || 'draft')}>
                    {session.status || 'draft'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="flex items-center text-sm text-gray-500">
                    <Calendar className="mr-1 h-4 w-4" />
                    {new Date(session.session_date || session.created_at).toLocaleDateString()}
                  </div>
                  <Button asChild size="sm">
                    <Link href={`/app/${params.org}/sessions/${session.id}`}>
                      View
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}