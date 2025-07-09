import { Package, Photo, DriveFolder } from '../../types';
import { useState } from 'react';

interface PackageSelectionScreenProps {
  clientName: string;
  selectedClientFolder: DriveFolder | null;
  photos: Photo[];
  packages: Package[];
  selectedPackage: Package | null;
  addonPrints: number;
  setSelectedPackage: (pkg: Package) => void;
  setAddonPrints: (count: number) => void;
  handleBack: () => void;
  handlePackageContinue: () => void;
}

export default function PackageSelectionScreen({
  clientName,
  selectedClientFolder,
  photos,
  packages,
  selectedPackage,
  addonPrints,
  setSelectedPackage,
  setAddonPrints,
  handleBack,
  handlePackageContinue,
}: PackageSelectionScreenProps) {
  const handlePackageSelect = (pkg: Package) => {
    setSelectedPackage(pkg);
    setAddonPrints(0); // Reset add-ons when selecting a new package
  };

  const getTotalPrice = () => {
    if (!selectedPackage) return 0;
    return selectedPackage.price + (addonPrints * (selectedPackage.addonPrintPrice || 0));
  };

  const getTotalPrints = () => {
    if (!selectedPackage) return 0;
    return selectedPackage.templateCount + addonPrints;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Package Selection
          </h1>
          <p className="text-gray-600 text-lg">
            Select your photo package for {clientName}
          </p>
          <div className="mt-2 text-sm text-blue-600">
            📁 {selectedClientFolder?.name} • {photos.length} photos available
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {packages.map((pkg) => (
            <div
              key={pkg.id}
              onClick={() => handlePackageSelect(pkg)}
              className={`bg-white rounded-lg p-6 cursor-pointer transition-all duration-200 shadow-sm hover:shadow-md ${
                selectedPackage?.id === pkg.id
                  ? 'ring-2 ring-blue-500 bg-blue-50'
                  : 'hover:bg-gray-50'
              }`}
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-2">
                  {pkg.id}
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  {pkg.name}
                </h3>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  ₱{pkg.price}
                </div>
                <div className="text-lg text-blue-600 font-medium mb-3">
                  {pkg.templateCount} {pkg.templateCount === 1 ? 'Print' : 'Prints'}
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {pkg.description}
                </p>
                {pkg.addonPrintPrice && (
                  <div className="text-xs text-gray-500 border-t pt-2">
                    Add-on: ₱{pkg.addonPrintPrice} per print
                    <br />
                    (Max {pkg.maxAddonPrints} add-ons)
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add-on Section */}
        {selectedPackage && selectedPackage.addonPrintPrice && (
          <div className="bg-white rounded-lg p-6 mb-6 shadow-sm">
            <h3 className="text-xl font-semibold text-gray-800 mb-4 text-center">
              Add Additional Prints
            </h3>
            <div className="flex items-center justify-center space-x-4">
              <button
                onClick={() => setAddonPrints(Math.max(0, addonPrints - 1))}
                disabled={addonPrints === 0}
                className="bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:text-gray-400 text-gray-700 w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl transition-colors"
              >
                -
              </button>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600 mb-1">
                  {addonPrints}
                </div>
                <div className="text-sm text-gray-600">
                  Additional {addonPrints === 1 ? 'Print' : 'Prints'}
                </div>
              </div>
              <button
                onClick={() => setAddonPrints(Math.min(selectedPackage.maxAddonPrints || 0, addonPrints + 1))}
                disabled={addonPrints >= (selectedPackage.maxAddonPrints || 0)}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-100 disabled:text-gray-400 text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-xl transition-colors"
              >
                +
              </button>
            </div>
            {addonPrints > 0 && (
              <div className="mt-4 text-center text-sm text-gray-600">
                Add-on cost: ₱{addonPrints * (selectedPackage.addonPrintPrice || 0)}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-between">
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            ← Back to Folders
          </button>
          <button
            onClick={handlePackageContinue}
            disabled={!selectedPackage}
            className={`px-8 py-3 rounded-lg font-medium text-lg transition-all duration-200 ${
              selectedPackage
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continue to Print Selection
          </button>
        </div>

        {selectedPackage && (
          <div className="mt-6 text-center">
            <div className="bg-blue-50 rounded-lg p-4 inline-block">
              <p className="text-gray-600 mb-2">
                Selected: <span className="font-medium text-gray-800">{selectedPackage.name}</span>
              </p>
              <p className="text-lg font-semibold text-blue-600">
                {getTotalPrints()} total print(s) • ₱{getTotalPrice()}
              </p>
              {addonPrints > 0 && (
                <p className="text-sm text-gray-600 mt-1">
                  Base: {selectedPackage.templateCount} print(s) + {addonPrints} add-on(s)
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 