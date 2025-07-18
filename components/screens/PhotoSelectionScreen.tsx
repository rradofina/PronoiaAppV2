import { Package, TemplateSlot, Photo, GoogleAuth, TemplateType } from '../../types';
import { useState } from 'react';
import { PRINT_SIZES, TEMPLATE_TYPES } from '../../utils/constants';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import InlineTemplateEditor from '../InlineTemplateEditor';

interface PhotoSelectionScreenProps {
  clientName: string;
  selectedPackage: Package | null;
  googleAuth: GoogleAuth;
  templateSlots: TemplateSlot[];
  selectedSlot: TemplateSlot | null;
  photos: Photo[];
  getTotalTemplateCount: () => number;
  handlePhotoContinue: () => void;
  handlePhotoSelect: (photo: Photo) => void;
  handleSlotSelect: (slot: TemplateSlot) => void;
  handleBack: () => void;
  TemplateVisual: React.FC<{
    template: { id: string; name: string; slots: number };
    slots: TemplateSlot[];
    onSlotClick: (slot: TemplateSlot) => void;
    photos: Photo[];
    selectedSlot: TemplateSlot | null;
  }>;
  totalAllowedPrints: number;
  setSelectedSlot: (slot: TemplateSlot | null) => void;
  setTemplateSlots: (slots: TemplateSlot[]) => void;
}

export default function PhotoSelectionScreen({
  clientName,
  selectedPackage,
  googleAuth,
  templateSlots,
  selectedSlot,
  photos,
  getTotalTemplateCount,
  handlePhotoContinue,
  handlePhotoSelect,
  handleSlotSelect,
  handleBack,
  TemplateVisual,
  totalAllowedPrints,
  setSelectedSlot,
  setTemplateSlots,
}: PhotoSelectionScreenProps) {
  const [editingTemplate, setEditingTemplate] = useState<TemplateSlot[] | null>(null);
  const [showAddPrintModal, setShowAddPrintModal] = useState(false);
  const [selectedType, setSelectedType] = useState<TemplateType | null>(null);
  const [selectedSize, setSelectedSize] = useState<'4R' | '5R' | 'A4'>('4R');
  const [addPrintQuantity, setAddPrintQuantity] = useState(1);

  const onSlotSelect = (slot: TemplateSlot) => {
    setSelectedSlot(slot);
    const templateToEdit = templateSlots.filter(s => s.templateId === slot.templateId);
    setEditingTemplate(templateToEdit);
  };

  const handleInlineEditorClose = () => {
    setEditingTemplate(null);
  };

  const handleInlinePhotoSelect = (photo: Photo, slotId: string) => {
    const updatedSlots = templateSlots.map(s =>
      s.id === slotId ? { ...s, photoId: photo.id } : s
    );
    setTemplateSlots(updatedSlots);
    setEditingTemplate(updatedSlots.filter(s => s.templateId === editingTemplate?.[0].templateId));
  };

  const handleInlineTransformChange = (slotId: string, transform: { scale: number; x: number; y: number }) => {
    const updatedSlots = templateSlots.map(s =>
      s.id === slotId ? { ...s, transform } : s
    );
    setTemplateSlots(updatedSlots);
  };

  const openAddPrintModal = () => {
    setAddPrintQuantity(1); // Reset quantity when opening the modal
    setShowAddPrintModal(true);
  };

  const handleConfirmAddPrint = () => {
    if (selectedType) {
      const template = TEMPLATE_TYPES.find(t => t.id === selectedType);
      if (template) {
        let newSlotsToAdd: TemplateSlot[] = [];
        // Find the next available index for a new template to ensure unique IDs
        const existingTemplateIds = new Set(templateSlots.map(s => s.templateId));
        const nextTemplateIndex = existingTemplateIds.size;
        
        for (let i = 0; i < addPrintQuantity; i++) {
          const newTemplateId = `${selectedType}_${nextTemplateIndex + i}`;
          
          for (let slotIndex = 0; slotIndex < template.slots; slotIndex++) {
            newSlotsToAdd.push({
              id: `${newTemplateId}_${slotIndex}`,
              templateId: newTemplateId,
              templateName: `${template.name} (Additional)`,
              templateType: selectedType,
              printSize: selectedSize,
              slotIndex,
              photoId: undefined
            });
          }
        }
        setTemplateSlots([...templateSlots, ...newSlotsToAdd]);
      }
    }
    setShowAddPrintModal(false);
    setSelectedType(null);
    setSelectedSize('4R');
  };

  const handleDeletePrint = (templateIdToDelete: string) => {
    if (window.confirm('Are you sure you want to delete this print? This will remove any photos placed in it.')) {
      const newTemplateSlots = templateSlots.filter(s => s.templateId !== templateIdToDelete);
      setTemplateSlots(newTemplateSlots);

      // If the currently selected slot was part of the deleted template, deselect it
      if (selectedSlot?.templateId === templateIdToDelete) {
        setSelectedSlot(null);
      }
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="bg-white shadow-sm p-3 sm:p-4 flex-shrink-0 relative">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 mb-1">
            Photo Selection
          </h1>
          <p className="text-sm sm:text-base text-gray-600">
            Assign photos to your print slots for {clientName}
          </p>
          <div className="mt-1 text-xs sm:text-sm text-blue-600">
            {selectedPackage?.name} • {totalAllowedPrints} print(s)
            {totalAllowedPrints > (selectedPackage?.templateCount || 0) && (
              <span className="ml-2 text-green-600">+ {totalAllowedPrints - (selectedPackage?.templateCount || 0)} additional</span>
            )}
          </div>
          {selectedSlot && (
            <div className="mt-2 text-xs sm:text-sm text-white bg-blue-600 px-3 py-1 sm:px-4 sm:py-2 rounded-full inline-block">
              📍 Selecting for: {selectedSlot.templateName} - Slot {selectedSlot.slotIndex + 1}
            </div>
          )}
        </div>
        <button 
          onClick={openAddPrintModal} 
          className="absolute top-2 right-2 sm:top-4 sm:right-4 bg-green-600 text-white px-3 py-2 sm:px-4 sm:py-2 rounded-lg font-medium hover:bg-green-700 flex items-center space-x-1 sm:space-x-2 text-sm sm:text-base"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          <span className="hidden sm:inline">Add Print</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {/* Main Content Area - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Photo Grid */}
        <div className="p-3 sm:p-4">
          {!selectedSlot && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <p className="text-yellow-800 text-center font-medium text-sm">
                👇 Select a print slot below to start choosing photos
              </p>
            </div>
          )}

          <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
            {photos.map((photo) => (
              <PhotoCard 
                key={photo.id}
                photo={photo}
                onSelect={() => handlePhotoSelect(photo)}
              />
            ))}
          </div>
        </div>

        {/* Print Templates - Scrollable section */}
        <div className="bg-white shadow-lg p-3 sm:p-4 mt-4">
          <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-3 text-center">Your Print Templates</h2>
          <div className="flex space-x-3 sm:space-x-4 overflow-x-auto pb-4 min-h-[200px]">
            {Object.values(
              templateSlots.reduce((acc, slot) => {
                if (!acc[slot.templateId]) {
                  acc[slot.templateId] = {
                    templateId: slot.templateId,
                    templateName: slot.templateName,
                    slots: [],
                  };
                }
                acc[slot.templateId].slots.push(slot);
                return acc;
              }, {} as Record<string, { templateId: string; templateName: string; slots: TemplateSlot[] }>)
            ).map(({ templateId, templateName, slots }) => (
              <div key={templateId} className="flex-shrink-0 relative pt-4" style={{ width: '180px' }}>
                {templateName.includes('(Additional)') && (
                  <button
                    onClick={() => handleDeletePrint(templateId)}
                    title="Delete Print"
                    className="absolute top-0 right-0 z-10 bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                <h3 className="font-semibold mb-2 text-center text-xs sm:text-sm">{templateName}</h3>
                <div className="w-full rounded-lg overflow-hidden">
                  <TemplateVisual
                    template={{ id: templateId.split('_')[0], name: templateName, slots: slots.length }}
                    slots={slots}
                    onSlotClick={onSlotSelect}
                    photos={photos}
                    selectedSlot={selectedSlot}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation - Always visible, fixed at bottom */}
      <div className="bg-white border-t shadow-lg p-3 sm:p-4 flex-shrink-0">
        <div className="flex justify-between items-center max-w-full">
          <button
            onClick={handleBack}
            className="px-4 py-2 sm:px-6 sm:py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200 text-sm sm:text-base"
          >
            ← Back
          </button>
          <button
            onClick={handlePhotoContinue}
            className="bg-blue-600 text-white px-6 py-2 sm:px-8 sm:py-3 rounded-lg font-medium text-sm sm:text-lg hover:bg-blue-700 transition-all duration-200 shadow-md flex-shrink-0"
          >
            Finalize Selections
          </button>
        </div>
      </div>

      {editingTemplate && (
        <InlineTemplateEditor
          templateSlots={editingTemplate}
          initialSelectedSlotId={selectedSlot!.id}
          photos={photos}
          onClose={handleInlineEditorClose}
          onPhotoSelect={handleInlinePhotoSelect}
          onTransformChange={handleInlineTransformChange}
          templateVisual={TemplateVisual}
        />
      )}

      <Transition appear show={showAddPrintModal} as={Fragment}>
        <Dialog as="div" className="relative z-10" onClose={() => setShowAddPrintModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
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
                    className="text-lg font-medium leading-6 text-gray-900"
                  >
                    Add New Print
                  </Dialog.Title>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Template Type</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={selectedType || ''}
                      onChange={(e) => setSelectedType(e.target.value as TemplateType)}
                    >
                      <option value="">Select type</option>
                      {TEMPLATE_TYPES.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Print Size</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={selectedSize}
                      onChange={(e) => setSelectedSize(e.target.value as '4R' | '5R' | 'A4')}
                      disabled={!selectedType || selectedType !== 'solo'}
                    >
                      <option value="4R">4R</option>
                      {selectedType === 'solo' && (
                        <>
                          <option value="5R">5R</option>
                          <option value="A4">A4</option>
                        </>
                      )}
                    </select>
                    {selectedType && selectedType !== 'solo' && (
                      <p className="mt-1 text-xs text-gray-500">Only Solo supports 5R/A4</p>
                    )}
                  </div>
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700">Quantity</label>
                    <div className="mt-1 flex items-center rounded-md border border-gray-300 w-min">
                      <button
                        type="button"
                        className="px-3 py-1 border-r border-gray-300 text-gray-600 hover:bg-gray-100 rounded-l-md"
                        onClick={() => setAddPrintQuantity(q => Math.max(1, q - 1))}
                      >
                        -
                      </button>
                      <input
                        type="text"
                        readOnly
                        value={addPrintQuantity}
                        className="w-12 text-center border-none bg-transparent"
                      />
                      <button
                        type="button"
                        className="px-3 py-1 border-l border-gray-300 text-gray-600 hover:bg-gray-100 rounded-r-md"
                        onClick={() => setAddPrintQuantity(q => q + 1)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      onClick={() => setShowAddPrintModal(false)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 bg-blue-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-blue-700"
                      onClick={handleConfirmAddPrint}
                      disabled={!selectedType}
                    >
                      Add
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

// Separate PhotoCard component to handle image loading properly
function PhotoCard({ photo, onSelect }: { photo: Photo; onSelect: () => void }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [currentUrlIndex, setCurrentUrlIndex] = useState(0);
  const [fallbackUrls] = useState(() => {
    // Generate fallback URLs for this photo
    const fallbacks = [];
    
    // If we have a thumbnail, try different sizes
    if (photo.thumbnailUrl) {
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s800'));
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s600'));
      fallbacks.push(photo.thumbnailUrl);
    }
    
    // Try direct Google Drive link
    fallbacks.push(`https://drive.google.com/uc?id=${photo.googleDriveId}&export=view`);
    
    // Use the original URL as final fallback
    if (photo.url && !fallbacks.includes(photo.url)) {
      fallbacks.push(photo.url);
    }
    
    return fallbacks.filter(Boolean);
  });

  const getCurrentUrl = () => {
    if (currentUrlIndex < fallbackUrls.length) {
      return fallbackUrls[currentUrlIndex];
    }
    return photo.url; // Final fallback
  };

  const handleImageLoad = () => {
    console.log(`✅ Image loaded successfully: ${photo.name} (URL ${currentUrlIndex + 1}/${fallbackUrls.length})`);
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    const imgElement = event.currentTarget;
    console.error(`❌ Failed to load ${photo.name} with URL ${currentUrlIndex + 1}/${fallbackUrls.length}:`, {
      url: getCurrentUrl(),
      naturalWidth: imgElement.naturalWidth,
      naturalHeight: imgElement.naturalHeight,
      complete: imgElement.complete
    });

    // Try next fallback URL
    if (currentUrlIndex < fallbackUrls.length - 1) {
      console.log(`🔄 Trying fallback URL ${currentUrlIndex + 2}/${fallbackUrls.length} for ${photo.name}`);
      setCurrentUrlIndex(prev => prev + 1);
      setImageLoaded(false);
      setImageError(false);
    } else {
      // All URLs failed
      console.error(`💥 All URLs failed for ${photo.name}`);
      setImageError(true);
      setErrorMessage('All sources failed');
      setImageLoaded(false);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log(`🔄 Manual retry for ${photo.name}`);
    setCurrentUrlIndex(0);
    setImageError(false);
    setImageLoaded(false);
    setErrorMessage('');
  };

  return (
    <div
      onClick={onSelect}
      className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200"
    >
      <div className="w-full relative" style={{ aspectRatio: '2/3' }}>
        <img 
          key={`${photo.id}-${currentUrlIndex}`} // Force re-render on URL change
          src={getCurrentUrl()} 
          alt={photo.name} 
          className="w-full h-full object-cover"
          onLoad={handleImageLoad}
          onError={handleImageError}
          style={{ display: imageLoaded && !imageError ? 'block' : 'none' }}
          crossOrigin="anonymous"
        />
        
        {/* Loading/Error placeholder */}
        {(!imageLoaded || imageError) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
            <div className="text-center p-2">
              <div className="text-2xl mb-1">
                {imageError ? '❌' : '⏳'}
              </div>
              <div className="text-xs px-2">
                {imageError ? errorMessage : `Loading... (${currentUrlIndex + 1}/${fallbackUrls.length})`}
              </div>
              {imageError && (
                <button 
                  onClick={handleRetry}
                  className="text-xs text-blue-600 hover:text-blue-800 mt-1 underline"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="text-xs text-center p-2 truncate text-gray-600">{photo.name}</p>
    </div>
  );
} 