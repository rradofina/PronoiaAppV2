import React, { useState, useEffect } from 'react';
import { DriveFolder, GoogleAuth } from '../../types';
import HeaderNavigation from '../HeaderNavigation';
import googleDriveService from '../../services/googleDriveService';
import { pngTemplateService } from '../../services/pngTemplateService';

interface TemplateFolderSelectionScreenProps {
  googleAuth: GoogleAuth;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
  onBack: () => void;
  onFolderSelected: () => void;
}

export default function TemplateFolderSelectionScreen({
  googleAuth,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
  onBack,
  onFolderSelected
}: TemplateFolderSelectionScreenProps) {
  const [driveFolders, setDriveFolders] = useState<DriveFolder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTemplateFolderId, setCurrentTemplateFolderId] = useState<string | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [folderPath, setFolderPath] = useState<Array<{id: string, name: string}>>([{id: 'root', name: 'My Drive'}]);

  // Load current template folder on mount
  useEffect(() => {
    const loadCurrentFolder = async () => {
      try {
        const folderId = await pngTemplateService.getTemplateFolderId();
        setCurrentTemplateFolderId(folderId);
      } catch (error) {
        console.error('Failed to get current template folder:', error);
      }
    };
    loadCurrentFolder();
  }, []);

  // Load Google Drive folders
  useEffect(() => {
    if (googleAuth.isSignedIn) {
      loadDriveFolders();
    }
  }, [googleAuth.isSignedIn, currentFolderId]);

  const loadDriveFolders = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const folders = await googleDriveService.listFolders(currentFolderId);
      // Convert to DriveFolder format with required fields
      const driveFolders = folders.map(folder => ({
        ...folder,
        createdTime: folder.createdTime || new Date().toISOString(),
        modifiedTime: folder.modifiedTime || new Date().toISOString()
      }));
      setDriveFolders(driveFolders);
    } catch (error) {
      console.error('Failed to load Drive folders:', error);
      setError('Failed to load Google Drive folders. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = (folder: DriveFolder) => {
    setCurrentFolderId(folder.id);
    setFolderPath(prev => [...prev, {id: folder.id, name: folder.name}]);
  };

  const navigateToParent = (targetIndex: number) => {
    const targetFolder = folderPath[targetIndex];
    setCurrentFolderId(targetFolder.id);
    setFolderPath(prev => prev.slice(0, targetIndex + 1));
  };

  const handleFolderSelect = async (folder: DriveFolder) => {
    setIsLoading(true);
    setError(null);
    
    // Add a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      setError('Operation timed out. Please try again.');
    }, 10000); // 10 second timeout
    
    try {
      if (process.env.NODE_ENV === 'development') console.log(`🔧 Step 1: Updating template folder to: ${folder.name} (${folder.id})`);
      // Update the template folder in the database
      await pngTemplateService.setTemplateFolderId(folder.id);
      if (process.env.NODE_ENV === 'development') console.log(`✅ Step 1 complete: Template folder updated`);
      
      if (process.env.NODE_ENV === 'development') console.log(`🔧 Step 2: Clearing template cache...`);
      // Clear template cache so it reloads from new folder
      await pngTemplateService.clearCache();
      if (process.env.NODE_ENV === 'development') console.log(`✅ Step 2 complete: Cache cleared`);
      
      if (process.env.NODE_ENV === 'development') console.log(`🔧 Step 3: Waiting for database propagation...`);
      // Wait a bit longer for database propagation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      if (process.env.NODE_ENV === 'development') console.log(`🔧 Step 4: Verifying folder ID was saved...`);
      // Verify the folder ID was actually saved (with retries)
      let savedFolderId: string;
      let attempts = 0;
      const maxAttempts = 3;
      
      do {
        attempts++;
        if (process.env.NODE_ENV === 'development') console.log(`📁 Verification attempt ${attempts}/${maxAttempts}...`);
        savedFolderId = await pngTemplateService.getTemplateFolderId();
        if (process.env.NODE_ENV === 'development') console.log(`📁 Verification: Saved folder ID is: ${savedFolderId}`);
        
        if (savedFolderId === folder.id) {
          break;
        }
        
        if (attempts < maxAttempts) {
          if (process.env.NODE_ENV === 'development') console.log(`⏳ Folder ID mismatch, waiting 300ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } while (attempts < maxAttempts);
      
      if (savedFolderId !== folder.id) {
        console.error(`❌ ERROR: After ${maxAttempts} attempts, expected ${folder.id} but got ${savedFolderId}!`);
        setError(`Folder ID verification failed. Expected ${folder.id} but got ${savedFolderId}`);
        return;
      }
      
      if (process.env.NODE_ENV === 'development') console.log(`✅ All steps complete, navigating back...`);
      clearTimeout(timeoutId); // Clear timeout on success
      onFolderSelected();
    } catch (error) {
      clearTimeout(timeoutId); // Clear timeout on error
      console.error('❌ Failed to update template folder:', error);
      setError(`Failed to update template folder: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      {/* <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        TemplateFolderSelectionScreen.tsx
      </div> */}

      <HeaderNavigation
        googleAuth={googleAuth}
        mainSessionsFolder={mainSessionsFolder}
        onSignOut={onSignOut}
        onChangeMainFolder={onChangeMainFolder}
        showMainFolder={true}
      />
      
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center space-x-4 mb-4">
              <button
                onClick={onBack}
                className="flex items-center space-x-1 px-3 py-2 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to Templates</span>
              </button>
            </div>
            
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              📂 Template Source Folder
            </h1>
            <p className="text-gray-600 text-base mb-3">
              Select a folder containing PNG templates organized in print size subfolders
            </p>
            <div className="inline-flex items-center text-sm text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-200">
              <span className="mr-1">💡</span>
              Expected structure: 4R/, 5R/, A4/ subfolders with PNG files
            </div>
            
            {/* Breadcrumb Navigation - Compact */}
            <div className="mt-4 flex items-center justify-center space-x-1 text-sm bg-gray-100 rounded-lg px-3 py-2 max-w-md mx-auto">
              {folderPath.map((pathItem, index) => (
                <React.Fragment key={pathItem.id}>
                  {index > 0 && <span className="text-gray-400 mx-1">→</span>}
                  <button
                    onClick={() => navigateToParent(index)}
                    className={`px-2 py-1 rounded transition-colors min-w-0 truncate ${
                      index === folderPath.length - 1
                        ? 'text-gray-800 bg-gray-200 font-medium'
                        : 'text-blue-600 hover:text-blue-800 hover:bg-blue-100'
                    }`}
                    disabled={index === folderPath.length - 1}
                    title={pathItem.name}
                  >
                    {pathItem.name.length > 20 ? pathItem.name.substring(0, 20) + '...' : pathItem.name}
                  </button>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-600">
                  {isLoading ? 'Updating template folder...' : 'Loading folders...'}
                </span>
              </div>
            </div>
          ) : (
            /* Folders Grid */
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {driveFolders.map((folder) => (
                  <div
                    key={folder.id}
                    onDoubleClick={() => navigateToFolder(folder)}
                    className={`rounded-lg p-4 transition-all duration-200 border-2 ${
                      currentTemplateFolderId === folder.id
                        ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-500'
                        : 'bg-gray-50 border-transparent hover:bg-blue-50 hover:border-blue-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center flex-1">
                        <div className="text-2xl mr-3">
                          {currentTemplateFolderId === folder.id ? '📂✅' : '📁'}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-800">{folder.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(folder.createdTime).toLocaleDateString()}
                          </p>
                          {currentTemplateFolderId === folder.id && (
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              Currently Selected
                            </p>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => navigateToFolder(folder)}
                          className="px-2 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                          title="Browse into folder"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleFolderSelect(folder)}
                          className={`px-3 py-1 text-xs rounded transition-colors ${
                            currentTemplateFolderId === folder.id
                              ? 'bg-green-600 text-white'
                              : 'bg-blue-600 text-white hover:bg-blue-700'
                          }`}
                          disabled={isLoading}
                        >
                          {currentTemplateFolderId === folder.id ? 'Selected' : 'Select'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {driveFolders.length === 0 && !isLoading && (
                <div className="text-center py-8 text-gray-500">
                  No folders found in your Google Drive
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}