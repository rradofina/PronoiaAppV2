import React, { useEffect, useState } from 'react';
import AdminLayout from '../../../components/admin/AdminLayout';
import { PngTemplate, pngTemplateService } from '../../../services/pngTemplateService';
import { PrintSize } from '../../../types';
import { PRINT_SIZES } from '../../../utils/constants';
import googleDriveService from '../../../services/googleDriveService';
import useAuthStore from '../../../stores/authStore';
import TemplateExportModal from '../../../components/TemplateExportModal';
import TemplateImportModal from '../../../components/TemplateImportModal';

interface PngTemplateCardProps {
  template: PngTemplate;
  onRefresh: () => void;
}

function PngTemplateCard({ template, onRefresh }: PngTemplateCardProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Template Preview */}
      <div className="aspect-[3/4] bg-gray-100 relative flex items-center justify-center border-b border-gray-200">
        <div className="text-center p-4">
          <img 
            src={template.pngUrl}
            alt={template.name}
            className="max-w-full max-h-full object-contain rounded"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
              (e.target as HTMLImageElement).nextElementSibling!.classList.remove('hidden');
            }}
          />
          <div className="hidden text-center">
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-sm text-gray-600">{template.holes.length} holes</p>
          </div>
        </div>
      </div>

      {/* Template Info */}
      <div className="p-4">
        <h3 className="font-medium text-gray-800 mb-1 truncate">{template.name}</h3>
        <p className="text-sm text-gray-600 mb-2">
          {template.templateType} • {template.holes.length} photo slots
        </p>
        
        <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
          <span className="bg-gray-100 px-2 py-1 rounded">{template.printSize}</span>
          <span>{template.dimensions.width}×{template.dimensions.height}</span>
        </div>
        
        <div className="text-xs text-gray-400">
          Updated: {new Date(template.lastUpdated).toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

export default function PngTemplateManagement() {
  const [templates, setTemplates] = useState<PngTemplate[]>([]);
  const [selectedPrintSize, setSelectedPrintSize] = useState<PrintSize>('4R');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [folderInfo, setFolderInfo] = useState<{id: string; name: string; url: string} | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  
  const { googleAuth } = useAuthStore();

  // Initialize Google Drive service with stored authentication
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check if we have stored authentication
        const storedToken = localStorage.getItem('google_access_token');
        
        if (storedToken && googleAuth.isSignedIn) {
          console.log('🔑 Initializing Google Drive service with stored token');
          await googleDriveService.initialize();
          googleDriveService.setAccessToken(storedToken);
          setIsInitialized(true);
        } else {
          console.warn('⚠️ No stored authentication found - user needs to sign in first');
          setError('Please sign in to Google Drive first from the main application');
        }
      } catch (error) {
        console.error('Failed to initialize Google Drive service:', error);
        setError('Failed to initialize Google Drive authentication');
      }
    };

    initializeAuth();
  }, [googleAuth]);

  const loadTemplates = async (forceRefresh = false) => {
    if (!isInitialized) {
      setError('Google Drive authentication not initialized');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const allTemplates = await pngTemplateService.loadTemplates(forceRefresh);
      setTemplates(allTemplates.filter(t => t.printSize === selectedPrintSize));
      
      // Also get folder info
      const info = await pngTemplateService.getTemplateFolderInfo();
      setFolderInfo(info);
    } catch (err: any) {
      setError(err.message || 'Failed to load PNG templates');
      console.error('Failed to load templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshTemplates = () => {
    loadTemplates(true); // Force refresh
  };

  const handleClearCache = async () => {
    setIsLoading(true);
    try {
      await pngTemplateService.clearCache();
      await loadTemplates(true);
    } catch (err: any) {
      setError(err.message || 'Failed to clear cache');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isInitialized) {
      loadTemplates();
    }
  }, [selectedPrintSize, isInitialized]);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">PNG Template Management</h1>
            <p className="text-gray-600">
              Templates automatically detected from Google Drive with magenta (#FF00FF) photo holes
            </p>
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={() => setShowExportModal(true)}
              disabled={isLoading}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <span>📤</span>
              <span>Export Templates</span>
            </button>
            
            <button
              onClick={() => setShowImportModal(true)}
              disabled={isLoading}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <span>📥</span>
              <span>Import Templates</span>
            </button>
            
            <button
              onClick={handleRefreshTemplates}
              disabled={isLoading}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <span>🔄</span>
              <span>{isLoading ? 'Refreshing...' : 'Refresh Templates'}</span>
            </button>
            
            <button
              onClick={handleClearCache}
              disabled={isLoading}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <span>🗑️</span>
              <span>Clear Cache</span>
            </button>
          </div>
        </div>

        {/* Google Drive Folder Info */}
        {folderInfo && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-800">Template Source Folder</h3>
                <p className="text-sm text-blue-600">📁 {folderInfo.name}</p>
              </div>
              <a
                href={folderInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition-colors text-sm"
              >
                Open in Google Drive
              </a>
            </div>
          </div>
        )}

        {/* Error Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-red-700">{error}</span>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">Print Size:</label>
            <div className="flex space-x-2">
              {Object.keys(PRINT_SIZES).map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedPrintSize(size as PrintSize)}
                  className={`px-3 py-1 text-sm rounded border transition-colors ${
                    selectedPrintSize === size
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Auto-Detection Info */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-medium text-green-800 mb-2">📤 How to Add New Templates</h3>
          <div className="text-sm text-green-700 space-y-1">
            <p>1. Create PNG files with <strong>magenta (#FF00FF)</strong> areas marking photo placement holes</p>
            <p>2. Upload to the appropriate Google Drive folder: <strong>{selectedPrintSize}/</strong></p>
            <p>3. Templates are auto-detected with 5-minute cache, or click "Refresh Templates" for immediate detection</p>
          </div>
        </div>

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-gray-600">
                {isLoading && templates.length === 0 ? 'Loading templates...' : 'Refreshing templates...'}
              </p>
            </div>
          </div>
        ) : templates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">🖼️</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No PNG Templates Found</h3>
            <p className="text-gray-600 mb-6">
              Upload PNG files with magenta holes to the {selectedPrintSize} folder in Google Drive.
            </p>
            {folderInfo && (
              <a
                href={folderInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-block"
              >
                Open Google Drive Folder
              </a>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-600">
                Found {templates.length} template{templates.length !== 1 ? 's' : ''} for {selectedPrintSize}
              </p>
              <div className="text-xs text-gray-500">
                Cache updates every 5 minutes or when refreshed manually
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {templates.map((template) => (
                <PngTemplateCard
                  key={template.id}
                  template={template}
                  onRefresh={handleRefreshTemplates}
                />
              ))}
            </div>
          </div>
        )}

        {/* Export Modal */}
        <TemplateExportModal
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
        />

        {/* Import Modal */}
        <TemplateImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={(result) => {
            if (result.importedCount > 0) {
              // Refresh templates after successful import
              handleRefreshTemplates();
            }
          }}
        />
      </div>
    </AdminLayout>
  );
}