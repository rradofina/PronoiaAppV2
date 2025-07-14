import { DriveFolder, GoogleAuth } from '../../types';
import { useState, useEffect } from 'react';
import { ChevronRight, Folder, ChevronLeft } from 'lucide-react';
import { motion } from 'framer-motion';

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
  driveFolders,
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
      <div className="max-w-4xl w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Pronoia Photo Studio
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Manage your client photo sessions with ease
          </p>
        </div>

        {!googleAuth.isSignedIn ? (
          <div className="space-y-6">
            {/* Google Sign In */}
            <div className="bg-white rounded-lg p-8 shadow-sm text-center">
              <div className="mb-6">
                <div className="text-6xl mb-4">📁</div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                  Connect Google Drive
                </h2>
                <p className="text-gray-600">
                  Sign in to securely access your photo folders.
                </p>
              </div>
              <div className="flex justify-center">
                <button
                  onClick={handleGoogleSignIn}
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-blue-700 transition-all duration-200 shadow-md"
                >
                  Sign in with Google
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
                <div className="flex items-center mb-4 overflow-x-auto">
                  <button
                    onClick={() => handleBreadcrumbClick(0)}
                    className="flex items-center text-blue-600 hover:text-blue-800"
                  >
                    Root
                  </button>
                  {folderPath.map((path, index) => (
                    <span key={path.id} className="flex items-center">
                      <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                      <button
                        onClick={() => handleBreadcrumbClick(index + 1)}
                        className="text-blue-600 hover:text-blue-800 whitespace-nowrap"
                      >
                        {path.name}
                      </button>
                    </span>
                  ))}
                </div>
                
                {/* Folder List */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-60 overflow-y-auto">
                  {currentFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderClick(folder)}
                      className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Folder className="w-8 h-8 text-yellow-500 mb-2" />
                      <span className="text-sm text-center truncate w-full">{folder.name}</span>
                    </button>
                  ))}
                </div>
                
                {folderPath.length > 0 && (
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={() => handleBreadcrumbClick(folderPath.length - 1)}
                      className="flex items-center text-gray-600 hover:text-gray-800"
                    >
                      <ChevronLeft className="w-5 h-5 mr-1" />
                      Back
                    </button>
                    <button
                      onClick={() => {
                        handleSelectCurrentFolder();
                        setIsSelectingFolder(false);
                      }}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-md"
                    >
                      Select This Folder
                    </button>
                  </div>
                )}
              </div>
            )}

            {googleAuth.isSignedIn && !mainSessionsFolder && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-white rounded-lg p-8 shadow-sm"
              >
                <div className="mb-6">
                  <div className="text-6xl mb-4 text-center">📂</div>
                  <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">
                    Select Main Sessions Folder
                  </h2>
                  <p className="text-gray-600 text-center">
                    Choose the folder containing client session folders.
                  </p>
                </div>

                {/* Breadcrumbs */}
                <div className="flex items-center mb-4 overflow-x-auto">
                  <button
                    onClick={() => handleBreadcrumbClick(0)}
                    className="flex items-center text-blue-600 hover:text-blue-800"
                  >
                    Root
                  </button>
                  {folderPath.map((path, index) => (
                    <span key={path.id} className="flex items-center">
                      <ChevronRight className="w-4 h-4 mx-2 text-gray-400" />
                      <button
                        onClick={() => handleBreadcrumbClick(index + 1)}
                        className="text-blue-600 hover:text-blue-800 whitespace-nowrap"
                      >
                        {path.name}
                      </button>
                    </span>
                  ))}
                </div>

                {/* Folder List */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-60 overflow-y-auto">
                  {currentFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => handleFolderClick(folder)}
                      className="flex flex-col items-center p-4 border rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Folder className="w-8 h-8 text-yellow-500 mb-2" />
                      <span className="text-sm text-center truncate w-full">{folder.name}</span>
                    </button>
                  ))}
                </div>

                {folderPath.length > 0 && (
                  <div className="flex justify-between mt-6">
                    <button
                      onClick={() => handleBreadcrumbClick(folderPath.length - 1)}
                      className="flex items-center text-gray-600 hover:text-gray-800"
                    >
                      <ChevronLeft className="w-5 h-5 mr-1" />
                      Back
                    </button>
                    <button
                      onClick={() => {
                        handleSelectCurrentFolder();
                        setIsSelectingFolder(false);
                      }}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-md"
                    >
                      Select This Folder
                    </button>
                  </div>
                )}
              </motion.div>
            )}

          </div>
        )}
      </div>
    </div>
  );
} 