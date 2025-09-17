import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Image, Plus } from 'lucide-react'

interface TemplatesPageProps {
  params: { org: string }
}

export default async function TemplatesPage({ params }: TemplatesPageProps) {
  const supabase = createClient()

  const { data: orgData } = await supabase
    .from('organizations')
    .select('*')
    .eq('slug', params.org)
    .single()

  const { data: templates } = await supabase
    .from('templates')
    .select('*')
    .eq('organization_id', orgData?.id || '')
    .order('created_at', { ascending: false })

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-600">Manage your photo templates</p>
        </div>
        <Button asChild>
          <Link href={`/app/${params.org}/templates/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Link>
        </Button>
      </div>

      {!templates || templates.length === 0 ? (
        <Card>
          <CardHeader className="text-center">
            <Image className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <CardTitle>No templates yet</CardTitle>
            <CardDescription>
              Create your first template to get started with photo sessions
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button asChild>
              <Link href={`/app/${params.org}/templates/new`}>
                <Plus className="mr-2 h-4 w-4" />
                Create First Template
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template: any) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="truncate">{template.name}</CardTitle>
                {template.description && (
                  <CardDescription className="line-clamp-2">
                    {template.description}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-500">
                    {template.type || 'Custom'}
                  </span>
                  <Button asChild size="sm">
                    <Link href={`/app/${params.org}/templates/${template.id}`}>
                      Edit
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