'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single
    .substring(0, 50) // Limit length
}

export async function createOrganization(name: string, slug?: string) {
  const supabase = createClient()

  // Get current user
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  // Generate slug if not provided
  const finalSlug = slug || generateSlug(name)

  // Check if slug is available
  const { data: existingOrg } = await supabase
    .from('organizations')
    .select('id')
    .eq('slug', finalSlug)
    .single()

  if (existingOrg) {
    return { error: 'Organization name is already taken. Please choose a different name.' }
  }

  // Create organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name,
      slug: finalSlug,
      subscription_plan: 'trial',
      subscription_status: 'trial',
      trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days from now
    })
    .select()
    .single()

  if (orgError) {
    return { error: orgError.message }
  }

  // Add user as owner
  const { error: memberError } = await supabase
    .from('organization_users')
    .insert({
      organization_id: org.id,
      user_id: user.id,
      role: 'owner',
      joined_at: new Date().toISOString(),
    })

  if (memberError) {
    return { error: memberError.message }
  }

  revalidatePath('/', 'layout')
  redirect(`/app/${finalSlug}`)
}

export async function getUserOrganizations() {
  const supabase = createClient()

  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) {
    return { error: 'Not authenticated' }
  }

  const { data: orgs, error } = await supabase
    .from('organization_users')
    .select(`
      role,
      joined_at,
      organization:organizations(*)
    `)
    .eq('user_id', user.id)

  if (error) {
    return { error: error.message }
  }

  return { organizations: orgs }
}