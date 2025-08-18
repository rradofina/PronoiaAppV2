import React, { useState, useEffect } from 'react';
import { motion, Reorder } from 'framer-motion';
import { 
  ManualPackage, 
  ManualPackageWithTemplates,
  CreateManualPackageRequest, 
  PackageGroup,
  CreatePackageGroupRequest,
  PrintSize,
  GoogleAuth,
  ManualTemplate
} from '../../types';
import { manualPackageService } from '../../services/manualPackageService';
import { manualTemplateService } from '../../services/manualTemplateService';
import { packageGroupService } from '../../services/packageGroupService';
import HeaderNavigation from '../HeaderNavigation';

interface ManualPackageManagerScreenProps {
  googleAuth: GoogleAuth;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
  onBack: () => void;
  onManageTemplates?: () => void;
  onManagePackages?: () => void;
  onAdminSettings?: () => void;
}

interface PrintPosition {
  position: number;
  default_template_id: string | null;
  template_name?: string; // For display purposes
}

interface PackageFormData {
  name: string;
  description: string;
  thumbnail_url: string;
  price: string; // String for form input
  number_of_prints: number;
  photo_limit: number; // Maximum number of photos client can select
  is_unlimited_photos: boolean; // When true, ignores photo_limit and allows unlimited photos
  group_id?: string;
  print_positions: PrintPosition[];
}


const EMPTY_FORM: PackageFormData = {
  name: '',
  description: '',
  thumbnail_url: '',
  price: '',
  number_of_prints: 1,
  photo_limit: 20, // Default to 20 photos
  is_unlimited_photos: false, // Default to limited photos
  group_id: undefined,
  print_positions: [{
    position: 1,
    default_template_id: null
  }]
};

export default function ManualPackageManagerScreen({
  googleAuth,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
  onBack,
  onManageTemplates,
  onManagePackages,
  onAdminSettings
}: ManualPackageManagerScreenProps) {
  const [packages, setPackages] = useState<ManualPackage[]>([]);
  const [groups, setGroups] = useState<PackageGroup[]>([]);
  const [groupedPackages, setGroupedPackages] = useState<{ [groupId: string]: ManualPackage[] }>({});
  const [ungroupedPackages, setUngroupedPackages] = useState<ManualPackage[]>([]);
  const [availableTemplates, setAvailableTemplates] = useState<ManualTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCreateGroupForm, setShowCreateGroupForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ManualPackage | null>(null);
  const [editingGroup, setEditingGroup] = useState<PackageGroup | null>(null);
  const [formData, setFormData] = useState<PackageFormData>(EMPTY_FORM);
  const [groupFormData, setGroupFormData] = useState({ name: '', description: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [showPackageDetails, setShowPackageDetails] = useState<string | null>(null);
  const [packageDetails, setPackageDetails] = useState<ManualPackageWithTemplates | null>(null);
  const [thumbnailValidation, setThumbnailValidation] = useState<{
    isValidating: boolean;
    isValid: boolean | null;
    error: string | null;
    transformedUrl: string | null;
  }>({ isValidating: false, isValid: null, error: null, transformedUrl: null });

  // Selection state for UI improvements
  const [selectedPackages, setSelectedPackages] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [deleteItems, setDeleteItems] = useState<{
    packages: ManualPackage[];
    groups: PackageGroup[];
  }>({ packages: [], groups: [] });
  
  // Sort mode state for mobile-friendly scrolling
  const [sortMode, setSortMode] = useState(false);

  // Utility function to transform Google Drive URLs
  const transformGoogleDriveUrl = (url: string): string => {
    if (!url) return url;
    
    // Check if it's a Google Drive share URL
    const driveMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
    if (driveMatch) {
      const fileId = driveMatch[1];
      return `https://lh3.googleusercontent.com/d/${fileId}`;
    }
    
    return url;
  };

  // Get thumbnail URL for package
  const getPackageThumbnailUrl = (pkg: ManualPackage): string | null => {
    if (!pkg.thumbnail_url) return null;
    return transformGoogleDriveUrl(pkg.thumbnail_url);
  };

  // Package Icon Component (same pattern as FolderSelectionScreen.tsx)
  const PackageIcon = ({ pkg, size = "w-16 h-16" }: { 
    pkg: ManualPackage; 
    size?: string; 
  }) => {
    const thumbnailUrl = getPackageThumbnailUrl(pkg);
    const [imageError, setImageError] = useState(false);

    if (thumbnailUrl && !imageError) {
      return (
        <div className={`${size} rounded border border-gray-200 overflow-hidden flex-shrink-0`}>
          <img
            src={thumbnailUrl}
            alt={`${pkg.name} thumbnail`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    // Fallback package icon
    return (
      <div className={`${size} bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0`}>
        <div className="text-gray-400 text-xl">📦</div>
      </div>
    );
  };

  // Selection helper functions - single selection only
  const togglePackageSelection = (packageId: string) => {
    // Single select - replace current selection
    setSelectedPackages(prev => 
      prev.includes(packageId) && prev.length === 1
        ? [] // Deselect if clicking already selected item
        : [packageId]
    );
    setSelectedGroups([]); // Clear group selection
  };

  const toggleGroupSelection = (groupId: string) => {
    // Single select - replace current selection
    setSelectedGroups(prev => 
      prev.includes(groupId) && prev.length === 1
        ? [] // Deselect if clicking already selected item
        : [groupId]
    );
    setSelectedPackages([]); // Clear package selection
  };

  const clearAllSelections = () => {
    setSelectedPackages([]);
    setSelectedGroups([]);
  };

  const isPackageSelected = (packageId: string) => selectedPackages.includes(packageId);
  const isGroupSelected = (groupId: string) => selectedGroups.includes(groupId);
  
  const hasSelection = () => selectedPackages.length > 0 || selectedGroups.length > 0;

  // Delete confirmation functions
  const openDeleteConfirmation = () => {
    const packageItems = selectedPackages
      .map(id => packages.find(p => p.id === id))
      .filter(Boolean) as ManualPackage[];
    
    const groupItems = selectedGroups
      .map(id => groups.find(g => g.id === id))
      .filter(Boolean) as PackageGroup[];

    setDeleteItems({ packages: packageItems, groups: groupItems });
    setShowDeleteConfirmation(true);
  };

  const handleConfirmDelete = async () => {
    try {
      // Delete packages
      for (const pkg of deleteItems.packages) {
        await handleDelete(pkg);
      }
      
      // Delete groups
      for (const group of deleteItems.groups) {
        await handleDeleteGroup(group);
      }
      
      // Clear selections and close modal
      clearAllSelections();
      setShowDeleteConfirmation(false);
      setDeleteItems({ packages: [], groups: [] });
    } catch (error) {
      console.error('❌ Error during bulk deletion:', error);
      // Keep modal open on error so user can retry
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirmation(false);
    setDeleteItems({ packages: [], groups: [] });
  };

  // Validate thumbnail URL
  const validateThumbnailUrl = async (url: string) => {
    if (!url.trim()) {
      setThumbnailValidation({ isValidating: false, isValid: null, error: null, transformedUrl: null });
      return;
    }

    setThumbnailValidation({ isValidating: true, isValid: null, error: null, transformedUrl: null });

    try {
      // Basic URL format validation
      new URL(url);
      
      // Transform Google Drive URLs
      const transformedUrl = transformGoogleDriveUrl(url);
      
      // Test if image loads
      const img = new Image();
      
      const loadPromise = new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = transformedUrl;
      });

      // Add timeout
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('Image load timeout')), 10000);
      });

      await Promise.race([loadPromise, timeoutPromise]);
      
      setThumbnailValidation({ 
        isValidating: false, 
        isValid: true, 
        error: null, 
        transformedUrl: transformedUrl !== url ? transformedUrl : null 
      });
    } catch (error: any) {
      setThumbnailValidation({ 
        isValidating: false, 
        isValid: false, 
        error: error.message || 'Invalid URL or image cannot be loaded', 
        transformedUrl: null 
      });
    }
  };

  // Debounced validation effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (formData.thumbnail_url) {
        validateThumbnailUrl(formData.thumbnail_url);
      }
    }, 1000); // Wait 1 second after user stops typing

    return () => clearTimeout(timeoutId);
  }, [formData.thumbnail_url]);

  // Load packages, groups, and templates on mount
  useEffect(() => {
    loadPackages();
    loadGroups();
    loadTemplates();
  }, []);

  // Load templates when form is shown
  useEffect(() => {
    if (showCreateForm || editingPackage) {
      loadTemplates();
    }
  }, [showCreateForm, editingPackage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only handle keyboard shortcuts when not in forms
      if (showCreateForm || showCreateGroupForm) return;
      
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
  }, [hasSelection, selectedPackages, selectedGroups, packages, groups, showCreateForm, showCreateGroupForm, showDeleteConfirmation]);

  // Click outside to clear selections
  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      // Only clear selections if clicking outside the main content area
      // and not clicking on action buttons or form elements
      const target = event.target as Element;
      
      // Don't clear selections if:
      // - Clicking on action bar
      // - Clicking on form modals
      // - Clicking on buttons
      // - Clicking on package/group items (they handle their own selection)
      if (
        target.closest('[data-floating-action-bar]') ||
        target.closest('[data-package-item]') ||
        target.closest('[data-group-item]') ||
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

  const loadPackages = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await manualPackageService.getAllPackages();
      setPackages(data);
      organizePackagesByGroup(data);
      console.log('✅ Loaded packages:', data.length);
    } catch (err: any) {
      setError(err.message || 'Failed to load packages');
      console.error('❌ Error loading packages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const data = await packageGroupService.getActiveGroups();
      setGroups(data);
      console.log('✅ Loaded groups:', data.length);
    } catch (err: any) {
      console.error('❌ Error loading groups:', err);
      setError(err.message || 'Failed to load groups');
    }
  };

  const organizePackagesByGroup = (packages: ManualPackage[]) => {
    const grouped: { [groupId: string]: ManualPackage[] } = {};
    const ungrouped: ManualPackage[] = [];

    packages.forEach(pkg => {
      if (pkg.group_id) {
        if (!grouped[pkg.group_id]) {
          grouped[pkg.group_id] = [];
        }
        grouped[pkg.group_id].push(pkg);
      } else {
        ungrouped.push(pkg);
      }
    });

    // Sort packages within each group by sort_order
    Object.keys(grouped).forEach(groupId => {
      grouped[groupId].sort((a, b) => a.sort_order - b.sort_order);
    });
    
    ungrouped.sort((a, b) => a.sort_order - b.sort_order);

    setGroupedPackages(grouped);
    setUngroupedPackages(ungrouped);
  };

  const loadTemplates = async () => {
    try {
      setIsLoadingTemplates(true);
      const data = await manualTemplateService.getActiveTemplates();
      setAvailableTemplates(data);
      
      if (data.length === 0) {
        const allTemplates = await manualTemplateService.getAllTemplates();
        setAvailableTemplates(allTemplates);
      }
    } catch (err: any) {
      console.error('❌ Error loading templates:', err);
      setError(`Failed to load templates: ${err.message}`);
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const loadTemplatesBySize = async (printSize: PrintSize) => {
    try {
      const data = await manualTemplateService.getTemplatesByPrintSize(printSize);
      setAvailableTemplates(data.filter(t => t.is_active));
    } catch (err: any) {
      console.error('❌ Error loading templates by size:', err);
    }
  };

  const loadPackageDetails = async (packageId: string) => {
    try {
      setIsLoading(true);
      const details = await manualPackageService.getPackageWithTemplates(packageId);
      setPackageDetails(details);
      setShowPackageDetails(packageId);
    } catch (err: any) {
      setError(err.message || 'Failed to load package details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateNew = async () => {
    setFormData(EMPTY_FORM);
    setEditingPackage(null);
    setThumbnailValidation({ isValidating: false, isValid: null, error: null, transformedUrl: null });
    setShowCreateForm(true);
    
    // Load templates after a small delay to ensure DOM is ready
    setTimeout(async () => {
      await loadTemplates();
    }, 100);
  };

  const handleNumberOfPrintsChange = (newCount: number) => {
    setFormData(prev => {
      const newPositions: PrintPosition[] = [];
      
      // Keep existing positions up to the new count
      for (let i = 1; i <= newCount; i++) {
        const existingPosition = prev.print_positions.find(p => p.position === i);
        newPositions.push(existingPosition || {
          position: i,
          default_template_id: null
        });
      }
      
      return {
        ...prev,
        number_of_prints: newCount,
        print_positions: newPositions
      };
    });
  };

  const handleTemplateChange = (position: number, templateId: string) => {
    const template = availableTemplates.find(t => t.id === templateId);
    
    setFormData(prev => ({
      ...prev,
      print_positions: prev.print_positions.map(p => 
        p.position === position 
          ? { 
              ...p, 
              default_template_id: templateId,
              template_name: template?.name
            }
          : p
      )
    }));
  };

  const handleEdit = (pkg: ManualPackage) => {
    setEditingPackage(pkg);
    setThumbnailValidation({ isValidating: false, isValid: null, error: null, transformedUrl: null });
    setShowCreateForm(true);
    loadTemplates(); // Load all templates
    
    // Load current templates for this package and set up the form
    manualPackageService.getPackageWithTemplates(pkg.id).then(details => {
      if (details) {
        const printPositions: PrintPosition[] = [];
        
        // Create print positions based on the templates in the package
        details.package_templates.forEach((pt, index) => {
          printPositions.push({
            position: index + 1,
            default_template_id: pt.template.id,
            template_name: pt.template.name
          });
        });
        
        setFormData({
          name: pkg.name,
          description: pkg.description || '',
          thumbnail_url: pkg.thumbnail_url || '',
          price: pkg.price?.toString() || '',
          number_of_prints: printPositions.length || 1,
          photo_limit: pkg.photo_limit || 20,
          is_unlimited_photos: pkg.is_unlimited_photos || false,
          group_id: pkg.group_id,
          print_positions: printPositions.length > 0 ? printPositions : [{
            position: 1,
            default_template_id: null
          }]
        });
      }
    });
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      // Determine print size from selected templates
      let determinedPrintSize: PrintSize = '';
      const selectedTemplateIds = formData.print_positions
        .filter(p => p.default_template_id)
        .map(p => p.default_template_id!);

      if (selectedTemplateIds.length > 0) {
        // Get the first selected template to determine print size
        const firstTemplate = availableTemplates.find(t => t.id === selectedTemplateIds[0]);
        if (firstTemplate) {
          determinedPrintSize = firstTemplate.print_size;
        }
      }

      // Fallback: get the first available print size from the database
      if (!determinedPrintSize) {
        try {
          const { printSizeService } = await import('../../services/printSizeService');
          const printSizes = await printSizeService.getAvailablePrintSizes();
          if (printSizes.length > 0) {
            determinedPrintSize = printSizes[0].name;
          }
        } catch (error) {
          console.error('Failed to get fallback print size:', error);
          throw new Error('Unable to determine print size. Please select at least one template or ensure print sizes are available in the database.');
        }
      }

      const packageData: CreateManualPackageRequest = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined, // Use undefined for optional field
        thumbnail_url: formData.thumbnail_url.trim() || undefined,
        print_size: determinedPrintSize, // Dynamic print size based on selected templates
        template_count: formData.number_of_prints,
        price: formData.price ? parseFloat(formData.price) : undefined,
        photo_limit: formData.photo_limit,
        is_unlimited_photos: formData.is_unlimited_photos,
        group_id: formData.group_id,
        template_ids: selectedTemplateIds
      };

      if (editingPackage) {
        // Update existing package
        await manualPackageService.updatePackage(editingPackage.id, {
          name: packageData.name,
          description: packageData.description,
          thumbnail_url: packageData.thumbnail_url,
          print_size: packageData.print_size,
          price: packageData.price,
          photo_limit: packageData.photo_limit,
          is_unlimited_photos: packageData.is_unlimited_photos
        });

        // Update template associations by removing all and adding new ones
        const currentDetails = await manualPackageService.getPackageWithTemplates(editingPackage.id);
        if (currentDetails) {
          const currentTemplateIds = currentDetails.package_templates.map(pt => pt.template.id);
          
          // Remove old templates
          if (currentTemplateIds.length > 0) {
            await manualPackageService.removeTemplatesFromPackage(editingPackage.id, currentTemplateIds);
          }
          
          // Add new templates
          if (packageData.template_ids.length > 0) {
            await manualPackageService.addTemplatesToPackage(editingPackage.id, packageData.template_ids);
          }
        }

        console.log('✅ Package updated successfully');
      } else {
        await manualPackageService.createPackage(packageData);
        console.log('✅ Package created successfully');
      }

      setShowCreateForm(false);
      setEditingPackage(null);
      setFormData(EMPTY_FORM);
      setThumbnailValidation({ isValidating: false, isValid: null, error: null, transformedUrl: null });
      await loadPackages();
    } catch (err: any) {
      setError(err.message || 'Failed to save package');
      console.error('❌ Error saving package:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (pkg: ManualPackage) => {
    if (!confirm(`Are you sure you want to delete "${pkg.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      await manualPackageService.deletePackage(pkg.id);
      console.log('✅ Package deleted successfully');
      await loadPackages();
    } catch (err: any) {
      setError(err.message || 'Failed to delete package');
      console.error('❌ Error deleting package:', err);
    }
  };

  const handleToggleActive = async (pkg: ManualPackage) => {
    try {
      if (pkg.is_active) {
        await manualPackageService.deactivatePackage(pkg.id);
      } else {
        await manualPackageService.activatePackage(pkg.id);
      }
      console.log('✅ Package status updated');
      await loadPackages();
    } catch (err: any) {
      setError(err.message || 'Failed to update package status');
      console.error('❌ Error updating package status:', err);
    }
  };

  const handleSetDefault = async (pkg: ManualPackage) => {
    try {
      await manualPackageService.setAsDefault(pkg.id);
      console.log('✅ Package set as default');
      await loadPackages();
    } catch (err: any) {
      setError(err.message || 'Failed to set default package');
      console.error('❌ Error setting default:', err);
    }
  };

  const handleTemplateSelection = (templateId: string, isSelected: boolean) => {
    // This function is no longer used with the new print position approach
    console.log('Template selection (deprecated):', templateId, isSelected);
  };

  const handleReorderPackages = async (newOrder: ManualPackage[]) => {
    // Update local state immediately for smooth UX
    setPackages(newOrder);
    
    try {
      // Update sort_order in database for each package
      const updatePromises = newOrder.map((pkg, index) => 
        manualPackageService.updatePackage(pkg.id, { 
          sort_order: index + 1 
        })
      );
      
      await Promise.all(updatePromises);
      console.log('✅ Package order updated successfully');
    } catch (error) {
      console.error('❌ Error updating package order:', error);
      // Revert to original order on error
      await loadPackages();
      setError('Failed to update package order');
    }
  };

  // Group Management Functions
  const handleCreateGroup = async () => {
    setGroupFormData({ name: '', description: '' });
    setEditingGroup(null);
    setShowCreateGroupForm(true);
  };

  const handleGroupFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      if (editingGroup) {
        await packageGroupService.updateGroup(editingGroup.id, {
          name: groupFormData.name.trim(),
          description: groupFormData.description.trim() || undefined // Use undefined for optional field
        });
        console.log('✅ Group updated successfully');
      } else {
        await packageGroupService.createGroup({
          name: groupFormData.name.trim(),
          description: groupFormData.description.trim() || undefined // Use undefined for optional field
        });
        console.log('✅ Group created successfully');
      }

      setShowCreateGroupForm(false);
      setEditingGroup(null);
      setGroupFormData({ name: '', description: '' });
      await loadGroups();
      await loadPackages();
    } catch (err: any) {
      setError(err.message || 'Failed to save group');
      console.error('❌ Error saving group:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditGroup = (group: PackageGroup) => {
    setEditingGroup(group);
    setGroupFormData({
      name: group.name,
      description: group.description || ''
    });
    setShowCreateGroupForm(true);
  };

  const handleDeleteGroup = async (group: PackageGroup) => {
    if (!confirm(`Are you sure you want to delete "${group.name}"? All packages in this group will be moved to ungrouped.`)) {
      return;
    }

    try {
      await packageGroupService.deleteGroup(group.id);
      console.log('✅ Group deleted successfully');
      await loadGroups();
      await loadPackages();
    } catch (err: any) {
      setError(err.message || 'Failed to delete group');
      console.error('❌ Error deleting group:', err);
    }
  };

  const handleMovePackageToGroup = async (packageId: string, groupId: string | null) => {
    try {
      await manualPackageService.updatePackage(packageId, { group_id: groupId || undefined });
      console.log('✅ Package moved to group successfully');
      await loadPackages();
    } catch (err: any) {
      setError(err.message || 'Failed to move package');
      console.error('❌ Error moving package:', err);
    }
  };

  const handleReorderGroups = async (newOrder: PackageGroup[]) => {
    // Update local state immediately for smooth UX
    setGroups(newOrder);
    
    try {
      // Update sort_order in database for each group
      const groupOrder = newOrder.map((group, index) => ({
        group_id: group.id,
        sort_order: index + 1
      }));
      
      await packageGroupService.reorderGroups(groupOrder);
      console.log('✅ Group order updated successfully');
    } catch (error) {
      console.error('❌ Error updating group order:', error);
      // Revert to original order on error
      await loadGroups();
      setError('Failed to update group order');
    }
  };

  const filteredPackages = packages;

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
                <h1 className="text-2xl font-bold text-gray-800">Package Manager</h1>
              </div>
              <p className="text-gray-600">
                Create and manage template packages for different print sizes
              </p>
            </div>
            
            <div className="flex items-center space-x-3">
              {/* Action buttons - always visible but disabled when no selection */}
              <button
                onClick={() => {
                  if (selectedPackages.length === 1) {
                    const pkg = packages.find(p => p.id === selectedPackages[0]);
                    if (pkg) handleEdit(pkg);
                  } else if (selectedGroups.length === 1) {
                    const group = groups.find(g => g.id === selectedGroups[0]);
                    if (group) handleEditGroup(group);
                  }
                }}
                disabled={!hasSelection()}
                className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                  hasSelection()
                    ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed opacity-50'
                }`}
                title={hasSelection() ? 'Edit selected item' : 'Select an item to edit'}
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
                title={hasSelection() ? 'Delete selected item' : 'Select an item to delete'}
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
                title={sortMode ? 'Disable sort mode for easier scrolling' : 'Enable sort mode to drag and reorder items'}
              >
                <span>🔄</span>
                <span>{sortMode ? 'Sort: ON' : 'Sort: OFF'}</span>
              </button>
              
              {/* Create buttons */}
              <button
                onClick={handleCreateGroup}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                + Create Group
              </button>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                + Create Package
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
                <span className="text-gray-600">Loading packages...</span>
              </div>
            </div>
          )}

          {/* Grouped Packages Display */}
          {!isLoading && !error && (
            <>
              {packages.length > 0 ? (
                <div className="max-w-4xl mx-auto space-y-6">
                  <div className="mb-4 text-sm text-gray-600 text-center">
                    {sortMode ? (
                      <>💡 Drag groups to reorder them, or drag packages to reorder within groups</>
                    ) : (
                      <>📱 Sort mode is OFF for easier scrolling on mobile. Click "Sort: OFF" to enable reordering.</>
                    )}
                  </div>

                  {/* Display Groups */}
                  <Reorder.Group
                    axis="y"
                    values={groups}
                    onReorder={sortMode ? handleReorderGroups : () => {}}
                    className="space-y-6"
                  >
                    {groups.map((group) => (
                      <Reorder.Item
                        key={group.id}
                        value={group}
                        className={sortMode ? "cursor-move" : "cursor-default"}
                        drag={sortMode}
                        whileDrag={sortMode ? { 
                          scale: 1.02, 
                          boxShadow: "0 8px 25px rgba(0,0,0,0.15)",
                          zIndex: 50 
                        } : false}
                      >
                        <div className="bg-white rounded-lg border-2 border-gray-200">
                          {/* Group Header */}
                          <div 
                            className={`flex items-center justify-between p-4 border-b border-gray-200 rounded-t-lg cursor-pointer transition-all duration-200 hover:bg-gray-100 ${
                              isGroupSelected(group.id) 
                                ? 'bg-blue-100 border-blue-300' 
                                : 'bg-gray-50'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleGroupSelection(group.id);
                            }}
                            data-group-item
                          >
                            <div className="flex items-center space-x-3 flex-1">
                              {/* Drag Handle for Group - only show when sort mode is on */}
                              {sortMode && (
                                <div className="text-gray-400 hover:text-gray-600 cursor-grab active:cursor-grabbing">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
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
                              <div>
                                <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
                                {group.description && (
                                  <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                                )}
                                <div className="text-xs text-gray-500 mt-1">
                                  {groupedPackages[group.id]?.length || 0} package{(groupedPackages[group.id]?.length || 0) === 1 ? '' : 's'}
                                </div>
                              </div>
                            </div>
                          </div>

                      {/* Packages in Group */}
                      <div className="p-4">
                        {groupedPackages[group.id]?.length > 0 ? (
                          <Reorder.Group
                            axis="y"
                            values={groupedPackages[group.id]}
                            onReorder={sortMode ? (newOrder) => {
                              // Update packages within this group
                              const updatedGrouped = { ...groupedPackages };
                              updatedGrouped[group.id] = newOrder;
                              setGroupedPackages(updatedGrouped);
                              
                              // Update sort order in database
                              newOrder.forEach(async (pkg, index) => {
                                await manualPackageService.updatePackage(pkg.id, { sort_order: index + 1 });
                              });
                            } : () => {}}
                            className="space-y-3"
                          >
                            {groupedPackages[group.id].map((pkg) => (
                              <Reorder.Item
                                key={pkg.id}
                                value={pkg}
                                className={`rounded-lg p-3 border transition-all duration-200 cursor-pointer hover:shadow-md ${
                                  isPackageSelected(pkg.id)
                                    ? 'bg-blue-50 border-blue-300'
                                    : pkg.is_active
                                      ? pkg.is_default
                                        ? 'border-green-400 bg-green-50'
                                        : 'border-green-200 bg-gray-50'
                                      : 'border-gray-300 bg-gray-50 opacity-60'
                                }`}
                                drag={sortMode}
                                whileDrag={sortMode ? { 
                                  scale: 1.02, 
                                  boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
                                  zIndex: 50 
                                } : false}
                              >
                                <div 
                                  className="flex items-start justify-between"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    togglePackageSelection(pkg.id);
                                  }}
                                  data-package-item
                                >
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

                                    {/* Package thumbnail */}
                                    <PackageIcon pkg={pkg} />
                                    
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-1">
                                        <h4 className="font-medium text-gray-800">{pkg.name}</h4>
                                        {pkg.is_default && (
                                          <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                            DEFAULT
                                          </span>
                                        )}
                                      </div>
                                      {pkg.description && (
                                        <p className="text-sm text-gray-600 mb-1">{pkg.description}</p>
                                      )}
                                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                          {pkg.print_size}
                                        </span>
                                        <span>{pkg.template_count} templates</span>
                                        <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                          {pkg.is_unlimited_photos ? 'Unlimited photos' : `${pkg.photo_limit} photos max`}
                                        </span>
                                        {pkg.price && <span>₱{pkg.price}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  
                                  <div className="flex items-center space-x-1 ml-3">
                                    <button
                                      onClick={() => loadPackageDetails(pkg.id)}
                                      className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                      title="View Details"
                                    >
                                      👁️
                                    </button>
                                    <button
                                      onClick={() => handleToggleActive(pkg)}
                                      className={`px-2 py-1 text-xs rounded transition-colors ${
                                        pkg.is_active
                                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                      }`}
                                      title={pkg.is_active ? 'Deactivate' : 'Activate'}
                                    >
                                      {pkg.is_active ? '✓' : '○'}
                                    </button>
                                    {!pkg.is_default && pkg.is_active && (
                                      <button
                                        onClick={() => handleSetDefault(pkg)}
                                        className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors"
                                        title="Set as Default"
                                      >
                                        ⭐
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </Reorder.Item>
                            ))}
                          </Reorder.Group>
                        ) : (
                          <div className="text-center py-8 text-gray-500">
                            <div className="text-4xl mb-2">📦</div>
                            <p className="text-sm">No packages in this group</p>
                            <p className="text-xs mt-1">Create a package and assign it to this group</p>
                          </div>
                        )}
                        </div>
                        </div>
                      </Reorder.Item>
                    ))}
                  </Reorder.Group>

                  {/* Ungrouped Packages */}
                  {ungroupedPackages.length > 0 && (
                    <div className="bg-white rounded-lg border-2 border-dashed border-gray-300">
                      <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-600">Ungrouped Packages</h3>
                          <p className="text-sm text-gray-500 mt-1">Packages not assigned to any group</p>
                          <div className="text-xs text-gray-500 mt-1">
                            {ungroupedPackages.length} package{ungroupedPackages.length === 1 ? '' : 's'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4">
                        <Reorder.Group
                          axis="y"
                          values={ungroupedPackages}
                          onReorder={sortMode ? (newOrder) => {
                            setUngroupedPackages(newOrder);
                            // Update sort order in database
                            newOrder.forEach(async (pkg, index) => {
                              await manualPackageService.updatePackage(pkg.id, { sort_order: index + 1 });
                            });
                          } : () => {}}
                          className="space-y-3"
                        >
                          {ungroupedPackages.map((pkg) => (
                            <Reorder.Item
                              key={pkg.id}
                              value={pkg}
                              className={`rounded-lg p-3 border transition-all duration-200 cursor-pointer hover:shadow-md ${
                                isPackageSelected(pkg.id)
                                  ? 'bg-blue-50 border-blue-300'
                                  : pkg.is_active
                                    ? pkg.is_default
                                      ? 'border-green-400 bg-green-50'
                                      : 'border-green-200 bg-gray-50'
                                    : 'border-gray-300 bg-gray-50 opacity-60'
                              }`}
                              drag={sortMode}
                              whileDrag={sortMode ? { 
                                scale: 1.02, 
                                boxShadow: "0 5px 15px rgba(0,0,0,0.1)",
                                zIndex: 50 
                              } : false}
                            >
                              <div 
                                className="flex items-start justify-between"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  togglePackageSelection(pkg.id);
                                }}
                                data-package-item
                              >
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

                                  {/* Package thumbnail */}
                                  <PackageIcon pkg={pkg} />
                                  
                                  <div className="flex-1">
                                    <div className="flex items-center space-x-2 mb-1">
                                      <h4 className="font-medium text-gray-800">{pkg.name}</h4>
                                      {pkg.is_default && (
                                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                                          DEFAULT
                                        </span>
                                      )}
                                    </div>
                                    {pkg.description && (
                                      <p className="text-sm text-gray-600 mb-1">{pkg.description}</p>
                                    )}
                                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                        {pkg.print_size}
                                      </span>
                                      <span>{pkg.template_count} templates</span>
                                      <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                        {pkg.is_unlimited_photos ? 'Unlimited photos' : `${pkg.photo_limit} photos max`}
                                      </span>
                                      {pkg.price && <span>₱{pkg.price}</span>}
                                      <select
                                        value=""
                                        onChange={(e) => handleMovePackageToGroup(pkg.id, e.target.value || null)}
                                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <option value="">Move to group...</option>
                                        {groups.map(group => (
                                          <option key={group.id} value={group.id}>
                                            {group.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center space-x-1 ml-3">
                                  <button
                                    onClick={() => loadPackageDetails(pkg.id)}
                                    className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                                    title="View Details"
                                  >
                                    👁️
                                  </button>
                                  <button
                                    onClick={() => handleToggleActive(pkg)}
                                    className={`px-2 py-1 text-xs rounded transition-colors ${
                                      pkg.is_active
                                        ? 'bg-green-100 text-green-800 hover:bg-green-200'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                                    title={pkg.is_active ? 'Deactivate' : 'Activate'}
                                  >
                                    {pkg.is_active ? '✓' : '○'}
                                  </button>
                                  {!pkg.is_default && pkg.is_active && (
                                    <button
                                      onClick={() => handleSetDefault(pkg)}
                                      className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors"
                                      title="Set as Default"
                                    >
                                      ⭐
                                    </button>
                                  )}
                                </div>
                              </div>
                            </Reorder.Item>
                          ))}
                        </Reorder.Group>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📦</div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Packages Found</h3>
                  <p className="text-gray-600 mb-4">
                    Create your first package and group to get started.
                  </p>
                  <div className="flex justify-center space-x-3">
                    <button
                      onClick={handleCreateGroup}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Create First Group
                    </button>
                    <button
                      onClick={handleCreateNew}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Create First Package
                    </button>
                  </div>
                </div>
              )}

              {/* Statistics */}
              {packages.length > 0 && (
                <div className="text-center text-gray-500 text-sm border-t border-gray-200 pt-4 mt-6">
                  Total: {packages.length} package{packages.length === 1 ? '' : 's'} 
                  ({packages.filter(p => p.is_active).length} active) • 
                  {groups.length} group{groups.length === 1 ? '' : 's'}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Create/Edit Group Modal */}
      {showCreateGroupForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingGroup ? 'Edit Group' : 'Create New Group'}
                </h2>
                <button
                  onClick={() => setShowCreateGroupForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleGroupFormSubmit} className="space-y-4">
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Group Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={groupFormData.name}
                    onChange={(e) => setGroupFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., Premium Packages, Student Packages"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={groupFormData.description}
                    onChange={(e) => setGroupFormData(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows={3}
                    placeholder="Optional description for this group..."
                  />
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateGroupForm(false)}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !groupFormData.name.trim()}
                    className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting 
                      ? (editingGroup ? 'Updating...' : 'Creating...') 
                      : (editingGroup ? 'Update Group' : 'Create Group')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">
                  {editingPackage ? 'Edit Package' : 'Create New Package'}
                </h2>
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setThumbnailValidation({ isValidating: false, isValid: null, error: null, transformedUrl: null });
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleFormSubmit} className="space-y-6">
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

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left column: Package Info */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Package Name *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g., Wedding Essentials Package"
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
                        rows={3}
                        placeholder="Package description..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Package Group
                      </label>
                      <select
                        value={formData.group_id || ''}
                        onChange={(e) => setFormData(prev => ({ 
                          ...prev, 
                          group_id: e.target.value || undefined 
                        }))}
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">No Group (Ungrouped)</option>
                        {groups.map(group => (
                          <option key={group.id} value={group.id}>
                            {group.name}
                          </option>
                        ))}
                      </select>
                      <div className="text-xs text-gray-500 mt-1">
                        Optional: Assign this package to a group for organization
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Number of Prints *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="20"
                          value={formData.number_of_prints}
                          onChange={(e) => handleNumberOfPrintsChange(parseInt(e.target.value) || 1)}
                          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="1"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          How many prints included?
                        </div>
                      </div>

                      <div>
                        <div className="mb-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={formData.is_unlimited_photos}
                              onChange={(e) => setFormData(prev => ({ 
                                ...prev, 
                                is_unlimited_photos: e.target.checked,
                                // Reset photo_limit to 20 when toggling off unlimited
                                photo_limit: e.target.checked ? prev.photo_limit : 20
                              }))}
                              className="mr-2"
                            />
                            <span className="text-sm font-medium text-gray-700">
                              Unlimited Photos (Student/All Soft Copies Package)
                            </span>
                          </label>
                          <div className="text-xs text-gray-500 mt-1">
                            When enabled, clients can select unlimited photos without restriction
                          </div>
                        </div>

                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Photo Limit *
                        </label>
                        <input
                          type="number"
                          required
                          min="1"
                          max="500"
                          value={formData.photo_limit}
                          disabled={formData.is_unlimited_photos}
                          onChange={(e) => setFormData(prev => ({ 
                            ...prev, 
                            photo_limit: parseInt(e.target.value) || 20 
                          }))}
                          className={`w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            formData.is_unlimited_photos ? 'bg-gray-100 text-gray-500' : ''
                          }`}
                          placeholder="20"
                        />
                        <div className="text-xs text-gray-500 mt-1">
                          {formData.is_unlimited_photos 
                            ? 'Photo limit is ignored when unlimited photos is enabled'
                            : 'Max photos client can select'
                          }
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Price (₱)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.price}
                          onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                          className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Thumbnail URL
                      </label>
                      <div className="space-y-3">
                        <div className="relative">
                          <input
                            type="url"
                            value={formData.thumbnail_url}
                            onChange={(e) => {
                              setFormData(prev => ({ ...prev, thumbnail_url: e.target.value }));
                              // Reset validation when user types
                              if (e.target.value !== formData.thumbnail_url) {
                                setThumbnailValidation({ isValidating: false, isValid: null, error: null, transformedUrl: null });
                              }
                            }}
                            className={`w-full p-2 pr-10 border rounded focus:outline-none focus:ring-2 ${
                              thumbnailValidation.isValid === true
                                ? 'border-green-300 focus:ring-green-500'
                                : thumbnailValidation.isValid === false
                                ? 'border-red-300 focus:ring-red-500'
                                : 'border-gray-300 focus:ring-blue-500'
                            }`}
                            placeholder="https://... or Google Drive share URL"
                          />
                          
                          {/* Validation indicator */}
                          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                            {thumbnailValidation.isValidating && (
                              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            )}
                            {thumbnailValidation.isValid === true && (
                              <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {thumbnailValidation.isValid === false && (
                              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            )}
                          </div>
                        </div>

                        {/* Validation messages */}
                        {thumbnailValidation.transformedUrl && (
                          <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                            <strong>Auto-transformed:</strong> Google Drive URL converted to direct image link
                          </div>
                        )}
                        
                        {thumbnailValidation.error && (
                          <div className="text-xs text-red-600 bg-red-50 p-2 rounded">
                            <strong>Error:</strong> {thumbnailValidation.error}
                          </div>
                        )}

                        {/* Image preview */}
                        {thumbnailValidation.isValid && formData.thumbnail_url && (
                          <div className="border border-gray-200 rounded p-3 bg-gray-50">
                            <div className="text-xs text-gray-600 mb-2">Preview:</div>
                            <img
                              src={thumbnailValidation.transformedUrl || formData.thumbnail_url}
                              alt="Thumbnail preview"
                              className="w-24 h-24 object-cover rounded border"
                              onError={() => {
                                setThumbnailValidation(prev => ({ 
                                  ...prev, 
                                  isValid: false, 
                                  error: 'Image failed to load in preview' 
                                }));
                              }}
                            />
                          </div>
                        )}
                        
                        <div className="text-xs text-gray-500">
                          💡 Supports direct image URLs and Google Drive share links
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right column: Print Positions */}
                  <div>
                    <div className="mb-3">
                      <label className="block text-sm font-medium text-gray-700">
                        Default Templates for Each Print Position
                      </label>
                      <div className="text-xs text-gray-500 mt-1">
                        Set the default template for each print in this package
                      </div>
                    </div>
                    
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {formData.print_positions.map((position) => (
                        <div
                          key={position.position}
                          className="border border-gray-200 rounded-lg p-3 bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm text-gray-700">
                              Print #{position.position}
                            </span>
                            {position.template_name && (
                              <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                                {position.template_name}
                              </span>
                            )}
                          </div>
                          
                          <select
                            key={`${position.position}-${availableTemplates.length}`}
                            value={position.default_template_id || ''}
                            onChange={(e) => handleTemplateChange(position.position, e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                            disabled={isLoadingTemplates}
                          >
                            <option value="">
                              {isLoadingTemplates 
                                ? 'Loading templates...' 
                                : availableTemplates.length === 0 
                                  ? 'No templates available - create templates first' 
                                  : 'Select default template...'}
                            </option>
                            {!isLoadingTemplates && availableTemplates.map(template => (
                              <option key={template.id} value={template.id}>
                                {template.name} ({template.template_type} - {template.print_size}){!template.is_active ? ' [INACTIVE]' : ''}
                              </option>
                            ))}
                          </select>
                          
                          {isLoadingTemplates && (
                            <div className="text-xs text-blue-600 mt-1 flex items-center">
                              <div className="animate-spin w-3 h-3 border border-blue-600 border-t-transparent rounded-full mr-1"></div>
                              Loading your templates...
                            </div>
                          )}
                          
                          {!isLoadingTemplates && availableTemplates.length === 0 && (
                            <div className="text-xs text-orange-600 mt-1">
                              💡 Go to "Manage PNG Templates" to create templates first
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {formData.print_positions.length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                          <div className="text-2xl mb-2">📋</div>
                          <p>Set number of prints above to configure positions</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateForm(false);
                      setThumbnailValidation({ isValidating: false, isValid: null, error: null, transformedUrl: null });
                    }}
                    className="px-4 py-2 text-gray-600 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || formData.print_positions.filter(p => p.default_template_id).length === 0}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting 
                      ? (editingPackage ? 'Updating...' : 'Creating...') 
                      : (editingPackage ? 'Update Package' : 'Create Package')
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Package Details Modal */}
      {showPackageDetails && packageDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">{packageDetails.name} Details</h2>
                <button
                  onClick={() => setShowPackageDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Print Size:</span> {packageDetails.print_size}
                  </div>
                  <div>
                    <span className="font-medium">Template Count:</span> {packageDetails.template_count}
                  </div>
                  <div>
                    <span className="font-medium">Photo Limit:</span> {packageDetails.is_unlimited_photos ? 'Unlimited photos' : `${packageDetails.photo_limit} photos max`}
                  </div>
                  <div>
                    <span className="font-medium">Price:</span> {packageDetails.price ? `₱${packageDetails.price}` : 'Free'}
                  </div>
                  <div>
                    <span className="font-medium">Status:</span> 
                    <span className={`ml-1 px-2 py-1 rounded text-xs ${
                      packageDetails.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {packageDetails.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {packageDetails.is_default && (
                      <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                        DEFAULT
                      </span>
                    )}
                  </div>
                </div>

                {packageDetails.description && (
                  <div>
                    <span className="font-medium">Description:</span>
                    <p className="text-gray-600 mt-1">{packageDetails.description}</p>
                  </div>
                )}

                <div>
                  <h3 className="font-medium mb-3">Templates in Package ({packageDetails.package_templates.length})</h3>
                  <div className="space-y-2">
                    {packageDetails.package_templates.length > 0 ? (
                      packageDetails.package_templates
                        .sort((a, b) => a.order_index - b.order_index)
                        .map((pt, index) => (
                          <div key={pt.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                            <span className="text-sm text-gray-500 w-6">#{index + 1}</span>
                            <div className="flex-1">
                              <div className="font-medium text-sm">{pt.template.name}</div>
                              <div className="text-xs text-gray-500">
                                {pt.template.template_type} • {pt.template.holes_data.length} holes
                              </div>
                            </div>
                          </div>
                        ))
                    ) : (
                      <p className="text-gray-500 text-sm">No templates in this package</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg w-full max-w-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Confirm Deletion</h2>
                <button
                  onClick={handleCancelDelete}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to delete the following item? This action cannot be undone.
                </p>

                {/* List items to be deleted */}
                <div className="bg-gray-50 rounded-lg p-4 max-h-40 overflow-y-auto">
                  {deleteItems.groups.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-700 mb-2">Groups:</div>
                      {deleteItems.groups.map(group => (
                        <div key={group.id} className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                          <span className="text-green-600">📁</span>
                          <span>{group.name}</span>
                          {group.description && (
                            <span className="text-gray-400">- {group.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {deleteItems.packages.length > 0 && (
                    <div>
                      <div className="text-sm font-medium text-gray-700 mb-2">Packages:</div>
                      {deleteItems.packages.map(pkg => (
                        <div key={pkg.id} className="flex items-center space-x-2 text-sm text-gray-600 mb-1">
                          <span className="text-blue-600">📦</span>
                          <span>{pkg.name}</span>
                          {pkg.description && (
                            <span className="text-gray-400">- {pkg.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {deleteItems.groups.length > 0 && (
                  <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                    <strong>Note:</strong> Deleting groups will move their packages to "Ungrouped".
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end space-x-3">
                <button
                  onClick={handleCancelDelete}
                  className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}