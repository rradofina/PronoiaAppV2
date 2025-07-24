import { GoogleAuth, DriveFolder, Package } from '../../types';
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
  setSelectedPackage: (pkg: Package) => void;
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
  const [packages, setPackages] = useState<any[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(false);
  const [packageError, setPackageError] = useState<string | null>(null);

  // Load dynamic packages from manual package service
  const loadPackages = async () => {
    setIsLoadingPackages(true);
    setPackageError(null);
    try {
      const groups = await packageGroupService.getGroupsWithPackages();
      
      // Flatten all packages from all groups and add ungrouped packages
      const allPackages = groups.flatMap(group => 
        group.packages.map(pkg => ({
          id: pkg.id,
          name: pkg.name,
          templateCount: pkg.template_count,
          price: pkg.price,
          description: pkg.description || `${pkg.template_count} template${pkg.template_count === 1 ? '' : 's'}`
        }))
      );
      
      setPackages(allPackages);
      console.log('✅ Loaded', allPackages.length, 'packages from manual package service');
    } catch (error: any) {
      console.error('❌ Error loading packages:', error);
      setPackageError(error.message || 'Failed to load packages');
      // Fallback to empty array
      setPackages([]);
    } finally {
      setIsLoadingPackages(false);
    }
  };

  // Load packages when component mounts or when showing package selection
  useEffect(() => {
    if (showPackageSelection) {
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

              {/* Packages Grid */}
              {!isLoadingPackages && !packageError && (
                <>
                  {packages.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {packages.map((pkg) => (
                  <div
                    key={pkg.id}
                    onClick={() => setSelectedPackage(pkg)}
                    className={`bg-white rounded-xl p-6 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${
                      selectedPackage?.id === pkg.id
                        ? 'ring-2 ring-blue-500 bg-blue-50'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-lg font-bold text-white">📦</span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-2">
                        {pkg.name}
                      </h3>
                      {pkg.price && (
                        <div className="text-2xl font-bold text-green-600 mb-2">
                          ₱{pkg.price.toLocaleString()}
                        </div>
                      )}
                      <div className="text-3xl font-bold text-blue-600 mb-2">
                        {pkg.templateCount}
                      </div>
                      <p className="text-sm text-gray-500 mb-4">
                        {pkg.description}
                      </p>
                      <div className="text-xs text-blue-600 font-medium">
                        {pkg.templateCount} Template{pkg.templateCount > 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                      ))}
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

              {selectedPackage && !isLoadingPackages && (
                <div className="mt-8 text-center">
                  <button
                    onClick={handlePackageContinue}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors shadow-md"
                  >
                    Continue with {selectedPackage.name}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 