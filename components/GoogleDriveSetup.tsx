// Updated: Google Drive setup component
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { googleDriveService } from '../services/googleDriveService';
import useAppStore from '../stores/useAppStore';

interface GoogleDriveSetupProps {
  onComplete: () => void;
}

interface DriveFolder {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

export default function GoogleDriveSetup({ onComplete }: GoogleDriveSetupProps) {
  const { setMainSessionsFolder, setLoading } = useAppStore();
  const [folders, setFolders] = useState<DriveFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [isLoadingFolders, setIsLoadingFolders] = useState(false);

  const loadFolders = async (parentId?: string) => {
    setIsLoadingFolders(true);
    try {
      const folderList = await googleDriveService.listFolders(parentId);
      setFolders(folderList);
    } catch (error) {
      console.error('Failed to load folders:', error);
      toast.error('Failed to load folders');
    } finally {
      setIsLoadingFolders(false);
    }
  };

  const handleFolderClick = async (folder: DriveFolder) => {
    if (selectedFolderId === folder.id) {
      // Double-click to enter folder
      setCurrentPath([...currentPath, folder.name]);
      await loadFolders(folder.id);
      setSelectedFolderId('');
    } else {
      // Single click to select
      setSelectedFolderId(folder.id);
    }
  };

  const handleBackClick = async () => {
    if (currentPath.length > 0) {
      const newPath = currentPath.slice(0, -1);
      setCurrentPath(newPath);
      
      // Go back to parent folder
      const parentId = newPath.length > 0 ? undefined : 'root'; // Simplified for now
      await loadFolders(parentId);
      setSelectedFolderId('');
    }
  };

  const handleSetAsMainFolder = async () => {
    if (!selectedFolderId) {
      toast.error('Please select a folder');
      return;
    }

    const selectedFolder = folders.find(f => f.id === selectedFolderId);
    if (!selectedFolder) {
      toast.error('Selected folder not found');
      return;
    }

    try {
      setLoading(true, 'Setting up main sessions folder...');
      
      // Set as main sessions folder
      setMainSessionsFolder({
        id: selectedFolder.id,
        name: selectedFolder.name,
      });
      
      toast.success(`"${selectedFolder.name}" is now your main Sessions folder`);
      onComplete();
    } catch (error) {
      console.error('Failed to set main folder:', error);
      toast.error('Failed to set main folder');
    } finally {
      setLoading(false);
    }
  };

  const handleStartBrowsing = async () => {
    await loadFolders();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Setup Main Sessions Folder
        </h2>
        <p className="text-gray-600">
          Select the main folder in your Google Drive where all your photoshoot sessions are stored.
          This is a one-time setup that will make selecting sessions easier.
        </p>
      </motion.div>

      {folders.length === 0 ? (
        // Initial state - show browse button
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-8"
        >
          <button
            onClick={handleStartBrowsing}
            disabled={isLoadingFolders}
            className="btn-primary text-lg px-8 py-3"
          >
            {isLoadingFolders ? 'Loading...' : 'Browse Google Drive'}
          </button>
        </motion.div>
      ) : (
        // Show folder browser
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Breadcrumb */}
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <span>My Drive</span>
            {currentPath.map((folder, index) => (
              <span key={index} className="flex items-center">
                <svg className="w-4 h-4 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
                {folder}
              </span>
            ))}
          </div>

          {/* Back button */}
          {currentPath.length > 0 && (
            <button
              onClick={handleBackClick}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back</span>
            </button>
          )}

          {/* Folders list */}
          <div className="border rounded-lg bg-white max-h-96 overflow-y-auto">
            {isLoadingFolders ? (
              <div className="p-8 text-center text-gray-500">
                Loading folders...
              </div>
            ) : folders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No folders found
              </div>
            ) : (
              folders.map((folder) => (
                <div
                  key={folder.id}
                  onClick={() => handleFolderClick(folder)}
                  className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 flex items-center space-x-3 ${
                    selectedFolderId === folder.id ? 'bg-blue-50 border-blue-200' : ''
                  }`}
                >
                  <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0l-2 3H2v18h20V3h-8l-2-3z" />
                  </svg>
                  <span className="flex-1 font-medium text-gray-900">
                    {folder.name}
                  </span>
                  {selectedFolderId === folder.id && (
                    <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Action buttons */}
          <div className="flex justify-between items-center pt-4">
            <p className="text-sm text-gray-600">
              {selectedFolderId ? 'Click "Set as Main Folder" to continue' : 'Click a folder to select it, double-click to enter'}
            </p>
            <button
              onClick={handleSetAsMainFolder}
              disabled={!selectedFolderId}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Set as Main Folder
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
} 