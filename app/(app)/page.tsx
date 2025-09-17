import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AppPage() {
  const supabase = createClient()

  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/auth/login')
  }

  // Get user's organizations
  const { data: orgs } = await supabase
    .from('organization_users')
    .select(`
      role,
      organization:organizations(slug)
    `)
    .eq('user_id', user.id)
    .limit(1)

  if (orgs && orgs.length > 0) {
    // Redirect to first organization
    redirect(`/app/${orgs[0].organization?.slug}`)
  } else {
    // No organizations, redirect to onboarding
    redirect('/auth/onboarding')
  }
}