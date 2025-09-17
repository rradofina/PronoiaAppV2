import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { OrganizationProvider } from '@/lib/organizations/context'
import { AppSidebar } from '@/components/app/sidebar'

interface OrgLayoutProps {
  children: React.ReactNode
  params: { org: string }
}

export default async function OrgLayout({ children, params }: OrgLayoutProps) {
  const supabase = createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    redirect('/auth/login')
  }

  // Verify user has access to this organization
  const { data: orgAccess, error: orgError } = await supabase
    .from('organization_users')
    .select(`
      role,
      organization:organizations(*)
    `)
    .eq('user_id', user.id)
    .eq('organizations.slug', params.org)
    .single()

  if (orgError || !orgAccess) {
    notFound()
  }

  const organization = orgAccess.organization!
  const userRole = orgAccess.role

  return (
    <OrganizationProvider organization={organization} userRole={userRole}>
      <div className="flex h-screen bg-gray-100">
        <AppSidebar />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </OrganizationProvider>
  )
}