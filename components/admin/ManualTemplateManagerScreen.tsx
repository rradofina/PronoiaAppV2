import React, { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { 
  ManualTemplate, 
  CreateManualTemplateRequest, 
  TemplateType, 
  PrintSize,
  GoogleAuth 
} from '../../types';
import { manualTemplateService } from '../../services/manualTemplateService';
import { getPrintSizeDimensions } from '../../utils/printSizeDimensions';
import { templateConfigService } from '../../services/templateConfigService';
import { printSizeService } from '../../services/printSizeService';
import HeaderNavigation from '../HeaderNavigation';
import { useAlert } from '../../contexts/AlertContext';

interface ManualTemplateManagerScreenProps {
  googleAuth: GoogleAuth;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
  onBack: () => void;
  onManageTemplates?: () => void;
  onManagePackages?: () => void;
  onAdminSettings?: () => void;
}

interface TemplateFormData {
  name: string;
  description: string;
  template_type: TemplateType;
  print_size: PrintSize;
  drive_file_id: string;
  holes_data: string; // JSON string for editing
  dimensions: string; // JSON string for editing
  thumbnail_url: string;
  sample_image_url: string; // Sample image showing template filled with photos
}

// REMOVED: Hardcoded template types and print sizes - now loaded dynamically from database

const EMPTY_FORM: TemplateFormData = {
  name: '',
  description: '',
  template_type: '', // Dynamic - set from first available template type
  print_size: '', // Dynamic - set from first available print size
  drive_file_id: '',
  holes_data: '[]',
  dimensions: '{"width": 1200, "height": 1800}',
  thumbnail_url: '',
  sample_image_url: ''
};

export default function ManualTemplateManagerScreen({
  googleAuth,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
  onBack,
  onManageTemplates,
  onManagePackages,
  onAdminSettings
}: ManualTemplateManagerScreenProps) {
  const [templates, setTemplates] = useState<ManualTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const { showSuccess } = useAlert();
  const [editingTemplate, setEditingTemplate] = useState<ManualTemplate | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dynamic options loaded from database
  const [availableTemplateTypes, setAvailableTemplateTypes] = useState<{ value: TemplateType; label: string }[]>([]);
  const [availablePrintSizes, setAvailablePrintSizes] = useState<{ value: PrintSize; label: string }[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isAutoDetecting, setIsAutoDetecting] = useState(false);
  const [previewBlobUrl, setPreviewBlobUrl] = useState<string | null>(null);
  const [detectedHoles, setDetectedHoles] = useState<any[]>([]);
  const [templateDimensions, setTemplateDimensions] = useState<{width: number; height: number} | null>(null);
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  // Removed viewMode - using single row layout like packages

  // Selection state for UI improvements
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteItems, setDeleteItems] = useState<{
    templates: ManualTemplate[];
  }>({ templates: [] });
  
  // Sort mode state for mobile-friendly scrolling
  const [sortMode, setSortMode] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Load dynamic template types and print sizes
  useEffect(() => {
    const loadDynamicOptions = async () => {
      setIsLoadingOptions(true);
      try {
        // Load template types from existing templates in database
        const existingTypes = await manualTemplateService.getUniqueTemplateTypes();
        const templateTypeOptions = existingTypes.map(type => ({
          value: type,
          label: type.charAt(0).toUpperCase() + type.slice(1).replace(/[-_]/g, ' ')
        }));

        // Load print sizes from database
        const printSizeConfigs = await printSizeService.getAvailablePrintSizes();
        const printSizeOptions = printSizeConfigs.map(config => ({
          value: config.name,
          label: config.label
        }));

        setAvailableTemplateTypes(templateTypeOptions);
        setAvailablePrintSizes(printSizeOptions);

        // Set defaults in form if empty
        if (!formData.template_type && templateTypeOptions.length > 0) {
          setFormData(prev => ({ ...prev, template_type: templateTypeOptions[0].value }));
        }
        if (!formData.print_size && printSizeOptions.length > 0) {
          setFormData(prev => ({ ...prev, print_size: printSizeOptions[0].value }));
        }
      } catch (error) {
        console.error('Error loading dynamic options:', error);
        // Set minimal fallback options
        setAvailableTemplateTypes([]);
        setAvailablePrintSizes([]);
      } finally {
        setIsLoadingOptions(false);
      }
    };

    loadDynamicOptions();
  }, [formData.template_type, formData.print_size]);

  // Selection helper functions - single selection only
  const toggleTemplateSelection = (templateId: string) => {
    // Single select - replace current selection
    setSelectedTemplates(prev => 
      prev.includes(templateId) && prev.length === 1
        ? [] // Deselect if clicking already selected item
        : [templateId]
    );
  };

  const clearAllSelections = () => {
    setSelectedTemplates([]);
  };

  const isTemplateSelected = (templateId: string) => selectedTemplates.includes(templateId);
  
  const hasSelection = () => selectedTemplates.length > 0;

  // Delete confirmation functions
  const openDeleteConfirmation = () => {
    const templateItems = selectedTemplates
      .map(id => templates.find(t => t.id === id))
      .filter(Boolean) as ManualTemplate[];

    setDeleteItems({ templates: templateItems });
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    try {
      // Delete templates
      for (const template of deleteItems.templates) {
        await handleDelete(template);
      }
      
      // Clear selections and close modal
      clearAllSelections();
      setShowDeleteConfirmation(false);
      setDeleteItems({ templates: [] });
    } catch (error) {
      console.error('❌ Error during template deletion:', error);
      // Keep modal open on error so user can retry
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
    setDeleteItems({ templates: [] });
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not in forms
      if (showCreateForm) return;
      
      // Delete key - trigger delete action
      if (event.key === 'Delete' && hasSelection()) {
        event.preventDefault();
        openDeleteConfirmation();
      }
      
      // Escape key - close modal or clear selections
      if (event.key === 'Escape') {
        event.preventDefault();
        if (showDeleteConfirmation) {
          handleCancelDelete();
        } else if (hasSelection()) {
          clearAllSelections();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [hasSelection, selectedTemplates, templates, showCreateForm, showDeleteConfirmation]);

  // Click outside to clear selections
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // Only clear selections if clicking outside the main content area
      // and not clicking on action buttons or form elements
      const target = event.target as Element;
      
      // Don't clear selections if:
      // - Clicking on form modals
      // - Clicking on buttons
      // - Clicking on template items (they handle their own selection)
      if (
        target.closest('[data-template-item]') ||
        target.closest('button') ||
        target.closest('[role="dialog"]') ||
        target.closest('.bg-black.bg-opacity-50') // Modal backdrop
      ) {
        return;
      }
      
      // Clear selections if clicking in empty areas
      if (hasSelection()) {
        clearAllSelections();
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [hasSelection]);

  const loadTemplates = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await manualTemplateService.getAllTemplates();
      setTemplates(data);
      console.log('✅ Loaded manual templates:', data.length);
    } catch (err: any) {
      setError(err.message || 'Failed to load templates');
      console.error('❌ Error loading templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle drag-and-drop reordering
  const handleReorderTemplates = (newOrder: ManualTemplate[]) => {
    // Update the main templates array while preserving non-filtered items
    setTemplates(currentTemplates => {
      // Create a map of the new order with their new positions
      const reorderedMap = new Map();
      newOrder.forEach((template, index) => {
        reorderedMap.set(template.id, { ...template, sort_order: index + 1 });
      });
      
      // Update the full templates array
      return currentTemplates.map(template => 
        reorderedMap.has(template.id) ? reorderedMap.get(template.id) : template
      );
    });
    
    // Update sort_order in database for each template (fire and forget like package manager)
    newOrder.forEach(async (template, index) => {
      try {
        await manualTemplateService.updateTemplate(template.id, { 
          sort_order: index + 1 
        });
      } catch (error) {
        console.error('❌ Error updating template order:', error);
      }
    });
    
    console.log('✅ Template order updated locally');
  };


  // Zoom and pan handlers
  const resetZoom = () => {
    setZoom(1);
    setPanX(0);
    setPanY(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom * delta));
    setZoom(newZoom);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanX(prev => prev + e.movementX);
    setPanY(prev => prev + e.movementY);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const getTouchDistance = (touches: React.TouchList) => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const distance = getTouchDistance(e.touches);
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1) {
      setIsDragging(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();
    
    if (e.touches.length === 2) {
      // Pinch to zoom
      const distance = getTouchDistance(e.touches);
      if (lastTouchDistance > 0) {
        const ratio = distance / lastTouchDistance;
        const newZoom = Math.max(0.1, Math.min(5, zoom * ratio));
        setZoom(newZoom);
      }
      setLastTouchDistance(distance);
    } else if (e.touches.length === 1 && isDragging) {
      // Pan with single finger
      const touch = e.touches[0];
      const rect = e.currentTarget.getBoundingClientRect();
      const x = touch.clientX - rect.left;
      const y = touch.clientY - rect.top;
      
      // Simple pan based on touch movement (this is basic - could be improved)
      setPanX(prev => prev + (touch.clientX - rect.left - rect.width / 2) * 0.1);
      setPanY(prev => prev + (touch.clientY - rect.top - rect.height / 2) * 0.1);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDistance(0);
  };

  const handleCreateNew = () => {
    setFormData(EMPTY_FORM);
    setEditingTemplate(null);
    setShowCreateForm(true);
    // Clear preview state
    resetZoom();
    setPreviewBlobUrl(null);
    setDetectedHoles([]);
    setTemplateDimensions(null);
  };

  const handleEdit = async (template: ManualTemplate) => {
    setFormData({
      name: template.name,
      description: template.description || '',
      template_type: template.template_type,
      print_size: template.print_size,
      drive_file_id: template.drive_file_id,
      holes_data: JSON.stringify(template.holes_data, null, 2),
      dimensions: JSON.stringify(template.dimensions, null, 2),
      thumbnail_url: template.thumbnail_url || '',
      sample_image_url: template.sample_image_url || ''
    });
    setEditingTemplate(template);
    
    // Reset zoom state
    resetZoom();
    
    // Load existing template preview and data
    setDetectedHoles(template.holes_data);
    setTemplateDimensions(template.dimensions);
    
    // Load the template image for preview if we have a valid drive_file_id
    if (template.drive_file_id && template.drive_file_id.length > 10) {
      try {
        console.log('🔍 Loading existing template preview for editing:', template.name);
        const { googleDriveService } = await import('../../services/googleDriveService');
        
        // Check if authenticated first
        if (!googleDriveService.isSignedIn()) {
          console.warn('Google Drive not authenticated, cannot load template preview');
        } else {
          const blob = await googleDriveService.downloadTemplate(template.drive_file_id);
          const blobUrl = URL.createObjectURL(blob);
          setPreviewBlobUrl(blobUrl);
          console.log('✅ Template preview loaded for editing:', template.name);
        }
      } catch (error) {
        console.warn('Could not load template preview for editing:', error);
        // Don't show error to user since this is just for preview
      }
    }
    
    setShowCreateForm(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Validate JSON fields
      let holesData, dimensionsData;
      try {
        holesData = JSON.parse(formData.holes_data);
        dimensionsData = JSON.parse(formData.dimensions);
      } catch (jsonError) {
        throw new Error('Invalid JSON in holes data or dimensions');
      }

      const templateData: CreateManualTemplateRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        template_type: formData.template_type,
        print_size: formData.print_size,
        drive_file_id: formData.drive_file_id.trim(),
        holes_data: holesData,
        dimensions: dimensionsData,
        thumbnail_url: formData.thumbnail_url.trim() || undefined,
        sample_image_url: formData.sample_image_url.trim() || undefined
      };

      if (editingTemplate) {
        await manualTemplateService.updateTemplate(editingTemplate.id, templateData);
        console.log('✅ Template updated successfully');
      } else {
        await manualTemplateService.createTemplate(templateData);
        console.log('✅ Template created successfully');
      }

      setShowCreateForm(false);
      setEditingTemplate(null);
      setFormData(EMPTY_FORM);
      // Clean up preview state
      if (previewBlobUrl) {
        URL.revokeObjectURL(previewBlobUrl);
        setPreviewBlobUrl(null);
      }
      setDetectedHoles([]);
      setTemplateDimensions(null);
      await loadTemplates(); // Reload templates
    } catch (err: any) {
      setError(err.message || 'Failed to save template');
      console.error('❌ Error saving template:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (template: ManualTemplate) => {
    try {
      await manualTemplateService.deleteTemplate(template.id);
      console.log('✅ Template deleted successfully');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to delete template');
      console.error('❌ Error deleting template:', err);
    }
  };

  const handleToggleActive = async (template: ManualTemplate) => {
    try {
      if (template.is_active) {
        await manualTemplateService.deactivateTemplate(template.id);
      } else {
        await manualTemplateService.activateTemplate(template.id);
      }
      console.log('✅ Template status updated');
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || 'Failed to update template status');
      console.error('❌ Error updating template status:', err);
    }
  };

  // Helper function to extract and validate file ID from Google Drive URL
  const extractFileIdFromUrl = (input: string): string => {
    const trimmedInput = input.trim();
    
    if (!trimmedInput) {
      throw new Error('Please provide a Google Drive URL or file ID');
    }
    
    let fileId = '';
    
    // Try to extract from Google Drive URL patterns first
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9-_]+)/,  // /file/d/FILE_ID
      /id=([a-zA-Z0-9-_]+)/,          // id=FILE_ID
      /\/d\/([a-zA-Z0-9-_]+)/,        // /d/FILE_ID
    ];
    
    for (const pattern of patterns) {
      const match = trimmedInput.match(pattern);
      if (match && match[1]) {
        fileId = match[1];
        console.log(`✅ Extracted file ID: ${fileId} from URL`);
        break;
      }
    }
    
    // If no URL pattern matched, check if it looks like a direct file ID
    if (!fileId) {
      // Simple check: no spaces, reasonable length, only valid characters
      if (!trimmedInput.includes(' ') && 
          trimmedInput.length >= 15 && 
          trimmedInput.length <= 100 && 
          /^[a-zA-Z0-9-_]+$/.test(trimmedInput)) {
        fileId = trimmedInput;
        console.log(`✅ Using direct file ID: ${fileId}`);
      }
    }
    
    // If we couldn't extract a file ID, show error
    if (!fileId) {
      throw new Error('Could not extract a valid file ID.\n\nPlease provide:\n• A Google Drive sharing URL\n• Or a valid file ID (20+ characters)\n\nExample URL: https://drive.google.com/file/d/1ABC123xyz.../view');
    }
    
    // Validate the extracted file ID format
    if (fileId.length < 20) {
      throw new Error(`File ID "${fileId}" is too short (${fileId.length} characters).\nGoogle Drive file IDs are usually 20+ characters long.`);
    }
    
    if (fileId.length > 60) {
      throw new Error(`File ID "${fileId}" is too long (${fileId.length} characters).\nThis doesn't look like a valid Google Drive file ID.`);
    }
    
    if (!/^[a-zA-Z0-9-_]+$/.test(fileId)) {
      throw new Error(`File ID "${fileId}" contains invalid characters.\nGoogle Drive file IDs only contain letters, numbers, dashes, and underscores.`);
    }
    
    // Additional check for obviously invalid patterns
    if (fileId === 'FILE_ID' || fileId.includes('example') || fileId.includes('...')) {
      throw new Error(`"${fileId}" is not a real file ID.\nPlease provide an actual Google Drive file ID or sharing URL.`);
    }
    
    return fileId;
  };

  const handleAutoDetectTemplate = async () => {
    if (!formData.drive_file_id.trim()) {
      setError('Please enter a Google Drive File ID or URL first');
      return;
    }

    setIsAutoDetecting(true);
    setError(null);

    try {
      // Extract and validate file ID from URL
      console.log('🔍 Starting file ID extraction for:', formData.drive_file_id);
      
      let fileId;
      try {
        fileId = extractFileIdFromUrl(formData.drive_file_id);
        console.log('🔍 Successfully extracted file ID:', fileId);
      } catch (validationError: any) {
        console.log('❌ Validation error caught:', validationError.message);
        setError(validationError.message);
        return; // Exit early if validation fails
      }
      
      console.log('🔍 Using validated file ID:', fileId);
      
      // Import the template detection service
      const { TemplateDetectionService } = await import('../../services/templateDetectionService');
      
      console.log('🔍 Auto-detecting template structure for:', fileId);
      
      // Create an instance of the service and analyze the template
      const detectionService = new TemplateDetectionService();
      const detectedData = await detectionService.analyzeTemplateByFileId(
        fileId, 
        formData.name || 'Manual Template'
      );
      
      if (detectedData) {
        // Update form data with detected holes, dimensions, and template type
        setFormData(prev => ({
          ...prev,
          holes_data: JSON.stringify(detectedData.holes || [], null, 2),
          dimensions: JSON.stringify(detectedData.dimensions || getPrintSizeDimensions(prev.print_size), null, 2),
          template_type: detectedData.templateType || prev.template_type
        }));
        
        // Store preview data for visual display
        setDetectedHoles(detectedData.holes || []);
        setTemplateDimensions(detectedData.dimensions);
        
        // Load the image for preview
        try {
          const { googleDriveService } = await import('../../services/googleDriveService');
          const blob = await googleDriveService.downloadPhoto(fileId);
          const blobUrl = URL.createObjectURL(blob);
          setPreviewBlobUrl(blobUrl);
        } catch (previewError) {
          console.warn('Could not load preview image:', previewError);
        }
        
        console.log('✅ Auto-detection successful:', detectedData);
        
        // Show success message
        const holesCount = detectedData.holes?.length || 0;
        const templateType = detectedData.templateType || 'unknown';
        showSuccess(
          'Auto-detection successful!',
          `Detected:\n• ${holesCount} photo holes\n• Template type: ${templateType}\n• Template dimensions: ${detectedData.dimensions.width}×${detectedData.dimensions.height}\n\nThe form fields have been automatically populated.`
        );
      } else {
        throw new Error('Could not detect template structure. Please ensure the file contains magenta (#FF00FF) photo holes.');
      }
    } catch (err: any) {
      console.error('❌ Auto-detection failed:', err);
      setError(err.message || 'Failed to auto-detect template structure. Please ensure the Google Drive file ID is correct and the file contains magenta photo holes.');
    } finally {
      setIsAutoDetecting(false);
    }
  };


  const renderTemplateCard = (template: ManualTemplate) => (
    <Reorder.Item
      key={template.id}
      value={template}
      data-template-item
      onClick={() => toggleTemplateSelection(template.id)}
      className={`bg-gray-50 rounded-lg p-3 border transition-all duration-200 cursor-pointer hover:shadow-md ${
        template.is_active
          ? 'border-green-200'
          : 'border-gray-300 opacity-60'
      } ${
        isTemplateSelected(template.id)
          ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200'
          : ''
      } ${
        sortMode ? 'cursor-move' : 'cursor-pointer'
      }`}
      drag={sortMode}
      whileDrag={sortMode ? { 
        scale: 1.02, 
        boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
        zIndex: 50 
      } : false}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          {/* Drag Handle - only show when sort mode is on */}
          {sortMode && (
            <div className="mt-1 text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <circle cx="4" cy="4" r="1"/>
                <circle cx="4" cy="8" r="1"/>
                <circle cx="4" cy="12" r="1"/>
                <circle cx="8" cy="4" r="1"/>
                <circle cx="8" cy="8" r="1"/>
                <circle cx="8" cy="12" r="1"/>
                <circle cx="12" cy="4" r="1"/>
                <circle cx="12" cy="8" r="1"/>
                <circle cx="12" cy="12" r="1"/>
              </svg>
            </div>
          )}
          
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="font-medium text-gray-800">{template.name}</h4>
              {!template.is_active && (
                <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                  INACTIVE
                </span>
              )}
            </div>
            {template.description && (
              <p className="text-sm text-gray-600 mb-1">{template.description}</p>
            )}
            <div className="flex items-center space-x-3 text-xs text-gray-500">
              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                {template.template_type}
              </span>
              <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded">
                {template.print_size}
              </span>
              <span>{template.holes_data.length} holes</span>
              <span className="text-gray-400">
                Created: {new Date(template.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center ml-3">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleActive(template);
            }}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              template.is_active
                ? 'bg-green-100 text-green-800 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={template.is_active ? 'Deactivate' : 'Activate'}
          >
            {template.is_active ? '✓' : '○'}
          </button>
        </div>
      </div>
    </Reorder.Item>
  );

  const renderTemplatePreview = () => {
    if (!previewBlobUrl || !templateDimensions) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-gray-100 rounded-lg">
          <div className="text-center text-gray-500">
            <div className="text-4xl mb-2">🖼️</div>
            <p className="text-sm">Use Auto-Detect to see template preview</p>
          </div>
        </div>
      );
    }

    // Calculate base scale to fit preview container (600px width)
    const previewWidth = 600;
    const baseScale = Math.min(previewWidth / templateDimensions.width, 500 / templateDimensions.height);
    const finalScale = baseScale * zoom;
    const displayWidth = templateDimensions.width * finalScale;
    const displayHeight = templateDimensions.height * finalScale;

    return (
      <div className="w-full h-full bg-gray-100 rounded-lg relative overflow-hidden">
        {/* Zoom Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2">
          <button
            onClick={() => setZoom(prev => Math.min(5, prev * 1.2))}
            className="w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-50"
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={() => setZoom(prev => Math.max(0.1, prev / 1.2))}
            className="w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-50"
            title="Zoom Out"
          >
            −
          </button>
          <button
            onClick={resetZoom}
            className="w-8 h-8 bg-white shadow-lg rounded-full flex items-center justify-center text-gray-700 hover:bg-gray-50 text-xs"
            title="Reset Zoom"
          >
            ⌂
          </button>
        </div>

        {/* Zoom Level Indicator */}
        <div className="absolute top-4 left-4 z-10 bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs">
          {Math.round(zoom * 100)}%
        </div>

        {/* Scrollable Container */}
        <div 
          className="w-full h-full overflow-auto cursor-grab active:cursor-grabbing select-none"
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{ touchAction: 'none' }}
        >
          <div 
            className="relative bg-white rounded shadow m-4"
            style={{
              width: displayWidth,
              height: displayHeight,
              transform: `translate(${panX}px, ${panY}px)`,
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            }}
          >
            {/* Template Image */}
            <img 
              src={previewBlobUrl}
              alt="Template Preview"
              className="w-full h-full object-contain rounded"
              draggable={false}
              style={{ userSelect: 'none' }}
            />
            
            {/* Hole Overlays */}
            {detectedHoles.map((hole, index) => (
              <div
                key={index}
                className="absolute border-2 border-red-500 bg-red-500 bg-opacity-20 rounded"
                style={{
                  left: (hole.x * finalScale) + 'px',
                  top: (hole.y * finalScale) + 'px',
                  width: (hole.width * finalScale) + 'px',
                  height: (hole.height * finalScale) + 'px',
                }}
                title={`Hole ${index + 1}: ${hole.width}×${hole.height}px`}
              >
                {/* Hole Number */}
                <div 
                  className="absolute bg-red-500 text-white text-xs px-1 py-0.5 rounded font-bold text-center min-w-[20px]"
                  style={{
                    top: -Math.max(20, 6 * zoom) + 'px',
                    left: '0px',
                    fontSize: Math.max(10, 12 * Math.min(zoom, 2)) + 'px'
                  }}
                >
                  {index + 1}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions */}
        <div className="absolute bottom-4 left-4 right-4 z-10 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-xs">
          💡 <strong>Desktop:</strong> Mouse wheel to zoom, drag to pan • <strong>Mobile:</strong> Pinch to zoom, drag to pan
        </div>
      </div>
    );
  };

  const renderForm = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h2>
            <button
              onClick={() => {
                if (previewBlobUrl) {
                  URL.revokeObjectURL(previewBlobUrl);
                  setPreviewBlobUrl(null);
                }
                setDetectedHoles([]);
                setTemplateDimensions(null);
                setShowCreateForm(false);
              }}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column - Form */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Template Configuration</h3>
              
              {/* Error Display inside Form */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <div className="text-red-800 text-sm whitespace-pre-line">{error}</div>
                  </div>
                </div>
              )}
              
              <form onSubmit={handleFormSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Template Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Modern Wedding Collage"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={2}
                placeholder="Optional description..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Template Type *
                </label>
                <select
                  required
                  value={formData.template_type}
                  onChange={(e) => setFormData(prev => ({ ...prev, template_type: e.target.value as TemplateType }))}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isLoadingOptions ? (
                    <option value="">Loading template types...</option>
                  ) : (
                    availableTemplateTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Print Size *
                </label>
                <select
                  required
                  value={formData.print_size}
                  onChange={(e) => setFormData(prev => ({ ...prev, print_size: e.target.value as PrintSize }))}
                  className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isLoadingOptions ? (
                    <option value="">Loading print sizes...</option>
                  ) : (
                    availablePrintSizes.map(size => (
                      <option key={size.value} value={size.value}>
                        {size.label}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Google Drive File ID or URL *
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  required
                  value={formData.drive_file_id}
                  onChange={(e) => setFormData(prev => ({ ...prev, drive_file_id: e.target.value }))}
                  className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="File ID or full Google Drive URL"
                />
                <button
                  type="button"
                  onClick={handleAutoDetectTemplate}
                  disabled={!formData.drive_file_id.trim() || isAutoDetecting}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
                  title="Auto-detect holes and dimensions from PNG template"
                >
                  {isAutoDetecting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Detecting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      <span>Auto-Detect</span>
                    </>
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Paste a Google Drive URL or enter the file ID directly. Click "Auto-Detect" to automatically populate holes and dimensions.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Holes Data (JSON) *
              </label>
              <textarea
                required
                value={formData.holes_data}
                onChange={(e) => setFormData(prev => ({ ...prev, holes_data: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={4}
                placeholder='[{"id": "1", "x": 100, "y": 200, "width": 300, "height": 400}]'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dimensions (JSON) *
              </label>
              <textarea
                required
                value={formData.dimensions}
                onChange={(e) => setFormData(prev => ({ ...prev, dimensions: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                rows={2}
                placeholder='{"width": 1200, "height": 1800}'
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Thumbnail URL
              </label>
              <input
                type="url"
                value={formData.thumbnail_url}
                onChange={(e) => setFormData(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional preview image URL"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sample Image URL
              </label>
              <div className="flex space-x-2">
                <input
                  type="url"
                  value={formData.sample_image_url}
                  onChange={(e) => setFormData(prev => ({ ...prev, sample_image_url: e.target.value }))}
                  className="flex-1 p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Sample image showing template filled with photos (Google Drive link)"
                />
                {formData.sample_image_url && (
                  <button
                    type="button"
                    onClick={() => {
                      // Convert Google Drive URL and test it
                      let testUrl = formData.sample_image_url;
                      if (testUrl.includes('drive.google.com')) {
                        const fileId = testUrl.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
                        if (fileId) {
                          testUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
                        }
                      }
                      window.open(testUrl, '_blank');
                    }}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                    title="Test/Preview Sample Image"
                  >
                    👁️ Test
                  </button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                💡 Upload a sample image to Google Drive showing what this template looks like with photos, then paste the sharing link here. Use the "Test" button to verify the link works.
              </p>
              
              {/* Show preview if URL exists */}
              {formData.sample_image_url && (
                <div className="mt-2 p-2 border border-gray-200 rounded">
                  <p className="text-xs text-gray-600 mb-2">Preview:</p>
                  <img
                    src={(() => {
                      let url = formData.sample_image_url;
                      if (url.includes('drive.google.com')) {
                        const fileId = url.match(/\/d\/([a-zA-Z0-9-_]+)/)?.[1];
                        if (fileId) {
                          url = `https://lh3.googleusercontent.com/d/${fileId}`;
                        }
                      }
                      return url;
                    })()}
                    alt="Sample preview"
                    className="w-32 h-48 object-cover rounded border"
                    onError={(e) => {
                      e.currentTarget.src = '/api/placeholder/128/192';
                      e.currentTarget.alt = 'Failed to load - check URL';
                      e.currentTarget.className = 'w-32 h-48 object-cover rounded border border-red-300 bg-red-50';
                    }}
                  />
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={() => {
                  if (previewBlobUrl) {
                    URL.revokeObjectURL(previewBlobUrl);
                    setPreviewBlobUrl(null);
                  }
                  setDetectedHoles([]);
                  setTemplateDimensions(null);
                  setShowCreateForm(false);
                }}
                className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting 
                  ? (editingTemplate ? 'Updating...' : 'Creating...') 
                  : (editingTemplate ? 'Update Template' : 'Create Template')
                }
              </button>
              </div>
            </form>
            </div>
            
            {/* Right Column - Preview */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Template Preview</h3>
              <div className="h-[600px]">
                {renderTemplatePreview()}
              </div>
              {detectedHoles.length > 0 && (
                <div className="text-sm text-gray-600">
                  <p className="font-medium mb-1">Detected Holes:</p>
                  <div className="space-y-1">
                    {detectedHoles.map((hole, index) => (
                      <div key={index} className="flex items-center space-x-2">
                        <div className="w-4 h-4 bg-red-500 text-white text-xs flex items-center justify-center rounded">
                          {index + 1}
                        </div>
                        <span className="text-xs">
                          {hole.width}×{hole.height}px at ({hole.x}, {hole.y})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <HeaderNavigation
        googleAuth={googleAuth}
        mainSessionsFolder={mainSessionsFolder}
        onSignOut={onSignOut}
        onChangeMainFolder={onChangeMainFolder}
        showMainFolder={true}
        onManageTemplates={onManageTemplates}
        onManagePackages={onManagePackages}
        onAdminSettings={onAdminSettings}
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
                <h1 className="text-2xl font-bold text-gray-800">Manual Template Manager</h1>
              </div>
              <p className="text-gray-600">
                Create and manage templates manually with precise configuration
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Action buttons - always visible but disabled when no selection */}
              <button
                onClick={() => {
                  const template = templates.find(t => t.id === selectedTemplates[0]);
                  if (template) handleEdit(template);
                }}
                disabled={!hasSelection()}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  hasSelection()
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                }`}
                title={hasSelection() ? 'Edit selected template' : 'Select a template to edit'}
              >
                ✏️ Edit
              </button>
              
              <button
                onClick={openDeleteConfirmation}
                disabled={!hasSelection()}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  hasSelection()
                    ? 'bg-red-100 text-red-800 hover:bg-red-200 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                }`}
                title={hasSelection() ? 'Delete selected template' : 'Select a template to delete'}
              >
                🗑️ Delete
              </button>

              {/* Divider */}
              {hasSelection() && <div className="h-6 w-px bg-gray-300"></div>}
              
              {/* Sort Mode Toggle */}
              <button
                onClick={() => setSortMode(!sortMode)}
                className={`px-3 py-2 text-sm rounded-lg transition-colors flex items-center space-x-2 ${
                  sortMode
                    ? 'bg-orange-100 text-orange-800 hover:bg-orange-200'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
                title={sortMode ? 'Disable sort mode for easier scrolling' : 'Enable sort mode to drag and reorder templates'}
              >
                <span>🔄</span>
                <span>{sortMode ? 'Sort: ON' : 'Sort: OFF'}</span>
              </button>
              
              {/* Create button */}
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span>Create Template</span>
              </button>
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


          {/* Templates List */}
          {!isLoading && !error && (
            <>
              {templates.length > 0 ? (
                <>
                  <div className="mb-4 text-sm text-gray-600 text-center">
                    {sortMode ? (
                      <>💡 Drag templates to reorder them - this affects package template order</>
                    ) : (
                      <>📱 Sort mode is OFF for easier scrolling on mobile. Click "Sort: OFF" to enable reordering.</>
                    )}
                  </div>

                  <div className="bg-white rounded-lg border">
                    <div className="p-4 border-b bg-gray-50">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">Manual Templates</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            {sortMode 
                              ? '↕️ Drag templates to reorder them - this affects package template order'
                              : 'Click templates to select, then use Edit/Delete buttons above'
                            }
                          </p>
                        </div>
                        <div className="text-sm text-gray-500">
                          {templates.length} template{templates.length === 1 ? '' : 's'}
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <Reorder.Group
                        axis="y"
                        values={templates.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))}
                        onReorder={sortMode ? handleReorderTemplates : () => {}}
                        className="space-y-3"
                      >
                        {templates
                          .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
                          .map(renderTemplateCard)}
                      </Reorder.Group>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📝</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Manual Templates</h3>
                  <p className="text-gray-600 mb-4">
                    Create your first template to get started.
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Create First Template
                  </button>
                </div>
              )}

            </>
          )}
        </div>
      </div>

      {/* Create/Edit Form Modal */}
      {showCreateForm && renderForm()}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div 
            role="dialog"
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
          >
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">Delete Templates</h3>
                <p className="text-sm text-gray-600 mt-1">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-700 mb-3">
                Are you sure you want to delete the following template{deleteItems.templates.length === 1 ? '' : 's'}?
              </p>
              
              <div className="max-h-40 overflow-y-auto">
                {deleteItems.templates.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-gray-700 mb-2">Templates:</div>
                    {deleteItems.templates.map(template => (
                      <div key={template.id} className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                        <span className="text-blue-600">📝</span>
                        <span>{template.name}</span>
                        <span className="text-gray-400">({template.template_type}, {template.holes_data.length} holes)</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={handleCancelDelete}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}