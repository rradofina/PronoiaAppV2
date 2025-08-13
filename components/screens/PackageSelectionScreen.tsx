import { Package, Photo, DriveFolder, ManualTemplate } from '../../types';
import { useState, useEffect } from 'react';
import PackageTemplatePreview from '../PackageTemplatePreview';
import { manualPackageService } from '../../services/manualPackageService';

interface PackageSelectionScreenProps {
  clientName: string;
  selectedClientFolder: DriveFolder | null;
  photos: Photo[];
  packages: Package[];
  selectedPackage: Package | null;
  setSelectedPackage: (pkg: Package) => void;
  handleBack: () => void;
  handlePackageContinue: (templates?: ManualTemplate[]) => void;
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
  const [templates, setTemplates] = useState<ManualTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  
  // Load templates when component mounts or selected package changes
  useEffect(() => {
    const loadTemplates = async () => {
      if (selectedPackage) {
        setIsLoadingTemplates(true);
        setTemplateError(null);
        try {
          const packageWithTemplates = await manualPackageService.getPackageWithTemplates(selectedPackage.id);
          if (packageWithTemplates && packageWithTemplates.templates) {
            setTemplates(packageWithTemplates.templates);
            console.log('✅ Loaded templates for package:', packageWithTemplates.templates.length);
          } else {
            setTemplates([]);
            setTemplateError('No templates found for this package');
          }
        } catch (error) {
          console.error('❌ Error loading templates:', error);
          setTemplates([]);
          setTemplateError('Failed to load templates');
        } finally {
          setIsLoadingTemplates(false);
        }
      }
    };
    
    loadTemplates();
  }, [selectedPackage]);

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        PackageSelectionScreen.tsx
      </div>
      
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Selected Package
          </h1>
          <p className="text-gray-600">
            Viewing package details for {clientName}
          </p>
          <div className="mt-2 text-sm text-blue-600">
            📁 {selectedClientFolder?.name} • {photos.length} photos available
          </div>
        </div>

        {selectedPackage ? (
          <>
            {/* Selected Package Display */}
            <div className="bg-white rounded-lg p-6 shadow-md border-2 border-blue-500 mb-6">
              <div className="text-center">
                <h3 className="text-2xl font-semibold text-gray-800 mb-2">
                  {selectedPackage.name}
                </h3>
                <div className="text-2xl font-bold text-gray-900 mb-2">
                  ₱{selectedPackage.price}
                </div>
                <div className="text-lg text-blue-600 font-medium mb-3">
                  {selectedPackage.templateCount} {selectedPackage.templateCount === 1 ? 'Print' : 'Prints'}
                </div>
                <p className="text-gray-600">
                  {selectedPackage.description}
                </p>
              </div>
            </div>

            {/* Templates Preview */}
            <PackageTemplatePreview
              templates={templates}
              packageName={selectedPackage.name}
              packageId={selectedPackage.id.toString()}
              onContinue={() => {
                // Pass the current templates (including added ones) to handlePackageContinue
                console.log('📋 Continuing with templates:', templates.length);
                handlePackageContinue(templates);
              }}
              onChangePackage={handleBack}
              availablePhotos={photos}
              loading={isLoadingTemplates}
              onTemplateAdd={(template) => {
                // Add the new template to the list
                setTemplates([...templates, { ...template, _isFromAddition: true }]);
                console.log('Template added:', template.name);
              }}
              onTemplateDelete={(templateIndex) => {
                // Remove the template at the specified index
                setTemplates(templates.filter((_, index) => index !== templateIndex));
                console.log('Template deleted at index:', templateIndex);
              }}
            />
          </>
        ) : (
          /* No package selected - show message */
          <div className="bg-white rounded-lg p-8 text-center">
            <div className="text-gray-500 mb-4">
              <div className="text-6xl mb-4">📦</div>
              <p className="text-xl">No package selected</p>
              <p className="text-sm mt-2">Please go back and select a package</p>
            </div>
            <button
              onClick={handleBack}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              ← Back to Package Selection
            </button>
          </div>
        )}
      </div>
    </div>
  );
} 