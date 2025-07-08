import { GoogleAuth } from '../types';

interface HeaderNavigationProps {
  googleAuth: GoogleAuth;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
  showMainFolder?: boolean;
}

export default function HeaderNavigation({
  googleAuth,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
  showMainFolder = true,
}: HeaderNavigationProps) {
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
            <>
              <div className="text-sm text-gray-600">
                Signed in as: <span className="font-medium">{googleAuth.userEmail}</span>
              </div>
              <button
                onClick={onSignOut}
                className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-all duration-200"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
} 