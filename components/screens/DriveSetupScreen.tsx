import { useState } from 'react';
import { GoogleAuth, DriveFolder } from '../../types';

interface DriveSetupScreenProps {
  isGapiLoaded: boolean;
  googleAuth: GoogleAuth;
  driveFolders: DriveFolder[];
  handleGoogleSignIn: () => void;
  handleDemoMode: () => void;
  handleMainFolderSelect: (folder: DriveFolder) => void;
  handleDemoFolderSelect: (folder: DriveFolder) => void;
  showDebugInfo: () => void;
  debugInfo: string;
  setDebugInfo: (info: string) => void;
  mainSessionsFolder: { id: string; name: string } | null;
  handleSignOut: () => void;
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
  debugInfo,
  setDebugInfo,
  mainSessionsFolder,
  handleSignOut,
}: DriveSetupScreenProps) {
  const [isSelectingFolder, setIsSelectingFolder] = useState(false);

  const handleSelectFolder = () => {
    setIsSelectingFolder(true);
  };

  const handleCancelSelectFolder = () => {
    setIsSelectingFolder(false);
  };

  const handleFolderSelected = (folder: DriveFolder) => {
    handleMainFolderSelect(folder);
    setIsSelectingFolder(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Pronoia Photo Studio
          </h1>
          <p className="text-gray-600 text-lg mb-8">
            Connect to Google Drive to access your photo sessions
          </p>
        </div>

        {!isGapiLoaded ? (
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading Google Drive...</p>
          </div>
        ) : !googleAuth.isSignedIn ? (
          <div className="space-y-6">
            {/* Google Sign In */}
            <div className="bg-white rounded-lg p-8 shadow-sm text-center">
              <div className="mb-6">
                <div className="text-6xl mb-4">📁</div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                  Connect Google Drive
                </h2>
                <p className="text-gray-600">
                  Sign in to access your photo folders and client sessions
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
              <div className="mt-4">
                <button
                  onClick={showDebugInfo}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg text-sm hover:bg-gray-600 transition-all duration-200"
                >
                  🔍 Debug Info
                </button>
              </div>
            </div>

            {/* Demo Mode Option */}
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
              <div className="text-center">
                <div className="text-4xl mb-4">🎭</div>
                <h2 className="text-2xl font-semibold text-gray-800 mb-2">
                  Demo Mode
                </h2>
                <p className="text-gray-600 mb-4">
                  Try the app with sample photos and folders
                </p>
                <button
                  onClick={handleDemoMode}
                  className="bg-yellow-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-yellow-700 transition-all duration-200 shadow-md"
                >
                  Try Demo Mode
                </button>
              </div>
            </div>

            {/* Debug Info Display */}
            {debugInfo && (
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 mt-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-2">🔍 Debug Information</h4>
                <pre className="text-xs text-gray-700 whitespace-pre-wrap font-mono max-h-96 overflow-y-auto">
                  {debugInfo}
                </pre>
                <button
                  onClick={() => setDebugInfo('')}
                  className="mt-2 bg-red-500 text-white px-3 py-1 rounded text-xs hover:bg-red-600"
                >
                  Close Debug
                </button>
              </div>
            )}
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
                    onClick={handleSelectFolder}
                    className="bg-blue-100 text-blue-700 px-4 py-2 rounded-lg font-medium text-sm hover:bg-blue-200 transition-all duration-200"
                  >
                    Change
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-6">
                <h3 className="text-xl font-semibold text-gray-800 mb-4">
                  Select Main Photo Folder
                </h3>
                <p className="text-gray-600 mb-4">
                  Choose the main folder that contains all your client photo sessions
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {driveFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => googleAuth.userEmail === 'demo@example.com' ? handleDemoFolderSelect(folder) : handleFolderSelected(folder)}
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
                {isSelectingFolder && (
                  <div className="text-center mt-4">
                    <button
                      onClick={handleCancelSelectFolder}
                      className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
                    >
                      Cancel
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