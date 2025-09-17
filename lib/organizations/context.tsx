'use client'

import { createContext, useContext, ReactNode } from 'react'
import { Organization } from '@/lib/supabase/types'

interface OrganizationContextType {
  organization: Organization
  userRole: string
}

const OrganizationContext = createContext<OrganizationContextType | undefined>(undefined)

export function OrganizationProvider({
  children,
  organization,
  userRole
}: {
  children: ReactNode
  organization: Organization
  userRole: string
}) {
  return (
    <OrganizationContext.Provider value={{ organization, userRole }}>
      {children}
    </OrganizationContext.Provider>
  )
}

export function useOrganization() {
  const context = useContext(OrganizationContext)
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider')
  }
  return context
}