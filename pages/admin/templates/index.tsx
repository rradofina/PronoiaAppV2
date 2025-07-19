import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../../components/admin/AdminLayout';
import { useAdminStore } from '../../../stores/adminStore';
import { CustomTemplate, PrintSize } from '../../../types';
import { PRINT_SIZES } from '../../../utils/constants';

interface TemplateCardProps {
  template: CustomTemplate;
  onEdit: (template: CustomTemplate) => void;
  onDuplicate: (template: CustomTemplate) => void;
  onDelete: (template: CustomTemplate) => void;
}

function TemplateCard({ template, onEdit, onDuplicate, onDelete }: TemplateCardProps) {
  const [showActions, setShowActions] = useState(false);

  return (
    <div 
      className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Template Preview */}
      <div className="aspect-[3/4] bg-gray-100 relative flex items-center justify-center border-b border-gray-200">
        <div className="text-center p-4">
          <div className="text-4xl mb-2">📐</div>
          <p className="text-sm text-gray-600">{template.photo_slots.length} slots</p>
        </div>
        
        {/* Action buttons overlay */}
        {showActions && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center space-x-2">
            <button
              onClick={() => onEdit(template)}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Edit
            </button>
            <button
              onClick={() => onDuplicate(template)}
              className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
            >
              Duplicate
            </button>
            <button
              onClick={() => onDelete(template)}
              className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
            >
              Delete
            </button>
          </div>
        )}
      </div>

      {/* Template Info */}
      <div className="p-4">
        <h3 className="font-medium text-gray-800 mb-1 truncate">{template.name}</h3>
        <p className="text-sm text-gray-600 mb-2 line-clamp-2">{template.description}</p>
        
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="bg-gray-100 px-2 py-1 rounded">{template.print_size}</span>
          <span>{template.orientation}</span>
        </div>
        
        {template.tags && template.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {template.tags.slice(0, 2).map((tag, index) => (
              <span key={index} className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {tag}
              </span>
            ))}
            {template.tags.length > 2 && (
              <span className="text-xs text-gray-500">+{template.tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function TemplateManagement() {
  const {
    customTemplates,
    selectedPrintSize,
    isLoading,
    error,
    successMessage,
    loadCustomTemplates,
    setSelectedPrintSize,
    deleteCustomTemplate,
    duplicateCustomTemplate,
    clearMessages,
  } = useAdminStore();

  const [deleteConfirm, setDeleteConfirm] = useState<CustomTemplate | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateTemplate, setDuplicateTemplate] = useState<CustomTemplate | null>(null);

  useEffect(() => {
    loadCustomTemplates(selectedPrintSize);
  }, [selectedPrintSize]);

  const handleEdit = (template: CustomTemplate) => {
    // Navigate to template builder in edit mode
    window.location.href = `/admin/templates/builder?mode=edit&id=${template.id}`;
  };

  const handleDuplicate = (template: CustomTemplate) => {
    setDuplicateTemplate(template);
    setDuplicateName(`${template.name} (Copy)`);
  };

  const confirmDuplicate = async () => {
    if (duplicateTemplate && duplicateName.trim()) {
      await duplicateCustomTemplate(duplicateTemplate.id, duplicateName.trim());
      setDuplicateTemplate(null);
      setDuplicateName('');
    }
  };

  const handleDelete = (template: CustomTemplate) => {
    setDeleteConfirm(template);
  };

  const confirmDelete = async () => {
    if (deleteConfirm) {
      await deleteCustomTemplate(deleteConfirm.id);
      setDeleteConfirm(null);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Template Management</h1>
            <p className="text-gray-600">Manage your custom print templates</p>
          </div>
          
          <Link href="/admin/templates/builder">
            <a className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
              <span>+</span>
              <span>Create Template</span>
            </a>
          </Link>
        </div>

        {/* Success/Error Messages */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-red-700">{error}</span>
            <button onClick={clearMessages} className="text-red-500 hover:text-red-700">✕</button>
          </div>
        )}
        
        {successMessage && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
            <span className="text-green-700">{successMessage}</span>
            <button onClick={clearMessages} className="text-green-500 hover:text-green-700">✕</button>
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

        {/* Templates Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading templates...</p>
            </div>
          </div>
        ) : customTemplates.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-6xl mb-4">📐</div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No Templates Found</h3>
            <p className="text-gray-600 mb-6">
              Create your first {selectedPrintSize} template to get started.
            </p>
            <Link href="/admin/templates/builder">
              <a className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
                Create Template
              </a>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {customTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onEdit={handleEdit}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Delete Template</h3>
              <p className="text-gray-600 mb-4">
                Are you sure you want to delete "{deleteConfirm.name}"? This action cannot be undone.
              </p>
              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Duplicate Modal */}
        {duplicateTemplate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Duplicate Template</h3>
              <p className="text-gray-600 mb-4">
                Enter a name for the duplicated template:
              </p>
              <input
                type="text"
                value={duplicateName}
                onChange={(e) => setDuplicateName(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2 mb-4"
                placeholder="Template name"
              />
              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => {
                    setDuplicateTemplate(null);
                    setDuplicateName('');
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDuplicate}
                  disabled={!duplicateName.trim()}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Duplicate
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}