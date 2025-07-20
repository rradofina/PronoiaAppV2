import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../components/admin/AdminLayout';
import { useAdminStore } from '../../stores/adminStore';
// import useAuthStore from '../../stores/authStore';
import { supabaseService } from '../../services/supabaseService';

interface DashboardStats {
  totalTemplates: number;
  totalUsers: number;
  templatesByPrintSize: Record<string, number>;
  recentActivity: Array<{
    id: string;
    action: string;
    target: string;
    timestamp: Date;
    user: string;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalTemplates: 0,
    totalUsers: 0,
    templatesByPrintSize: {},
    recentActivity: [],
  });
  const [isLoadingStats, setIsLoadingStats] = useState(true);

  const { adminUser, loadCustomTemplates } = useAdminStore();

  useEffect(() => {
    if (adminUser) {
      loadDashboardStats();
      loadCustomTemplates(); // Load all templates for stats
    }
  }, [adminUser, loadCustomTemplates]);

  const loadDashboardStats = async () => {
    setIsLoadingStats(true);
    try {
      // Load all templates for statistics
      const templates = await supabaseService.getCustomTemplates();
      
      // Calculate stats
      const templatesByPrintSize = templates.reduce((acc, template) => {
        acc[template.print_size] = (acc[template.print_size] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Mock recent activity (in real app, you'd have an activity log table)
      const recentActivity = [
        {
          id: '1',
          action: 'Created template',
          target: 'Solo Portrait 4R',
          timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 min ago
          user: adminUser?.name || 'Admin',
        },
        {
          id: '2',
          action: 'Updated template',
          target: 'Classic Collage',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
          user: adminUser?.name || 'Admin',
        },
        {
          id: '3',
          action: 'Deleted template',
          target: 'Old Layout',
          timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
          user: adminUser?.name || 'Admin',
        },
      ];

      setStats({
        totalTemplates: templates.length,
        totalUsers: 1, // Mock - would query users table
        templatesByPrintSize,
        recentActivity,
      });
    } catch (error) {
      console.error('Failed to load dashboard stats:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)} hours ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)} days ago`;
    }
  };

  if (isLoadingStats) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Welcome Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            Welcome back, {adminUser?.name || adminUser?.email}! 👋
          </h2>
          <p className="text-gray-600">
            Here&apos;s an overview of your PronoiaApp admin panel.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Templates</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalTemplates}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📐</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Users</p>
                <p className="text-3xl font-bold text-gray-800">{stats.totalUsers}</p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">👥</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">4R Templates</p>
                <p className="text-3xl font-bold text-gray-800">{stats.templatesByPrintSize['4R'] || 0}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">🎨</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">5R & A4 Templates</p>
                <p className="text-3xl font-bold text-gray-800">
                  {(stats.templatesByPrintSize['5R'] || 0) + (stats.templatesByPrintSize['A4'] || 0)}
                </p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <span className="text-2xl">📄</span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link
              href="/admin/templates/builder"
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">🎨</span>
              <div>
                <p className="font-medium text-gray-800">Create New Template</p>
                <p className="text-sm text-gray-600">Design custom photo layouts</p>
              </div>
            </Link>

            <Link
              href="/admin/templates"
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">📐</span>
              <div>
                <p className="font-medium text-gray-800">Manage Templates</p>
                <p className="text-sm text-gray-600">View PNG templates</p>
              </div>
            </Link>

            <Link
              href="/admin/templates/settings"
              className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-2xl">⚙️</span>
              <div>
                <p className="font-medium text-gray-800">Template Settings</p>
                <p className="text-sm text-gray-600">Configure Google Drive folder</p>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {stats.recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-b-0">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {activity.action} <span className="text-blue-600">{activity.target}</span>
                    </p>
                    <p className="text-xs text-gray-500">by {activity.user}</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Template Distribution Chart */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Template Distribution by Print Size</h3>
          <div className="space-y-3">
            {Object.entries(stats.templatesByPrintSize).map(([printSize, count]) => (
              <div key={printSize} className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">{printSize}</span>
                <div className="flex items-center space-x-3">
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(count / stats.totalTemplates) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm text-gray-600 w-8">{count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}