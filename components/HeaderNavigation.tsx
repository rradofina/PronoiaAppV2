import { GoogleAuth } from '../types';
import { useState, useRef, useEffect } from 'react';

interface HeaderNavigationProps {
  googleAuth: GoogleAuth;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
  showMainFolder?: boolean;
  onManageTemplates?: () => void;
  onManagePackages?: () => void;
}

export default function HeaderNavigation({
  googleAuth,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
  showMainFolder = true,
  onManageTemplates,
  onManagePackages,
}: HeaderNavigationProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Extract user initial from email
  const getUserInitial = (email: string): string => {
    if (!email) return 'U';
    return email.charAt(0).toUpperCase();
  };
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-gray-900">
            Pronoia Photo Studio
          </h1>
          {showMainFolder && mainSessionsFolder && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>Main Folder:</span>
              <span className="font-medium">{mainSessionsFolder.name}</span>
              <button
                onClick={onChangeMainFolder}
                className="text-blue-600 hover:text-blue-700 hover:underline ml-2"
              >
                Change
              </button>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {googleAuth.isSignedIn && (
            <div className="relative" ref={dropdownRef}>
              {/* Profile Avatar Button */}
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                  {getUserInitial(googleAuth.userEmail || '')}
                </div>
                <span className="text-sm text-gray-700 hidden sm:block">{googleAuth.userEmail}</span>
                <svg 
                  className={`w-4 h-4 text-gray-500 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {/* User Info Header */}
                  <div className="px-4 py-3 border-b border-gray-100">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {getUserInitial(googleAuth.userEmail || '')}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{googleAuth.userEmail}</p>
                        <p className="text-xs text-gray-500">Signed in</p>
                      </div>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-1">
                    {onManageTemplates && (
                      <button
                        onClick={() => {
                          onManageTemplates();
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-3"
                      >
                        <span className="text-lg">🖼️</span>
                        <span>Manage Templates</span>
                        <span className="ml-auto text-xs bg-purple-100 text-purple-600 px-2 py-1 rounded">Admin</span>
                      </button>
                    )}
                    
                    {onManagePackages && (
                      <button
                        onClick={() => {
                          onManagePackages();
                          setIsDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center space-x-3"
                      >
                        <span className="text-lg">📦</span>
                        <span>Manage Packages</span>
                        <span className="ml-auto text-xs bg-green-100 text-green-600 px-2 py-1 rounded">Admin</span>
                      </button>
                    )}
                    
                    {(onManageTemplates || onManagePackages) && (
                      <div className="border-t border-gray-100 my-1"></div>
                    )}
                    
                    <button
                      onClick={() => {
                        onSignOut();
                        setIsDropdownOpen(false);
                      }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
                    >
                      <span className="text-lg">🚪</span>
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
} 