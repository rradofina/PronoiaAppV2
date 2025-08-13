import React, { useState, useEffect } from 'react';
import { pngTemplateService } from '../../services/pngTemplateService';
import { supabase } from '../../lib/supabase/client';
import { useAlert } from '../../contexts/AlertContext';

interface TemplateSetupScreenProps {
  onComplete: () => void;
  onBack: () => void;
}

export default function TemplateSetupScreen({ onComplete, onBack }: TemplateSetupScreenProps) {
  const [folderId, setFolderId] = useState('');
  const [folderUrl, setFolderUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);
  const { showError, showSuccess, showInfo } = useAlert();

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'template_folder_id')
        .single();

      if (data?.value) {
        setFolderId(data.value);
        setFolderUrl(`https://drive.google.com/drive/folders/${data.value}`);
      }
    } catch (error) {
      console.log('No settings found yet');
    }
  };

  const extractFolderIdFromUrl = (url: string) => {
    const match = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : url;
  };

  const handleSave = async () => {
    const cleanId = extractFolderIdFromUrl(folderUrl || folderId);
    
    if (!cleanId) {
      showError('Invalid Input', 'Please enter a valid Google Drive folder ID or URL');
      return;
    }

    setIsLoading(true);
    try {
      await pngTemplateService.setTemplateFolderId(cleanId);
      setFolderId(cleanId);
      setFolderUrl(`https://drive.google.com/drive/folders/${cleanId}`);
      
      // Load templates to verify
      const loadedTemplates = await pngTemplateService.loadTemplates(true);
      setTemplates(loadedTemplates);
      
      if (loadedTemplates.length > 0) {
        showSuccess('Templates Loaded', `Found ${loadedTemplates.length} templates. You can now continue.`);
      } else {
        showInfo('No Templates Found', 'Templates saved but no PNG files found in 4R folder. Please add templates.');
      }
    } catch (error) {
      console.error('Error saving folder ID:', error);
      showError('Configuration Failed', 'Failed to configure template folder: ' + (error instanceof Error ? error.message : String(error)));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        TemplateSetupScreen.tsx
      </div>
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            📐 Template Setup Required
          </h1>
          <p className="text-gray-600 mb-8">
            Configure your Google Drive folder containing PNG templates to continue.
          </p>

          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-4">Configure Template Folder</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Google Drive Folder URL or ID
                  </label>
                  <input
                    type="text"
                    value={folderUrl || folderId}
                    onChange={(e) => {
                      const value = e.target.value;
                      setFolderUrl(value);
                      const cleanId = extractFolderIdFromUrl(value);
                      setFolderId(cleanId);
                    }}
                    placeholder="https://drive.google.com/drive/folders/1ABC123... or just the folder ID"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={isLoading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {isLoading ? 'Loading Templates...' : 'Save & Load Templates'}
                </button>
              </div>
            </div>

            {/* Required Folder Structure */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-800 mb-2">📁 Required Folder Structure</h3>
              <div className="text-blue-700 text-sm font-mono">
                📁 Your Template Folder<br/>
                &nbsp;&nbsp;└── 📁 4R<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 🖼️ solo-template-1.png<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 🖼️ collage-template-1.png<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;├── 🖼️ photo-card-template-1.png<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;└── 🖼️ photo-strip-template-1.png
              </div>
            </div>

            {/* Templates Display */}
            {templates.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">✅ Found Templates ({templates.length})</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  {templates.map((template) => (
                    <div key={template.id} className="border rounded-lg p-3 bg-gray-50 text-center">
                      <div className="text-lg mb-1">🖼️</div>
                      <div className="text-sm font-medium text-gray-800">{template.name}</div>
                      <div className="text-xs text-gray-600">{template.holes.length} photos</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between pt-4">
              <button
                onClick={onBack}
                className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50"
              >
                ← Back to Packages
              </button>
              {templates.length > 0 && (
                <button
                  onClick={onComplete}
                  className="px-8 py-3 rounded-lg font-medium text-lg bg-blue-600 text-white hover:bg-blue-700"
                >
                  Continue with Templates →
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}