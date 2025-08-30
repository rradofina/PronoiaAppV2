import { Package, Photo, DriveFolder, ManualTemplate, TemplateSlot } from '../../types';
import { useState, useEffect, Fragment } from 'react';
import PackageTemplatePreview from '../PackageTemplatePreview';
import { manualPackageService } from '../../services/manualPackageService';
import { Dialog, Transition } from '@headlessui/react';

interface PackageSelectionScreenProps {
  clientName: string;
  selectedClientFolder: DriveFolder | null;
  photos: Photo[];
  packages: Package[];
  selectedPackage: Package | null;
  setSelectedPackage: (pkg: Package) => void;
  handleBack: () => void;
  handlePackageContinue: (templates?: ManualTemplate[]) => void;
  templateSlots?: TemplateSlot[];
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
  templateSlots = [],
}: PackageSelectionScreenProps) {
  const [templates, setTemplates] = useState<ManualTemplate[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
  const [templateError, setTemplateError] = useState<string | null>(null);
  const [originalTemplateCount, setOriginalTemplateCount] = useState(0);
  const [showBackConfirmation, setShowBackConfirmation] = useState(false);
  
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
            setOriginalTemplateCount(packageWithTemplates.templates.length); // Track original count
            console.log('✅ Loaded templates for package:', packageWithTemplates.templates.length);
          } else {
            setTemplates([]);
            setOriginalTemplateCount(0);
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
  
  // Handle back with confirmation
  const handleBackWithConfirmation = () => {
    setShowBackConfirmation(true);
  };
  
  // Confirm back navigation
  const confirmBackNavigation = () => {
    setShowBackConfirmation(false);
    handleBack();
  };
  
  // Cancel back navigation
  const cancelBackNavigation = () => {
    setShowBackConfirmation(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      {/* <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        PackageSelectionScreen.tsx
      </div> */}
      
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            Selected Package
          </h1>
          <div className="text-sm text-blue-600">
            📁 {selectedClientFolder?.name} • {photos.length} photos available
          </div>
        </div>

        {selectedPackage ? (
          <>
            {/* Selected Package Display */}
            <div className="bg-white rounded-lg p-4 shadow-md border-2 border-blue-500 mb-6">
              <div className="flex flex-col space-y-3">
                {/* Package name and key details in one line */}
                <div className="flex flex-wrap items-center gap-3">
                  <h3 className="text-xl font-semibold text-gray-800">
                    {selectedPackage.name}
                  </h3>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    ₱{selectedPackage.price}
                  </span>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    {selectedPackage.templateCount} {selectedPackage.templateCount === 1 ? 'Print' : 'Prints'}
                  </span>
                </div>
                
                {/* Description */}
                {selectedPackage.description && (
                  <p className="text-gray-600 text-sm leading-relaxed">
                    {selectedPackage.description}
                  </p>
                )}
              </div>
            </div>

            {/* Templates Preview */}
            <PackageTemplatePreview
              templates={templates}
              packageName={selectedPackage.name}
              packageId={selectedPackage.id.toString()}
              originalTemplateCount={originalTemplateCount}
              onContinue={() => {
                // Mark templates as additional if they're beyond the original count
                const templatesWithFlags = templates.map((template, index) => ({
                  ...template,
                  _isFromAddition: index >= originalTemplateCount
                }));
                // Pass the current templates (including added ones) to handlePackageContinue
                console.log('📋 Continuing with templates:', templates.length, `(${originalTemplateCount} original, ${templates.length - originalTemplateCount} additional)`);
                handlePackageContinue(templatesWithFlags);
              }}
              onChangePackage={handleBackWithConfirmation}
              availablePhotos={photos}
              loading={isLoadingTemplates}
              onTemplateReplace={(packageId, templateIndex, newTemplate) => {
                // Replace the template at the specified index
                const updatedTemplates = [...templates];
                updatedTemplates[templateIndex] = newTemplate;
                setTemplates(updatedTemplates);
                console.log('✅ Template replaced at index:', templateIndex, 'with:', newTemplate.name);
              }}
              onTemplateAdd={(template) => {
                // Add the new template to the list
                const newTemplates = [...templates, template];
                setTemplates(newTemplates);
                console.log('✅ Template added:', template.name);
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
      
      {/* Back Navigation Confirmation Dialog */}
      <Transition appear show={showBackConfirmation} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={cancelBackNavigation}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-50" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title
                    as="h3"
                    className="text-lg font-medium leading-6 text-gray-900 text-center"
                  >
                    Are you sure you want to go back?
                  </Dialog.Title>
                  
                  <div className="mt-4">
                    {(() => {
                      const hasPhotoSelections = templateSlots.some(slot => slot.photoId);
                      const filledSlots = templateSlots.filter(slot => slot.photoId).length;
                      
                      if (hasPhotoSelections) {
                        return (
                          <>
                            <p className="text-sm text-gray-500 text-center">
                              Your photo selections and package customizations will be lost.
                            </p>
                            <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                              <div className="text-sm text-yellow-800">
                                <strong>You will lose:</strong>
                                <div className="mt-1">
                                  • {filledSlots} photo{filledSlots !== 1 ? 's' : ''} already placed in templates
                                  <br />
                                  • Selected package: {selectedPackage?.name}
                                  {templates.length !== originalTemplateCount && (
                                    <>
                                      <br />
                                      • Template customizations
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </>
                        );
                      } else {
                        return (
                          <>
                            <p className="text-sm text-gray-500 text-center">
                              Your package selection and template customizations will be lost.
                            </p>
                            {selectedPackage && (
                              <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                                <div className="text-sm text-yellow-800">
                                  <strong>You will lose:</strong>
                                  <div className="mt-1">
                                    • Selected package: {selectedPackage.name}
                                    <br />
                                    • {templates.length} configured templates
                                    {templates.length !== originalTemplateCount && (
                                      <>
                                        <br />
                                        • Template customizations
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        );
                      }
                    })()}
                  </div>

                  <div className="mt-6 flex gap-3">
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                      onClick={cancelBackNavigation}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="flex-1 inline-flex justify-center rounded-lg border border-transparent bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                      onClick={confirmBackNavigation}
                    >
                      Yes, Go Back
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
} 