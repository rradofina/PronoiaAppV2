import React from 'react';
import { Photo } from '../types';

interface UploadOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUploadTemplates: () => void;
  onUploadPhotos: () => void;
  favoritedPhotos: Photo[];
  isUploading: boolean;
  uploadProgress: {
    current: number;
    total: number;
    message: string;
  } | null;
  photoLimit: number;
  isUnlimitedPhotos: boolean;
}

export default function UploadOptionsModal({
  isOpen,
  onClose,
  onUploadTemplates,
  onUploadPhotos,
  favoritedPhotos,
  isUploading,
  uploadProgress,
  photoLimit,
  isUnlimitedPhotos,
}: UploadOptionsModalProps) {
  if (!isOpen) return null;

  // Calculate button state
  const selectedCount = favoritedPhotos.length;
  const isUnlimited = isUnlimitedPhotos;
  const isOverLimit = !isUnlimited && selectedCount > photoLimit;
  const canUpload = !isUnlimited && selectedCount === photoLimit;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6 shadow-xl">
        {!isUploading ? (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Choose Upload Option</h2>
            <p className="text-gray-600 mb-6">
              Select what you want to upload to Google Drive:
            </p>

            <div className="space-y-4">
              <button
                onClick={onUploadTemplates}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-lg transition-colors duration-200 text-left"
              >
                <div className="flex items-start">
                  <span className="text-2xl mr-3">🖼️</span>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Upload Print Templates</h3>
                    <p className="text-sm opacity-90">
                      Generate and upload print-ready templates with your selected photos
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={onUploadPhotos}
                disabled={!canUpload}
                className={`w-full p-4 rounded-lg transition-colors duration-200 text-left ${
                  canUpload
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                }`}
              >
                <div className="flex items-start">
                  <span className="text-2xl mr-3">📸</span>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Upload Selected Photos</h3>
                    <p className="text-sm opacity-90">
                      {isUnlimited 
                        ? 'All soft copies will be provided by staff'
                        : selectedCount === 0
                          ? `No photos selected (0/${photoLimit})`
                          : selectedCount > photoLimit
                            ? `Too many selected (${selectedCount}/${photoLimit} max)`
                            : selectedCount === photoLimit
                              ? `Upload all ${photoLimit} selected photos ✓`
                              : `Need to select exactly ${photoLimit} photos (${selectedCount}/${photoLimit})`
                      }
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full mt-6 bg-gray-200 hover:bg-gray-300 text-gray-700 px-4 py-2 rounded-lg transition-colors duration-200"
            >
              Cancel
            </button>
          </>
        ) : (
          <div className="text-center">
            <div className="mb-4">
              <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {uploadProgress?.message || 'Uploading...'}
              </h3>
              {uploadProgress && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Progress</span>
                    <span>{uploadProgress.current}/{uploadProgress.total}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(uploadProgress.current / uploadProgress.total) * 100}%`
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            <p className="text-sm text-gray-500">Please wait while we upload your files...</p>
          </div>
        )}
      </div>
    </div>
  );
}