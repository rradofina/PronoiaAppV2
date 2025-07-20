import { Package, Photo, DriveFolder } from '../../types';
import { useState } from 'react';

interface PackageSelectionScreenProps {
  clientName: string;
  selectedClientFolder: DriveFolder | null;
  photos: Photo[];
  packages: Package[];
  selectedPackage: Package | null;
  setSelectedPackage: (pkg: Package) => void;
  handleBack: () => void;
  handlePackageContinue: () => void;
}

export default function PackageSelectionScreen({
  clientName,
  selectedClientFolder,
  photos,
  packages,
  selectedPackage,
  setSelectedPackage,
  handleBack,
  handlePackageContinue,
}: PackageSelectionScreenProps) {

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
              onClick={() => setSelectedPackage(pkg)}
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
                <p className="text-sm text-gray-600">
                  {pkg.description}
                </p>
              </div>
            </div>
          ))}
        </div>


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
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 inline-block">
              <p className="text-gray-800 font-medium">
                📦 Selected: <span className="text-blue-700">{selectedPackage.name}</span>
              </p>
              <p className="text-gray-700 mt-1">
                🖼️ Prints Included: <span className="font-semibold">{selectedPackage.templateCount}</span>
              </p>
              <p className="text-gray-700 mt-1">
                💰 Package Price: <span className="font-bold text-xl">₱{selectedPackage.price?.toLocaleString()}</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 