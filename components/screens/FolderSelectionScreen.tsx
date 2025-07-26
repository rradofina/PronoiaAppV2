import { GoogleAuth, DriveFolder, Package, PackageGroup, ManualPackage } from '../../types';
import HeaderNavigation from '../HeaderNavigation';
import { useState, useEffect } from 'react';
import { manualPackageService } from '../../services/manualPackageService';
import { packageGroupService } from '../../services/packageGroupService';

interface FolderSelectionScreenProps {
  googleAuth: GoogleAuth;
  selectedMainFolder: DriveFolder | null;
  clientFolders: DriveFolder[];
  handleClientFolderSelect: (folder: DriveFolder) => void;
  mainSessionsFolder: { id: string; name: string } | null;
  onSignOut: () => void;
  onChangeMainFolder: () => void;
  // New props for package selection
  selectedPackage: Package | null;
  setSelectedPackage: (pkg: Package | null) => void;
  handleContinue: () => void;
  // New prop for template management
  onManageTemplates: () => void;
  // New prop for package management
  onManagePackages?: () => void;
}

export default function FolderSelectionScreen({
  googleAuth,
  selectedMainFolder,
  clientFolders,
  handleClientFolderSelect,
  mainSessionsFolder,
  onSignOut,
  onChangeMainFolder,
  selectedPackage,
  setSelectedPackage,
  handleContinue,
  onManageTemplates,
  onManagePackages,
}: FolderSelectionScreenProps) {
  const [selectedFolder, setSelectedFolder] = useState<DriveFolder | null>(null);
  const [showPackageSelection, setShowPackageSelection] = useState(false);
  const [groups, setGroups] = useState<PackageGroup[]>([]);
  const [groupedPackages, setGroupedPackages] = useState<{ [groupId: string]: ManualPackage[] }>({});
  const [ungroupedPackages, setUngroupedPackages] = useState<ManualPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);

  // Utility function to transform Google Drive URLs to direct image URLs
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

  // Package Icon Component
  const PackageIcon = ({ pkg, size = "w-16 h-16", isUngrouped = false }: { 
    pkg: ManualPackage; 
    size?: string; 
    isUngrouped?: boolean; 
  }) => {
    const thumbnailUrl = getPackageThumbnailUrl(pkg);
    const [imageError, setImageError] = useState(false);

    if (thumbnailUrl && !imageError) {
      return (
        <div className={`${size} rounded-full overflow-hidden border-2 border-white shadow-sm mr-4 flex-shrink-0`}>
          <img
            src={thumbnailUrl}
            alt={`${pkg.name} thumbnail`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    // Fallback to icon
    const iconColors = isUngrouped 
      ? "from-gray-400 to-gray-600" 
      : "from-blue-400 to-blue-600";

    return (
      <div className={`${size} bg-gradient-to-br ${iconColors} rounded-full flex items-center justify-center mr-4 flex-shrink-0`}>
        <span className="text-white font-bold">📦</span>
      </div>
    );
  };

  // Load dynamic packages from manual package service
  const loadPackages = async () => {
    setIsLoadingPackages(true);
    setPackageError(null);
    try {
      // Load groups and packages separately
      const allGroups = await packageGroupService.getActiveGroups();
      const allPackages = await manualPackageService.getActivePackages();
      
      setGroups(allGroups);
      
      // Organize packages by group
      const grouped: { [groupId: string]: ManualPackage[] } = {};
      const ungrouped: ManualPackage[] = [];

      allPackages.forEach(pkg => {
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
      
      console.log('✅ Loaded', allPackages.length, 'packages from manual package service');
    } catch (error: any) {
      console.error('❌ Error loading packages:', error);
      setPackageError(error.message || 'Failed to load packages');
      // Fallback to empty arrays
      setGroups([]);
      setGroupedPackages({});
      setUngroupedPackages([]);
    } finally {
      setIsLoadingPackages(false);
    }
  };

  // Load packages when component mounts or when showing package selection
  useEffect(() => {
    if (showPackageSelection) {
      setSelectedPackage(null); // Reset selected package when entering package selection
      loadPackages();
    }
  }, [showPackageSelection]);

  const handleFolderSelect = (folder: DriveFolder) => {
    setSelectedFolder(folder);
    handleClientFolderSelect(folder); // Still call the original handler for data loading
    setShowPackageSelection(true); // Show package selection step
  };

  const handleBackToFolders = () => {
    setShowPackageSelection(false);
    setSelectedFolder(null);
    setSelectedPackage(null);
  };

  const handlePackageContinue = () => {
    if (selectedFolder && selectedPackage) {
      handleContinue(); // Continue to next screen
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        FolderSelectionScreen.tsx
      </div>
      <HeaderNavigation
        googleAuth={googleAuth}
        mainSessionsFolder={mainSessionsFolder}
        onSignOut={onSignOut}
        onChangeMainFolder={onChangeMainFolder}
        showMainFolder={true}
      />
      
      <div className="p-4">
        <div className="max-w-4xl mx-auto">
          
          {/* Step 1: Folder Selection */}
          {!showPackageSelection && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  Select Client Folder
                </h1>
                <p className="text-gray-600 text-lg">
                  Choose the client's photo session folder
                </p>
                <div className="mt-2 text-sm text-blue-600">
                  Main folder: {selectedMainFolder?.name}
                </div>
                
                {/* Admin Management Buttons */}
                <div className="mt-4 flex flex-col sm:flex-row gap-3 items-center justify-center">
                  <button
                    onClick={onManageTemplates}
                    className="inline-flex items-center space-x-2 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium shadow-md"
                  >
                    <span>🖼️</span>
                    <span>Manage Templates</span>
                    <span className="text-xs bg-purple-500 px-2 py-1 rounded">Admin</span>
                  </button>
                  
                  {onManagePackages && (
                    <button
                      onClick={onManagePackages}
                      className="inline-flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-md"
                    >
                      <span>📦</span>
                      <span>Manage Packages</span>
                      <span className="text-xs bg-green-500 px-2 py-1 rounded">Admin</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white rounded-lg p-6 shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
                  {clientFolders.map((folder) => (
                    <div
                      key={folder.id}
                      onClick={() => handleFolderSelect(folder)}
                      className="bg-gray-50 rounded-lg p-4 cursor-pointer hover:bg-blue-50 hover:border-blue-300 border-2 border-transparent transition-all duration-200"
                    >
                      <div className="flex items-center">
                        <div className="text-2xl mr-3">👥</div>
                        <div>
                          <p className="font-medium text-gray-800">{folder.name}</p>
                          <p className="text-xs text-gray-500">
                            {new Date(folder.createdTime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {clientFolders.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No client folders found in this directory
                  </div>
                )}
              </div>
            </>
          )}

          {/* Step 2: Package Selection */}
          {showPackageSelection && (
            <>
              <div className="text-center mb-8">
                <h1 className="text-4xl font-bold text-gray-800 mb-2">
                  Select Package
                </h1>
                <p className="text-gray-600 text-lg">
                  Choose your photo package for <span className="font-semibold text-blue-600">{selectedFolder?.name}</span>
                </p>
                
                <button
                  onClick={handleBackToFolders}
                  className="mt-4 text-blue-600 hover:text-blue-800 text-sm underline"
                >
                  ← Change Client Folder
                </button>
              </div>

              {/* Loading State */}
              {isLoadingPackages && (
                <div className="text-center py-12">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                  <p className="text-gray-600">Loading packages...</p>
                </div>
              )}

              {/* Error State */}
              {packageError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 text-center">
                  <p className="text-red-600 font-medium mb-2">Failed to load packages</p>
                  <p className="text-red-500 text-sm mb-4">{packageError}</p>
                  <button
                    onClick={loadPackages}
                    className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
                  >
                    Retry
                  </button>
                </div>
              )}

              {/* Grouped Packages Display */}
              {!isLoadingPackages && !packageError && (
                <>
                  {(groups.length > 0 || ungroupedPackages.length > 0) ? (
                    <div className="space-y-8">
                      {/* Display Groups */}
                      {groups.map((group) => (
                        <div key={group.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          {/* Group Header */}
                          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
                            {group.description && (
                              <p className="text-sm text-gray-600 mt-1">{group.description}</p>
                            )}
                            <div className="text-xs text-gray-500 mt-1">
                              {groupedPackages[group.id]?.length || 0} package{(groupedPackages[group.id]?.length || 0) === 1 ? '' : 's'}
                            </div>
                          </div>

                          {/* Packages in Group */}
                          <div className="p-4">
                            {groupedPackages[group.id]?.length > 0 ? (
                              <div className="space-y-3">
                                {groupedPackages[group.id].map((pkg) => (
                                  <div
                                    key={pkg.id}
                                    onClick={() => {
                                      const packageData = {
                                        id: pkg.id,
                                        name: pkg.name,
                                        templateCount: pkg.template_count || 1,
                                        price: pkg.price || 0,
                                        description: pkg.description || `${pkg.template_count || 1} template${(pkg.template_count || 1) === 1 ? '' : 's'}`
                                      };
                                      
                                      // If already selected, continue to next screen
                                      if (selectedPackage?.id === pkg.id) {
                                        handlePackageContinue();
                                      } else {
                                        // First click: just select the package
                                        setSelectedPackage(packageData);
                                      }
                                    }}
                                    className={`flex items-center p-4 rounded-lg cursor-pointer transition-all duration-200 border ${
                                      selectedPackage?.id === pkg.id
                                        ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200'
                                        : 'hover:bg-gray-50 border-gray-200 bg-white'
                                    }`}
                                  >
                                    {/* Package Icon */}
                                    <PackageIcon pkg={pkg} />
                                    
                                    {/* Package Info */}
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <h4 className="text-lg font-bold text-gray-800">{pkg.name}</h4>
                                          <p className="text-sm text-gray-600 mt-1">
                                            {pkg.description || `${pkg.template_count} template${pkg.template_count === 1 ? '' : 's'}`}
                                          </p>
                                        </div>
                                        
                                        {/* Package Details */}
                                        <div className="text-right flex-shrink-0 ml-4">
                                          {pkg.price && (
                                            <div className="text-xl font-bold text-green-600">
                                              ₱{pkg.price.toLocaleString()}
                                            </div>
                                          )}
                                          <div className="text-sm text-blue-600 font-medium">
                                            {pkg.template_count} Print{pkg.template_count > 1 ? 's' : ''}
                                          </div>
                                          <div className="text-xs text-gray-500">
                                            {pkg.is_unlimited_photos ? 'Unlimited photos' : `${pkg.photo_limit} photos`}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Continue Arrow - only show when selected */}
                                    {selectedPackage?.id === pkg.id && (
                                      <div className="ml-3 flex items-center text-blue-500">
                                        <svg className="w-4 h-3" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8 text-gray-500">
                                <div className="text-4xl mb-2">📦</div>
                                <p className="text-sm">No packages in this group</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {/* Ungrouped Packages */}
                      {ungroupedPackages.length > 0 && (
                        <div className="bg-white rounded-lg border border-dashed border-gray-300 overflow-hidden">
                          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-600">Other Packages</h3>
                            <p className="text-sm text-gray-500 mt-1">Additional package options</p>
                            <div className="text-xs text-gray-500 mt-1">
                              {ungroupedPackages.length} package{ungroupedPackages.length === 1 ? '' : 's'}
                            </div>
                          </div>
                          
                          <div className="p-4">
                            <div className="space-y-3">
                              {ungroupedPackages.map((pkg) => (
                                <div
                                  key={pkg.id}
                                  onClick={() => {
                                    const packageData = {
                                      id: pkg.id,
                                      name: pkg.name,
                                      templateCount: pkg.template_count || 1,
                                      price: pkg.price || 0,
                                      description: pkg.description || `${pkg.template_count || 1} template${(pkg.template_count || 1) === 1 ? '' : 's'}`
                                    };
                                    
                                    // If already selected, continue to next screen
                                    if (selectedPackage?.id === pkg.id) {
                                      handlePackageContinue();
                                    } else {
                                      // First click: just select the package
                                      setSelectedPackage(packageData);
                                    }
                                  }}
                                  className={`flex items-center p-4 rounded-lg cursor-pointer transition-all duration-200 border ${
                                    selectedPackage?.id === pkg.id
                                      ? 'ring-2 ring-blue-500 bg-blue-50 border-blue-200'
                                      : 'hover:bg-gray-50 border-gray-200 bg-white'
                                  }`}
                                >
                                  {/* Package Icon */}
                                  <PackageIcon pkg={pkg} isUngrouped={true} />
                                  
                                  {/* Package Info */}
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between">
                                      <div>
                                        <h4 className="text-lg font-bold text-gray-800">{pkg.name}</h4>
                                        <p className="text-sm text-gray-600 mt-1">
                                          {pkg.description || `${pkg.template_count} template${pkg.template_count === 1 ? '' : 's'}`}
                                        </p>
                                      </div>
                                      
                                      {/* Package Details */}
                                      <div className="text-right flex-shrink-0 ml-4">
                                        {pkg.price && (
                                          <div className="text-xl font-bold text-green-600">
                                            ₱{pkg.price.toLocaleString()}
                                          </div>
                                        )}
                                        <div className="text-sm text-blue-600 font-medium">
                                          {pkg.template_count} Print{pkg.template_count > 1 ? 's' : ''}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {pkg.is_unlimited_photos ? 'Unlimited photos' : `${pkg.photo_limit} photos`}
                                        </div>
                                      </div>
                                    </div>
                                    
                                    {/* Continue Arrow - only show when selected */}
                                    {selectedPackage?.id === pkg.id && (
                                      <div className="ml-3 flex items-center text-blue-500">
                                        <svg className="w-4 h-3" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="text-gray-400 text-4xl mb-4">📦</div>
                      <p className="text-gray-600 font-medium mb-2">No packages found</p>
                      <p className="text-gray-500 text-sm mb-4">Create packages in the Package Manager to get started</p>
                      {onManagePackages && (
                        <button
                          onClick={onManagePackages}
                          className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Manage Packages
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}

            </>
          )}
        </div>
      </div>
    </div>
  );
} 