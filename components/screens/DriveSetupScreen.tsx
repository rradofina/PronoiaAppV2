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
  const [isRequestingPermissions, setIsRequestingPermissions] = useState(false);
  const [showTroubleshooting, setShowTroubleshooting] = useState(false);
  const [isPopupOpen, setIsPopupOpen] = useState(false);

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

  const handleRequestDrivePermissions = () => {
    setIsRequestingPermissions(true);
    setShowTroubleshooting(false);
    setIsPopupOpen(true);
    
    // This will be called from the parent component
    if ((window as any).requestDrivePermissions) {
      (window as any).requestDrivePermissions();
    }
    
    // Reset the popup state after a reasonable timeout
    setTimeout(() => {
      setIsPopupOpen(false);
      setIsRequestingPermissions(false);
    }, 30000); // 30 seconds timeout
  };

  const handleTryRedirectMethod = () => {
    if ((window as any).requestDrivePermissionsRedirect) {
      (window as any).requestDrivePermissionsRedirect();
    }
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

                {driveFolders.length === 0 && !isRequestingPermissions ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                    <div className="text-3xl mb-4">⚠️</div>
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">
                      No folders found
                    </h4>
                    <p className="text-gray-600 mb-4">
                      We need permission to access your Google Drive folders.
                    </p>
                    <div className="space-y-3">
                      <button
                        onClick={handleRequestDrivePermissions}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200"
                      >
                        Grant Drive Access
                      </button>
                      
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                        <p className="text-blue-800 font-medium mb-2">📋 What to expect:</p>
                        <ol className="text-blue-700 space-y-1 list-decimal list-inside">
                          <li>A Google popup window will open</li>
                          <li>You'll see your Google account</li>
                          <li>Click <strong>"Continue"</strong> or <strong>"Allow"</strong> when prompted</li>
                          <li><strong>Don't close the popup</strong> - let it finish automatically</li>
                        </ol>
                        <p className="text-blue-600 text-xs mt-2">
                          ⚠️ If the popup closes early, just click "Grant Drive Access" again
                        </p>
                      </div>
                      
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <p className="text-amber-800 text-sm font-medium mb-2">🔄 Alternative Method:</p>
                        <p className="text-amber-700 text-xs mb-3">
                          If the popup keeps closing, try the redirect method instead:
                        </p>
                        <button
                          onClick={handleTryRedirectMethod}
                          className="bg-amber-600 text-white px-4 py-2 rounded text-sm hover:bg-amber-700 transition-all duration-200"
                        >
                          Try Redirect Method
                        </button>
                        <p className="text-amber-600 text-xs mt-2">
                          This will redirect you to Google, then back to the app
                        </p>
                      </div>
                      
                      <div className="flex justify-center space-x-4 text-sm">
                        <button
                          onClick={() => setShowTroubleshooting(!showTroubleshooting)}
                          className="text-blue-600 hover:underline"
                        >
                          Troubleshooting Tips
                        </button>
                        <button
                          onClick={showDebugInfo}
                          className="text-blue-600 hover:underline"
                        >
                          Show Debug Info
                        </button>
                      </div>
                    </div>
                    
                    {showTroubleshooting && (
                      <div className="mt-6 text-left bg-white border border-gray-200 rounded-lg p-4">
                        <h5 className="font-semibold text-gray-800 mb-3">🛠️ Troubleshooting Steps:</h5>
                        <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                          <li><strong>Keep popup open:</strong> Don't close the permission popup manually - let it complete the flow</li>
                          <li><strong>Click "Allow":</strong> When Google asks for Drive permissions, click "Continue" or "Allow"</li>
                          <li><strong>Wait for completion:</strong> The popup should close automatically when done</li>
                          <li><strong>Check popup blockers:</strong> Look for a popup blocker icon in your browser's address bar</li>
                          <li><strong>Browser extensions:</strong> Temporarily disable ad blockers or privacy extensions</li>
                          <li><strong>Try incognito mode:</strong> Open the app in an incognito/private window</li>
                          <li><strong>Different browser:</strong> Try Chrome, Firefox, or Safari</li>
                          <li><strong>Clear cookies:</strong> Clear your browser's cookies for Google.com and try again</li>
                        </ol>
                        <div className="mt-3 p-3 bg-amber-50 rounded border border-amber-200">
                          <p className="text-xs text-amber-800">
                            <strong>🎯 Common Issue:</strong> If you see "Permission popup was closed before completing", it means the popup window closed before you finished granting permissions. Just try again and make sure to complete the entire flow.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ) : isRequestingPermissions ? (
                  <div className="text-center py-8">
                    {isPopupOpen ? (
                      <div className="space-y-4">
                        <div className="text-4xl">🪟</div>
                        <div className="space-y-2">
                          <h4 className="text-lg font-semibold text-gray-800">
                            Permission Popup Open
                          </h4>
                          <p className="text-gray-600">
                            Please check for the Google permission popup window
                          </p>
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                            <p className="text-yellow-800">
                              <strong>👀 Look for:</strong> A popup asking for Google Drive permissions<br/>
                              <strong>✅ Action:</strong> Click "Continue" or "Allow" to grant access<br/>
                              <strong>⚠️ Don't:</strong> Close the popup manually
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="text-gray-600">Requesting permissions...</p>
                      </div>
                    )}
                  </div>
                ) : (
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
                )}
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