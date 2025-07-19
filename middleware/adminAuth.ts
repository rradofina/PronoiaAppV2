import { NextRequest, NextResponse } from 'next/server';
import { supabaseService } from '../services/supabaseService';

export interface AdminAuthResult {
  isAuthenticated: boolean;
  isAdmin: boolean;
  user?: any;
  redirectTo?: string;
}

/**
 * Middleware to check if user is authenticated and has admin privileges
 */
export async function checkAdminAuth(request: NextRequest): Promise<AdminAuthResult> {
  try {
    // Check if user is signed in with Google (from existing auth flow)
    const authHeader = request.headers.get('authorization');
    const googleUserId = request.headers.get('x-google-user-id');
    
    if (!googleUserId) {
      return {
        isAuthenticated: false,
        isAdmin: false,
        redirectTo: '/', // Redirect to main app for Google auth
      };
    }

    // Check if user exists in Supabase and has admin role
    const isAdmin = await supabaseService.isUserAdmin(googleUserId);
    
    if (!isAdmin) {
      return {
        isAuthenticated: true,
        isAdmin: false,
        redirectTo: '/', // Redirect to main app - not authorized
      };
    }

    // Get full user data for admin context
    const user = await supabaseService.getUserByGoogleId(googleUserId);

    return {
      isAuthenticated: true,
      isAdmin: true,
      user,
    };
  } catch (error) {
    console.error('Admin auth check failed:', error);
    return {
      isAuthenticated: false,
      isAdmin: false,
      redirectTo: '/',
    };
  }
}

/**
 * HOC to protect admin routes
 */
export function withAdminAuth<T extends object>(
  WrappedComponent: React.ComponentType<T>
): React.ComponentType<T> {
  return function AdminProtectedComponent(props: T) {
    // This will be handled client-side in the admin layout
    return <WrappedComponent {...props} />;
  };
}

/**
 * Admin route configuration
 */
export const ADMIN_ROUTES = {
  DASHBOARD: '/admin',
  TEMPLATE_BUILDER: '/admin/templates/builder',
  TEMPLATE_MANAGEMENT: '/admin/templates',
  TEMPLATE_CATEGORIES: '/admin/templates/categories',
  USER_MANAGEMENT: '/admin/users',
  ANALYTICS: '/admin/analytics',
  SETTINGS: '/admin/settings',
} as const;

/**
 * Check if a path is an admin route
 */
export function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith('/admin');
}

/**
 * Get the admin page title based on route
 */
export function getAdminPageTitle(pathname: string): string {
  switch (pathname) {
    case ADMIN_ROUTES.DASHBOARD:
      return 'Admin Dashboard';
    case ADMIN_ROUTES.TEMPLATE_BUILDER:
      return 'Template Builder';
    case ADMIN_ROUTES.TEMPLATE_MANAGEMENT:
      return 'Template Management';
    case ADMIN_ROUTES.TEMPLATE_CATEGORIES:
      return 'Template Categories';
    case ADMIN_ROUTES.USER_MANAGEMENT:
      return 'User Management';
    case ADMIN_ROUTES.ANALYTICS:
      return 'Analytics';
    case ADMIN_ROUTES.SETTINGS:
      return 'Settings';
    default:
      return 'Admin Panel';
  }
}