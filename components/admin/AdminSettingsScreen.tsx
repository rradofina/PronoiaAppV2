import { useState, useEffect } from 'react';
import { GoogleAuth } from '../../types';
import HeaderNavigation from '../HeaderNavigation';
import { adminService, User } from '../../services/adminService';

interface AdminSettingsScreenProps {
  googleAuth: GoogleAuth;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
  onBack: () => void;
}

export default function AdminSettingsScreen({
  googleAuth,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
  onBack,
}: AdminSettingsScreenProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    email: '',
    name: '',
    role: '' as 'admin' | 'super_admin' | ''
  });
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  
  // Load users and current user info
  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [allUsers, currentUserData] = await Promise.all([
        adminService.getAllUsers(),
        adminService.getCurrentUser()
      ]);
      setUsers(allUsers);
      setCurrentUser(currentUserData);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter users based on search query
  const filteredUsers = users.filter(user =>
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle role change
  const handleRoleChange = async (user: User, newRole: 'admin' | 'super_admin' | null) => {
    try {
      await adminService.updateUserRole(user.id, newRole);
      await loadData(); // Reload to show updated data
      console.log(`✅ Updated ${user.email} to role: ${newRole || 'regular user'}`);
    } catch (err: any) {
      setError(`Failed to update user role: ${err.message}`);
    }
  };


  // Quick admin setup for current user
  const makeCurrentUserAdmin = async () => {
    if (!currentUser) return;
    try {
      await adminService.updateUserRoleByEmail(currentUser.email, 'admin');
      await loadData();
      console.log(`✅ Made ${currentUser.email} an admin`);
    } catch (err: any) {
      setError(`Failed to make current user admin: ${err.message}`);
    }
  };

  // Create new user
  const handleCreateUser = async () => {
    if (!newUserData.email.trim()) {
      setError('Email is required');
      return;
    }

    setIsCreatingUser(true);
    try {
      const userData = {
        email: newUserData.email.trim(),
        name: newUserData.name.trim() || undefined,
        role: newUserData.role || null
      };

      await adminService.createUser(userData);
      await loadData(); // Reload to show updated list
      
      // Reset form
      setNewUserData({ email: '', name: '', role: '' });
      setShowAddUserModal(false);
      
      console.log(`✅ Created user: ${userData.email}`);
    } catch (err: any) {
      setError(`Failed to create user: ${err.message}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const getRoleBadge = (user: User) => {
    const role = user.preferences?.role;
    if (role === 'super_admin') {
      return <span className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded-full font-medium">Super Admin</span>;
    }
    if (role === 'admin') {
      return <span className="px-2 py-1 text-xs bg-blue-100 text-blue-600 rounded-full font-medium">Admin</span>;
    }
    return <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">Regular User</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderNavigation
        googleAuth={googleAuth}
        mainSessionsFolder={mainSessionsFolder}
        onSignOut={onSignOut}
        onChangeMainFolder={onChangeMainFolder}
      />
      
      {/* DEV-DEBUG-OVERLAY */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        AdminSettingsScreen.tsx
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
              <p className="text-gray-600 mt-1">Manage users and system settings</p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-700">{error}</p>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 text-sm hover:underline mt-2"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Current User Info */}
        {currentUser && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Account</h2>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                  {currentUser.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{currentUser.email}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    {getRoleBadge(currentUser)}
                    <span className="text-xs text-gray-500">ID: {currentUser.id}</span>
                  </div>
                </div>
              </div>
              {!currentUser.preferences?.role && (
                <button
                  onClick={makeCurrentUserAdmin}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  Make Me Admin
                </button>
              )}
            </div>
          </div>
        )}

        {/* User Management */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">User Management</h2>
            <button
              onClick={() => setShowAddUserModal(true)}
              className="px-4 py-2 text-sm rounded-lg transition-colors bg-green-600 text-white hover:bg-green-700"
            >
              ➕ Add User
            </button>
          </div>
          
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder="Search users by email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Users List */}
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-500 mt-2">Loading users...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-gray-500 to-gray-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {user.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{user.email}</p>
                      <p className="text-xs text-gray-500">
                        Joined: {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    {getRoleBadge(user)}
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleRoleChange(user, user.preferences?.role === 'admin' ? null : 'admin')}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                          user.preferences?.role === 'admin'
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                        }`}
                      >
                        {user.preferences?.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        onClick={() => handleRoleChange(user, user.preferences?.role === 'super_admin' ? null : 'super_admin')}
                        className={`px-3 py-1 text-xs rounded transition-colors ${
                          user.preferences?.role === 'super_admin'
                            ? 'bg-red-100 text-red-600 hover:bg-red-200'
                            : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                        }`}
                      >
                        {user.preferences?.role === 'super_admin' ? 'Remove Super' : 'Make Super'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {showAddUserModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New User</h3>
              
              <div className="space-y-4">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={newUserData.email}
                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="user@example.com"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={newUserData.name}
                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Full Name"
                  />
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Initial Role
                  </label>
                  <select
                    value={newUserData.role}
                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as 'admin' | 'super_admin' | '' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Regular User</option>
                    <option value="admin">Admin</option>
                    <option value="super_admin">Super Admin</option>
                  </select>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setNewUserData({ email: '', name: '', role: '' });
                  }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={isCreatingUser || !newUserData.email.trim()}
                  className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                    isCreatingUser || !newUserData.email.trim()
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isCreatingUser ? 'Creating...' : 'Create User'}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}