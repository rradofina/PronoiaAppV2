import { DriveFolder, GoogleAuth } from '../../types';
import { useState } from 'react';

interface DriveSetupScreenProps {
  isGapiLoaded: boolean;
  googleAuth: GoogleAuth;
  driveFolders: DriveFolder[];
  handleGoogleSignIn: () => void;
  handleDemoMode: () => void;
  handleMainFolderSelect: (folder: DriveFolder) => void;
  handleDemoFolderSelect: (folder: DriveFolder) => void;
  showDebugInfo: () => void;
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
  handleDemoMode,
  handleMainFolderSelect,
  handleDemoFolderSelect,
  showDebugInfo,
  mainSessionsFolder,
  handleSignOut,
  isConnecting,
  isRestoringAuth = false,
}: DriveSetupScreenProps) {
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);
  
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

            {/* Demo Mode Option */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="text-center">
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                  Demo Mode
                </h2>
                <p className="text-gray-600 mb-4">
                  Or, try the app with sample photos and folders
                </p>
                <button
                  onClick={handleDemoMode}
                  className="bg-yellow-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-yellow-700 transition-all duration-200 shadow-md"
                >
                  Try Demo Mode
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
                
                {driveFolders.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                    {driveFolders.map((folder) => (
                      <div
                        key={folder.id}
                        onClick={() => {
                          googleAuth.userEmail === 'demo@example.com' ? handleDemoFolderSelect(folder) : handleMainFolderSelect(folder);
                          setIsSelectingFolder(false);
                        }}
                        className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-blue-50 hover:border-blue-300 border-2 border-transparent transition-all duration-200"
                      >
                        <div className="flex items-center">
                          <div className="text-2xl mr-3">📁</div>
                          <div>
                            <p className="font-medium text-gray-800">{folder.name}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(folder.createdTime).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="text-3xl mb-4">📂</div>
                    <p className="text-gray-600">No folders found in your Google Drive root.</p>
                    <p className="text-gray-600 text-sm mt-2">Please create a folder in your Drive and refresh this page.</p>
                  </div>
                )}

                {isSelectingFolder && (
                  <div className="text-center mt-4">
                    <button
                      onClick={() => setIsSelectingFolder(false)}
                      className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 text-center">
              <button
                onClick={showDebugInfo}
                className="text-sm text-blue-600 hover:underline"
              >
                Show Debug Info
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 