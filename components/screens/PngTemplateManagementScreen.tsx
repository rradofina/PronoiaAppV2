import React, { useEffect, useState } from 'react';
import { ManualTemplate } from '../../types';
import { manualTemplateService } from '../../services/manualTemplateService';
import { GoogleAuth } from '../../types';
import HeaderNavigation from '../HeaderNavigation';

interface TemplateCardProps {
  template: ManualTemplate;
  onRefresh: () => void;
  onEdit: (template: ManualTemplate) => void;
}

function TemplateCard({ template, onRefresh, onEdit }: TemplateCardProps) {
  const [blobUrl, setBlobUrl] = React.useState<string | null>(null);
  const [imageError, setImageError] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);

  // Download template as blob to avoid CORS issues
  React.useEffect(() => {
    const downloadTemplate = async () => {
      try {
        setIsLoading(true);
        setImageError(false);
        
        // Validate file ID before attempting download
        const fileId = template.drive_file_id;
        if (!fileId || fileId === 'undefined' || fileId === 'null' || fileId.length < 10) {
          console.warn('Invalid file ID for template:', template.name, 'ID:', fileId);
          setImageError(true);
          setIsLoading(false);
          return;
        }
        
        const { googleDriveService } = await import('../../services/googleDriveService');
        
        // Test if we're authenticated first
        if (!googleDriveService.isSignedIn()) {
          console.warn('Google Drive not authenticated, skipping template preview');
          setImageError(true);
          setIsLoading(false);
          return;
        }
        
        console.log('📥 Downloading template preview:', template.name, 'ID:', fileId);
        const blob = await googleDriveService.downloadTemplate(fileId);
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to download template preview:', template.name, error);
        setImageError(true);
        setIsLoading(false);
      }
    };

    downloadTemplate();

    // Cleanup function to revoke blob URL
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [template.drive_file_id, template.name]);

  const handleToggleActive = async () => {
    try {
      if (template.is_active) {
        await manualTemplateService.deactivateTemplate(template.id);
      } else {
        await manualTemplateService.activateTemplate(template.id);
      }
      onRefresh();
    } catch (error) {
      console.error('Failed to toggle template status:', error);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${template.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await manualTemplateService.deleteTemplate(template.id);
      onRefresh();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  return (
    <div className={`bg-white rounded-lg border-2 p-4 transition-all duration-200 ${
      template.is_active 
        ? 'border-green-200 shadow-sm' 
        : 'border-gray-200 opacity-60'
    }`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h3 className="font-medium text-gray-800">{template.name}</h3>
            {template.is_active && (
              <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                ACTIVE
              </span>
            )}
          </div>
          {template.description && (
            <p className="text-sm text-gray-600 mb-2">{template.description}</p>
          )}
          <div className="flex items-center space-x-3 text-xs text-gray-500">
            <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {template.template_type}
            </span>
            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
              {template.print_size}
            </span>
            <span>{template.holes_data?.length || 0} holes</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-1 ml-3">
          <button
            onClick={() => onEdit(template)}
            className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
            title="Edit Template"
          >
            ✏️
          </button>
          <button
            onClick={handleToggleActive}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              template.is_active
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={template.is_active ? 'Deactivate' : 'Activate'}
          >
            {template.is_active ? '✓' : '○'}
          </button>
          <button
            onClick={handleDelete}
            className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
            title="Delete Template"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Template Preview */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ aspectRatio: '4/6' }}>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
          </div>
        )}
        
        {imageError && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-sm text-center px-2">Preview not available</p>
            <p className="text-xs text-center px-2 mt-1">
              {template.drive_file_id ? 'Download failed' : 'No file ID'}
            </p>
          </div>
        )}
        
        {blobUrl && !imageError && (
          <img 
            src={blobUrl}
            alt={template.name}
            className="w-full h-full object-contain"
            onLoad={() => setIsLoading(false)}
            onError={() => {
              setImageError(true);
              setIsLoading(false);
            }}
          />
        )}
        
        {/* Hole Count Overlay */}
        {template.holes_data && template.holes_data.length > 0 && (
          <div className="absolute top-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            {template.holes_data.length} holes
          </div>
        )}
      </div>

      <div className="text-xs text-gray-400 mt-2">
        Created: {new Date(template.created_at).toLocaleDateString()}
        {template.created_by && ` by ${template.created_by}`}
      </div>
    </div>
  );
}

interface PngTemplateManagementScreenProps {
  googleAuth: GoogleAuth;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
  onBack: () => void;
  onChangeTemplateFolder: () => void;
  onManualTemplateManager?: () => void; // Navigate to manual template manager
  refreshTrigger?: number; // Add trigger to force refresh
}

export default function PngTemplateManagementScreen({
  googleAuth,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
  onBack,
  onChangeTemplateFolder,
  onManualTemplateManager,
  refreshTrigger
}: PngTemplateManagementScreenProps) {
  const [templates, setTemplates] = useState<ManualTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<ManualTemplate | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    drive_file_id: '',
    template_type: 'solo' as 'solo' | 'collage' | 'photocard' | 'photostrip',
    print_size: '4R' as '4R' | '5R' | 'A4'
  });

  const loadTemplates = async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);
    
    try {
      if (forceRefresh) {
        manualTemplateService.clearCache();
      }
      
      const allTemplates = await manualTemplateService.getAllTemplates();
      setTemplates(allTemplates);
      
      console.log(`✅ Loaded ${allTemplates.length} templates`);
    } catch (err: any) {
      console.error('❌ Error loading templates:', err);
      setError(err.message || 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };

  // Load templates on mount and when refresh trigger changes
  useEffect(() => {
    loadTemplates(true);
  }, [refreshTrigger]);

  const handleRefresh = () => {
    loadTemplates(true);
  };

  const handleEdit = (template: ManualTemplate) => {
    setEditingTemplate(template);
    setEditForm({
      name: template.name,
      description: template.description || '',
      drive_file_id: template.drive_file_id,
      template_type: template.template_type,
      print_size: template.print_size
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate) return;

    try {
      await manualTemplateService.updateTemplate(editingTemplate.id, {
        name: editForm.name,
        description: editForm.description,
        drive_file_id: editForm.drive_file_id,
        template_type: editForm.template_type,
        print_size: editForm.print_size
      });
      
      setEditingTemplate(null);
      handleRefresh();
    } catch (error) {
      console.error('Failed to update template:', error);
      alert('Failed to update template. Please try again.');
    }
  };

  const handleCancelEdit = () => {
    setEditingTemplate(null);
    setEditForm({
      name: '',
      description: '',
      drive_file_id: '',
      template_type: 'solo',
      print_size: '4R'
    });
  };

  const activeTemplates = templates.filter(t => t.is_active);
  const inactiveTemplates = templates.filter(t => !t.is_active);

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderNavigation
        googleAuth={googleAuth}
        mainSessionsFolder={mainSessionsFolder}
        onSignOut={onSignOut}
        onChangeMainFolder={onChangeMainFolder}
        showMainFolder={true}
      />
      
      <div className="p-4">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center space-x-4 mb-2">
                <button
                  onClick={onBack}
                  className="flex items-center space-x-1 px-3 py-2 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all duration-200"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>
                <h1 className="text-2xl font-bold text-gray-800">Template Management</h1>
              </div>
              <p className="text-gray-600">
                Manage your custom templates for photo layouts
              </p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleRefresh}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                disabled={isLoading}
              >
                🔄 Refresh
              </button>
              {onManualTemplateManager && (
                <button
                  onClick={onManualTemplateManager}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  + Create Template
                </button>
              )}
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-3">
                <svg className="w-6 h-6 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-gray-600">Loading templates...</span>
              </div>
            </div>
          )}

          {/* Templates Display */}
          {!isLoading && !error && (
            <>
              {templates.length > 0 ? (
                <div className="space-y-8">
                  {/* Active Templates */}
                  {activeTemplates.length > 0 && (
                    <div>
                      <h2 className="text-xl font-semibold text-gray-800 mb-4">
                        Active Templates ({activeTemplates.length})
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {activeTemplates.map((template) => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            onRefresh={handleRefresh}
                            onEdit={handleEdit}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Inactive Templates */}
                  {inactiveTemplates.length > 0 && (
                    <div>
                      <h2 className="text-xl font-semibold text-gray-600 mb-4">
                        Inactive Templates ({inactiveTemplates.length})
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {inactiveTemplates.map((template) => (
                          <TemplateCard
                            key={template.id}
                            template={template}
                            onRefresh={handleRefresh}
                            onEdit={handleEdit}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🖼️</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Templates Found</h3>
                  <p className="text-gray-600 mb-4">
                    Create your first template to get started.
                  </p>
                  {onManualTemplateManager && (
                    <button
                      onClick={onManualTemplateManager}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Create First Template
                    </button>
                  )}
                </div>
              )}

              {/* Statistics */}
              {templates.length > 0 && (
                <div className="text-center text-gray-500 text-sm border-t border-gray-200 pt-4">
                  Total: {templates.length} template{templates.length === 1 ? '' : 's'} 
                  ({activeTemplates.length} active, {inactiveTemplates.length} inactive)
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-800">Edit Template</h2>
                <button
                  onClick={handleCancelEdit}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Template Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Name *
                  </label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({...editForm, description: e.target.value})}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Google Drive File ID */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Google Drive File ID *
                  </label>
                  <input
                    type="text"
                    value={editForm.drive_file_id}
                    onChange={(e) => setEditForm({...editForm, drive_file_id: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 1abC2dEf3GhI4jKl5MnO6pQr7StU8vWx"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Extract from Google Drive URL: ...drive.google.com/file/d/<strong>FILE_ID</strong>/view
                  </p>
                </div>

                {/* Template Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Template Type *
                  </label>
                  <select
                    value={editForm.template_type}
                    onChange={(e) => setEditForm({...editForm, template_type: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="solo">Solo (1 photo)</option>
                    <option value="collage">Collage (4 photos)</option>
                    <option value="photocard">Photocard (4 photos, edge-to-edge)</option>
                    <option value="photostrip">Photo Strip (6 photos)</option>
                  </select>
                </div>

                {/* Print Size */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Print Size *
                  </label>
                  <select
                    value={editForm.print_size}
                    onChange={(e) => setEditForm({...editForm, print_size: e.target.value as any})}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="4R">4R (1200x1800px)</option>
                    <option value="5R">5R (1500x2100px)</option>
                    <option value="A4">A4 (2480x3508px)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  disabled={!editForm.name || !editForm.drive_file_id}
                  className={`px-4 py-2 rounded-md transition-colors ${
                    editForm.name && editForm.drive_file_id
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}