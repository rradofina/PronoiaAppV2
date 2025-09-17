'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useOrganization } from '@/lib/organizations/context'
import { useAuth } from '@/lib/auth/hooks'
import { Button } from '@/components/ui/button'
import {
  LayoutDashboard,
  Image,
  Settings,
  Users,
  FolderOpen,
  LogOut
} from 'lucide-react'
import { signOut } from '@/lib/auth/actions'

const navigation = [
  {
    name: 'Dashboard',
    href: '',
    icon: LayoutDashboard,
  },
  {
    name: 'Templates',
    href: '/templates',
    icon: Image,
  },
  {
    name: 'Sessions',
    href: '/sessions',
    icon: FolderOpen,
  },
  {
    name: 'Team',
    href: '/team',
    icon: Users,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { organization } = useOrganization()
  const { user } = useAuth()

  return (
    <div className="flex flex-col w-64 bg-white shadow-lg">
      {/* Organization Header */}
      <div className="p-6 border-b">
        <h2 className="text-lg font-semibold text-gray-900 truncate">
          {organization.name}
        </h2>
        <p className="text-sm text-gray-500">
          {organization.subscription_plan === 'trial'
            ? 'Free Trial'
            : organization.subscription_plan
              ? organization.subscription_plan.charAt(0).toUpperCase() + organization.subscription_plan.slice(1)
              : 'Free Plan'
          }
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navigation.map((item) => {
          const href = `/app/${organization.slug}${item.href}`
          const isActive = item.href === ''
            ? pathname === `/app/${organization.slug}`
            : pathname.startsWith(href)

          return (
            <Link
              key={item.name}
              href={href}
              className={cn(
                'flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors',
                isActive
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="p-4 border-t">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-sm font-medium text-white">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.user_metadata?.full_name || user?.email || 'User'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="h-8 w-8 p-0"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}