import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAdminStore } from '../../stores/adminStore';
import useAuthStore from '../../stores/authStore';
import { ADMIN_ROUTES, getAdminPageTitle } from '../../middleware/adminAuth';
import { useAlert } from '../../contexts/AlertContext';

interface AdminLayoutProps {
  children: React.ReactNode;
}

interface SidebarItem {
  label: string;
  href: string;
  icon: string;
  permissions?: string[];
}

const SIDEBAR_ITEMS: SidebarItem[] = [
  {
    label: 'Dashboard',
    href: ADMIN_ROUTES.DASHBOARD,
    icon: '📊',
  },
  {
    label: 'Template Builder',
    href: ADMIN_ROUTES.TEMPLATE_BUILDER,
    icon: '🎨',
    permissions: ['TEMPLATE_BUILDER'],
  },
  {
    label: 'Templates',
    href: ADMIN_ROUTES.TEMPLATE_MANAGEMENT,
    icon: '📐',
    permissions: ['TEMPLATE_BUILDER'],
  },
  {
    label: 'Categories',
    href: ADMIN_ROUTES.TEMPLATE_CATEGORIES,
    icon: '📁',
    permissions: ['TEMPLATE_CATEGORIES'],
  },
  {
    label: 'Users',
    href: ADMIN_ROUTES.USER_MANAGEMENT,
    icon: '👥',
    permissions: ['USER_MANAGEMENT'],
  },
  {
    label: 'Analytics',
    href: ADMIN_ROUTES.ANALYTICS,
    icon: '📈',
    permissions: ['ANALYTICS'],
  },
  {
    label: 'Settings',
    href: ADMIN_ROUTES.SETTINGS,
    icon: '⚙️',
    permissions: ['SYSTEM_SETTINGS'],
  },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showWarning } = useAlert();
  
  const {
    isAdminAuthenticated,
    adminUser,
    isCheckingAdminAuth,
    checkAdminAuth,
    clearAdminAuth,
  } = useAdminStore();
  
  const { googleAuth, supabaseUser, clearAuth } = useAuthStore();

  // Check admin authentication on mount
  useEffect(() => {
    console.log('🔍 Admin auth check:', { 
      isSignedIn: googleAuth.isSignedIn, 
      isAdminAuthenticated, 
      isCheckingAdminAuth,
      userEmail: googleAuth.userEmail 
    });
    
    if (googleAuth.isSignedIn && !isAdminAuthenticated && !isCheckingAdminAuth) {
      console.log('🚀 Starting admin auth check...');
      checkAdminAuth(googleAuth, supabaseUser);
    }
  }, [googleAuth.isSignedIn, isAdminAuthenticated, isCheckingAdminAuth, checkAdminAuth, supabaseUser]);

  // Redirect if not authenticated or not admin
  useEffect(() => {
    if (!isCheckingAdminAuth) {
      if (!googleAuth.isSignedIn) {
        console.log('❌ Redirecting: Not signed in', googleAuth);
        showWarning('Not signed in', 'Not signed in to Google. Please sign in first at localhost:3000');
        setTimeout(() => router.push('/'), 3000);
        return;
      }
      
      if (!isAdminAuthenticated) {
        console.log('❌ Redirecting: Not admin authenticated', { isAdminAuthenticated, adminUser });
        showWarning('Access Denied', 'Not admin authenticated. Check console for details.');
        setTimeout(() => router.push('/'), 3000);
        return;
      }
    }
  }, [googleAuth.isSignedIn, isAdminAuthenticated, isCheckingAdminAuth, router]);

  // Handle admin logout
  const handleLogout = async () => {
    clearAdminAuth();
    clearAuth();
    router.push('/');
  };

  // Show loading while checking auth
  if (isCheckingAdminAuth || !isAdminAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Verifying admin access...</p>
        </div>
      </div>
    );
  }

  const currentPageTitle = getAdminPageTitle(router.pathname);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      {/* <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        AdminLayout.tsx
      </div> */}
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0 lg:static lg:inset-0
      `}>
        {/* Sidebar header */}
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold">
              P
            </div>
            <span className="font-semibold text-gray-800">Admin Panel</span>
          </div>
          
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md hover:bg-gray-100"
          >
            ✕
          </button>
        </div>

        {/* Admin user info */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <img
              src={adminUser?.avatar_url || '/default-avatar.png'}
              alt="Admin Avatar"
              className="w-10 h-10 rounded-full"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {adminUser?.name || adminUser?.email}
              </p>
              <p className="text-xs text-blue-600 capitalize">
                {adminUser?.role || 'admin'}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1">
          {SIDEBAR_ITEMS.map((item) => {
            const isActive = router.pathname === item.href;
            
            return (
              <Link key={item.href} href={item.href}>
                <a className={`
                  flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive 
                    ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-700' 
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                  }
                `}>
                  <span className="text-lg">{item.icon}</span>
                  <span>{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>

        {/* Back to app and logout */}
        <div className="p-4 border-t border-gray-200 space-y-2">
          <Link href="/">
            <a className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-800">
              <span className="text-lg">↩️</span>
              <span>Back to App</span>
            </a>
          </Link>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
          >
            <span className="text-lg">🔓</span>
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="flex items-center justify-between h-16 px-6">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-md hover:bg-gray-100"
              >
                ☰
              </button>
              
              <h1 className="text-xl font-semibold text-gray-800">
                {currentPageTitle}
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">
                {new Date().toLocaleDateString()}
              </span>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}