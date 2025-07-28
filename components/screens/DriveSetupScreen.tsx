import { DriveFolder, GoogleAuth } from '../../types';
import { useState, useEffect } from 'react';
import { ChevronRight, Folder, ChevronLeft } from 'lucide-react';

interface DriveSetupScreenProps {
  isGapiLoaded: boolean;
  googleAuth: GoogleAuth;
  driveFolders: DriveFolder[];
  handleGoogleSignIn: () => void;
  handleMainFolderSelect: (folder: DriveFolder) => void;
  mainSessionsFolder: { id: string; name: string } | null;
  handleSignOut: () => void;
  isConnecting: boolean;
  isRestoringAuth?: boolean;
}

export default function DriveSetupScreen({
  isGapiLoaded,
  googleAuth,
  driveFolders: _driveFolders,
  handleGoogleSignIn,
  handleMainFolderSelect,
  mainSessionsFolder,
  handleSignOut,
  isConnecting,
  isRestoringAuth = false,
}: DriveSetupScreenProps) {
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string; name: string }[]>([]);
  const [currentFolders, setCurrentFolders] = useState<DriveFolder[]>([]);

  const loadFolders = async (parentId: string | null = null) => {
    try {
      // Safety check: Ensure Google API client is available
      if (!window.gapi?.client?.drive) {
        console.warn('Google API client not yet available');
        return;
      }
      
      const q = parentId 
        ? `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
        : `mimeType='application/vnd.google-apps.folder' and 'root' in parents and trashed=false`;
      
      const response = await window.gapi.client.drive.files.list({
        q,
        fields: 'files(id, name, createdTime)',
        orderBy: 'name'
      });
      
      setCurrentFolders(response.result.files || []);
    } catch (error) {
      console.error('Failed to load folders:', error);
    }
  };

  useEffect(() => {
    if (googleAuth.isSignedIn && !mainSessionsFolder) {
      loadFolders(null); // Load root folders initially
    }
  }, [googleAuth.isSignedIn, mainSessionsFolder]);

  const handleFolderClick = async (folder: DriveFolder) => {
    setFolderPath([...folderPath, { id: folder.id, name: folder.name }]);
    setCurrentFolderId(folder.id);
    await loadFolders(folder.id);
  };

  const handleBreadcrumbClick = async (index: number) => {
    const newPath = folderPath.slice(0, index);
    setFolderPath(newPath);
    const newCurrentId = newPath.length > 0 ? newPath[newPath.length - 1].id : null;
    setCurrentFolderId(newCurrentId);
    await loadFolders(newCurrentId);
  };

  const handleSelectCurrentFolder = () => {
    if (currentFolderId && folderPath.length > 0) {
      const selectedFolder = {
        id: currentFolderId,
        name: folderPath[folderPath.length - 1].name,
        createdTime: ''
      };
      handleMainFolderSelect(selectedFolder);
    }
  };

  if (!isGapiLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading Google Services...</p>
        </div>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">
            {isRestoringAuth ? 'Restoring your session...' : 'Connecting to Google Drive...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        DriveSetupScreen.tsx
      </div>
      
      <div className="max-w-4xl w-full mx-auto">

        {!googleAuth.isSignedIn ? (
          <div className="space-y-6">
            {/* Google Sign In */}
            <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-100 text-center">
              <div className="mb-8">
                <div className="mb-6">
                  <img 
                    src="/images/pronoia_logo.png" 
                    alt="Pronoia Studio Logo" 
                    className="w-32 h-32 mx-auto mb-4 object-cover rounded-full shadow-lg border-4 border-gray-100"
                  />
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">
                  Welcome to Pronoia Studios PH
                </h2>
                <p className="text-lg text-gray-600 mb-2">
                  Professional Photo Template Creator
                </p>
                <p className="text-gray-500">
                  Connect your Google Drive to access your photo folders and create beautiful print templates.
                </p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={handleGoogleSignIn}
                  className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-10 py-4 rounded-xl font-semibold text-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center space-x-3"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <span>Connect with Google Drive</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg p-8 shadow-sm">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">✅</div>
              <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                Connected to Google Drive
              </h2>
              <p className="text-gray-600">
                Signed in as: <span className="font-medium">{googleAuth.userEmail}</span>
              </p>
              <button
                onClick={handleSignOut}
                className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-red-600 transition-all duration-200"
              >
                Sign Out
              </button>
            </div>
            
            {mainSessionsFolder && !isSelectingFolder ? (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Main Photo Folder
                </h3>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg p-4">
                  <div className="flex items-center">
                    <div className="text-2xl mr-3">📁</div>
                    <div>
                      <p className="font-medium text-gray-800">{mainSessionsFolder.name}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsSelectingFolder(true)}
                    className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-200 transition-all duration-200"
                  >
                    Change
                  </button>
                </div>
                <div className="text-center mt-4">
                  <button
                    onClick={() => handleMainFolderSelect({ id: mainSessionsFolder.id, name: mainSessionsFolder.name, createdTime: '' })}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-all duration-200"
                  >
                    Continue with "{mainSessionsFolder.name}"
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  {isSelectingFolder ? 'Change Main Photo Folder' : 'Select Your Main Photo Folder'}
                </h3>
                <p className="text-gray-600 mb-4">
                  This is the top-level folder in your Google Drive where all your client galleries are stored.
                </p>
                
                {/* Breadcrumbs */}
                <div className="flex items-center mb-6 p-3 bg-gray-50 rounded-lg overflow-x-auto">
                  <button
                    onClick={() => handleBreadcrumbClick(0)}
                    className="flex items-center text-blue-600 hover:text-blue-800 font-medium px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                  >
                    📁 Root
                  </button>
                  {folderPath.map((path, index) => (
                    <span key={path.id} className="flex items-center">
                      <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                      <button
                        onClick={() => handleBreadcrumbClick(index + 1)}
                        className="text-blue-600 hover:text-blue-800 whitespace-nowrap font-medium px-2 py-1 rounded hover:bg-blue-100 transition-colors"
                      >
                        {path.name}
                      </button>
                    </span>
                  ))}
                </div>
                
                {/* Folder List */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-80 overflow-y-auto p-2 bg-gray-50 rounded-lg">
                  {currentFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderClick(folder)}
                      className="flex flex-col items-center p-4 bg-white border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <Folder className="w-10 h-10 text-yellow-500 mb-3" />
                      <span className="text-sm text-center font-medium text-gray-700 line-clamp-2 leading-tight">{folder.name}</span>
                    </button>
                  ))}
                </div>
                
                {currentFolders.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Folder className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">No folders found in this location</p>
                  </div>
                )}
                
                {folderPath.length > 0 && (
                  <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200">
                    <button
                      onClick={() => handleBreadcrumbClick(folderPath.length - 1)}
                      className="flex items-center text-gray-600 hover:text-gray-800 px-4 py-2 rounded-lg hover:bg-gray-100 transition-all duration-200"
                    >
                      <ChevronLeft className="w-5 h-5 mr-1" />
                      Back
                    </button>
                    <button
                      onClick={() => {
                        handleSelectCurrentFolder();
                        setIsSelectingFolder(false);
                      }}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-green-700 transition-all duration-200 shadow-md flex items-center"
                    >
                      ✓ Select This Folder
                    </button>
                  </div>
                )}
              </div>
            )}


          </div>
        )}
      </div>
    </div>
  );
} 