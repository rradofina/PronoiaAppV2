import React, { useState, useEffect } from 'react';
import { ManualTemplate, Photo, TemplateSlot } from '../types';
import { AnimatedTemplateItem } from './animations/AnimatedTemplateReveal';
import PngTemplateVisual from './PngTemplateVisual';
import TemplateSelectionModal from './TemplateSelectionModal';
import AddPrintsModal from './AddPrintsModal';
import ConfirmationModal from './ConfirmationModal';
import { getSamplePhotosForTemplate } from '../utils/samplePhotoUtils';
import { createPhotoTransform, PhotoTransform, createSmartPhotoTransformFromSlot } from '../types';
import { getPrintSizeDimensions } from '../utils/printSizeDimensions';
import PreviewTemplateWithSmartTransforms from './PreviewTemplateWithSmartTransforms';

interface PackageTemplatePreviewProps {
  templates: ManualTemplate[];
  packageName: string;
  packageId: string; // Package ID for template replacement
  originalTemplateCount: number; // Number of templates in original package
  onContinue: () => void;
  onChangePackage: () => void;
  onTemplateSelect?: (template: ManualTemplate) => void;
  availablePhotos?: Photo[]; // Photos from client folder for samples
  loading?: boolean;
  onTemplateReplace?: (packageId: string, templateIndex: number, newTemplate: ManualTemplate) => void; // Position-based dispatch callback
  onTemplateAdd?: (template: ManualTemplate) => void; // Callback for adding new templates to package
  onTemplateDelete?: (templateIndex: number) => void; // Callback for deleting additional templates
}

export default function PackageTemplatePreview({
  templates,
  packageName,
  packageId,
  originalTemplateCount,
  onContinue,
  onChangePackage,
  onTemplateSelect,
  availablePhotos = [],
  loading = false,
  onTemplateReplace,
  onTemplateAdd,
  onTemplateDelete
}: PackageTemplatePreviewProps) {
  
  // Modal state for template selection
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateToChange, setTemplateToChange] = useState<{template: ManualTemplate, index: number} | null>(null);
  
  // Modal state for adding prints
  const [showAddPrintsModal, setShowAddPrintsModal] = useState(false);
  
  // Confirmation modal state for deletion
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<{index: number, name: string} | null>(null);
  
  // Confirmation modal state for going back
  const [showBackConfirm, setShowBackConfirm] = useState(false);
  
  // Use templates directly from props since parent manages state
  const currentTemplates = templates;

  // This is a PREVIEW system - always show sample photos regardless of user photos
  // Keep it simple and fast

  // Modal handlers
  const handleChangeTemplate = (template: ManualTemplate, index: number) => {
    setTemplateToChange({template, index});
    setShowTemplateModal(true);
  };

  const handleTemplateReplace = (newTemplate: ManualTemplate) => {
    if (!templateToChange) {
      if (process.env.NODE_ENV === 'development') console.log('⚠️ No template selected for replacement');
      return;
    }

    if (process.env.NODE_ENV === 'development') console.log('🔄 POSITION-BASED TEMPLATE REPLACE:', {
      templateIndex: templateToChange.index,
      oldTemplate: {
        id: templateToChange.template.id,
        name: templateToChange.template.name
      },
      newTemplate: {
        id: newTemplate.id,
        name: newTemplate.name
      }
    });

    // Call parent's template replacement handler with position context
    if (onTemplateReplace) {
      onTemplateReplace(packageId, templateToChange.index, newTemplate);
    }
    
    setShowTemplateModal(false);
    setTemplateToChange(null);
  };

  const handleCloseModal = () => {
    setShowTemplateModal(false);
    setTemplateToChange(null);
  };

  const handleAddPrints = () => {
    setShowAddPrintsModal(true);
  };
  
  const handleDeleteClick = (index: number, templateName: string) => {
    setTemplateToDelete({ index, name: templateName });
    setShowDeleteConfirm(true);
  };
  
  const handleConfirmDelete = () => {
    if (templateToDelete && onTemplateDelete) {
      onTemplateDelete(templateToDelete.index);
      setTemplateToDelete(null);
    }
  };

  const handleTemplateAdd = (template: ManualTemplate) => {
    if (onTemplateAdd) {
      onTemplateAdd(template);
    }
    setShowAddPrintsModal(false);
  };

  // Count total holes across all templates for global photo assignment
  const totalHoles = currentTemplates.reduce((total, template) => {
    return total + (template.holes_data?.length || 0);
  }, 0);
  
  // Extract photo filenames for assignment
  const photoFilenames = availablePhotos.map(photo => photo.name || `Photo ${photo.id}`);
  
  // Create global photo assignment strategy
  const createGlobalPhotoAssignment = (globalHoleIndex: number): string => {
    if (photoFilenames.length === 0) return `Sample-${globalHoleIndex + 1}`;
    
    // Loop filenames if more holes than photos
    const photoIndex = globalHoleIndex % photoFilenames.length;
    return photoFilenames[photoIndex];
  };
  
  if (process.env.NODE_ENV === 'development') console.log(`📊 GLOBAL PHOTO ASSIGNMENT STRATEGY:`, {
    totalTemplates: currentTemplates.length,
    totalHoles,
    availablePhotos: photoFilenames.length,
    photoFilenames: photoFilenames.slice(0, 5), // Show first 5 filenames
    strategy: photoFilenames.length >= totalHoles 
      ? 'Unique assignment (enough photos)' 
      : `Looped assignment (${photoFilenames.length} photos for ${totalHoles} holes)`
  });
  
  if (loading) {
    return (
      <div className="mt-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading templates...</span>
        </div>
      </div>
    );
  }

  if (currentTemplates.length === 0) {
    return (
      <div className="mt-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-8">
          <div className="text-gray-500 mb-4">No templates found in this package</div>
          <button
            onClick={onChangePackage}
            className="bg-gray-500 text-white px-6 py-2 rounded hover:bg-gray-600 transition-colors"
          >
            Choose Different Package
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm sm:text-lg font-semibold text-gray-900 mb-1 sm:mb-2">
              Templates in "{packageName}"
            </h3>
            <div className="text-xs sm:text-sm text-gray-600">
              {currentTemplates.length} template{currentTemplates.length > 1 ? 's' : ''} available
            </div>
          </div>
          
          {/* Add Prints Button */}
          {onTemplateAdd && (
            <button
              onClick={handleAddPrints}
              className="bg-green-600 text-white px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1 sm:gap-2 whitespace-nowrap"
            >
              <span className="text-sm sm:text-lg">+</span>
              <span>Add Prints</span>
            </button>
          )}
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {currentTemplates.map((template, index) => {
          // Calculate global hole index offset for this template
          const globalHoleOffset = currentTemplates.slice(0, index).reduce((offset, prevTemplate) => {
            return offset + (prevTemplate.holes_data?.length || 0);
          }, 0);
          
          return (
            <PreviewTemplateWithSmartTransforms
              key={`${template.id}-${index}`}
              template={template}
              index={index}
              availablePhotos={availablePhotos}
              originalTemplateCount={originalTemplateCount}
              onChangeTemplate={handleChangeTemplate}
              onDeleteClick={onTemplateDelete ? handleDeleteClick : undefined}
              globalHoleOffset={globalHoleOffset}
              createGlobalPhotoAssignment={createGlobalPhotoAssignment}
            />
          );
        })}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 pt-4 border-t border-gray-200">
        <button
          onClick={onContinue}
          className="flex-1 bg-blue-600 text-white px-3 py-1.5 sm:px-6 sm:py-3 text-sm sm:text-base rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 shadow-sm hover:shadow-md"
        >
          <span className="hidden sm:inline">Continue to Photo and Print Selection</span>
          <span className="sm:hidden">Continue to Selection</span>
        </button>
        <button
          onClick={() => setShowBackConfirm(true)}
          className="flex-1 sm:flex-none bg-gray-100 text-gray-700 px-3 py-1.5 sm:px-6 sm:py-3 text-sm sm:text-base rounded-lg font-medium hover:bg-gray-200 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 border border-gray-300"
        >
          Back
        </button>
      </div>

      {/* Template Selection Modal */}
      {templateToChange && (
        <TemplateSelectionModal
          isOpen={showTemplateModal}
          onClose={handleCloseModal}
          currentTemplate={templateToChange}
          availablePhotos={availablePhotos}
          onTemplateSelect={handleTemplateReplace}
        />
      )}

      {/* Add Prints Modal */}
      <AddPrintsModal
        isOpen={showAddPrintsModal}
        onClose={() => setShowAddPrintsModal(false)}
        onTemplateAdd={handleTemplateAdd}
        availablePhotos={availablePhotos}
      />
      
      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setTemplateToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Remove Template"
        message={`Are you sure you want to remove "${templateToDelete?.name}"? This action cannot be undone.`}
        confirmText="Remove"
        cancelText="Cancel"
        confirmButtonClass="bg-gray-600 hover:bg-gray-700"
      />
      
      {/* Back Confirmation Modal */}
      <ConfirmationModal
        isOpen={showBackConfirm}
        onClose={() => setShowBackConfirm(false)}
        onConfirm={() => {
          setShowBackConfirm(false);
          onChangePackage();
        }}
        title="Go Back?"
        message="Are you sure you want to go back? Any changes made here will be lost."
        confirmText="Yes, Go Back"
        cancelText="Stay Here"
        confirmButtonClass="bg-gray-600 hover:bg-gray-700"
      />
    </div>
  );
}