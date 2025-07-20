import { Package, TemplateSlot, Photo, GoogleAuth, TemplateType } from '../../types';
import { useState, useEffect } from 'react';
import { PRINT_SIZES, TEMPLATE_TYPES } from '../../utils/constants';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import InlineTemplateEditor from '../InlineTemplateEditor';
import FullscreenPhotoViewer from '../FullscreenPhotoViewer';
import TemplateSelector from '../TemplateSelector';
import FullscreenTemplateEditor from '../FullscreenTemplateEditor';
import FullscreenTemplateSelector from '../FullscreenTemplateSelector';
import PhotoSelectionMode from '../PhotoSelectionMode';
import SlidingTemplateBar from '../SlidingTemplateBar';

// PNG Template Visual Component  
const TemplateVisual = ({ template, slots, onSlotClick, photos, selectedSlot }: any) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  
  // Get PNG templates from window (stored during package selection)
  const pngTemplates = (window as any).pngTemplates || [];
  
  // Find the matching PNG template
  const pngTemplate = pngTemplates.find((t: any) => 
    t.templateType === template.id || 
    t.name.toLowerCase().includes(template.id) ||
    t.id === template.id.split('_')[0]
  );
  

  // Download PNG as blob to avoid CORS issues
  useEffect(() => {
    if (pngTemplate) {
      const downloadAsBlob = async () => {
        try {
          const { googleDriveService } = await import('../../services/googleDriveService');
          console.log('🔍 Attempting to download template:', {
            id: pngTemplate.id,
            driveFileId: pngTemplate.driveFileId,
            name: pngTemplate.name
          });
          
          // Try driveFileId first, then fallback to id
          const fileId = pngTemplate.driveFileId || pngTemplate.id;
          const blob = await googleDriveService.downloadTemplate(fileId);
          const url = URL.createObjectURL(blob);
          setBlobUrl(url);
        } catch (error) {
          console.error('Failed to download PNG template:', error);
          setBlobUrl(null); // Show fallback UI
        }
      };
      downloadAsBlob();
    }
    
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [pngTemplate]);

  const getPhotoUrl = (photoId?: string | null) => {
    if (!photoId) return null;
    return photos.find((p: any) => p.id === photoId)?.url || null;
  };

  if (!pngTemplate) {
    console.warn('⚠️ PNG template not found for:', template.id, 'Available:', pngTemplates.length);
    return (
      <div className="bg-white p-3 rounded-lg shadow-md w-full h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-lg font-medium">{template.name}</div>
          <div className="text-sm">{slots.length} photos</div>
          <div className="text-xs mt-1 text-red-500">PNG not found</div>
        </div>
      </div>
    );
  }

  if (!blobUrl) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-md w-full h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-lg font-medium">{template.name}</div>
          <div className="text-sm">{slots.length} photos</div>
          <div className="text-xs mt-1">Loading template...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full bg-white" 
         style={{ 
           aspectRatio: `${pngTemplate.dimensions.width}/${pngTemplate.dimensions.height}`,
         }}>
      {/* Background PNG Template - FULL template including branding */}
      <img 
        src={blobUrl}
        alt={pngTemplate.name}
        className="w-full h-full object-contain"
      />
      
      {/* Photo Holes Overlay */}
      {pngTemplate.holes.map((hole: any, holeIndex: number) => {
        const slot = slots[holeIndex];
        if (!slot) return null;
        
        const photoUrl = getPhotoUrl(slot.photoId);
        const isSelected = selectedSlot?.id === slot.id;
        
        return (
          <div
            key={hole.id}
            className={`absolute cursor-pointer transition-all duration-200 ${
              isSelected ? 'ring-2 ring-blue-500' : 'hover:ring-1 hover:ring-blue-300'
            }`}
            style={{
              left: `${(hole.x / pngTemplate.dimensions.width) * 100}%`,
              top: `${(hole.y / pngTemplate.dimensions.height) * 100}%`,
              width: `${(hole.width / pngTemplate.dimensions.width) * 100}%`,
              height: `${(hole.height / pngTemplate.dimensions.height) * 100}%`,
            }}
            onClick={() => onSlotClick(slot)}
          >
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`Photo ${holeIndex + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center relative" 
                   style={{ outline: '2px dashed #9ca3af', outlineOffset: '-2px' }}>
                <span className="text-gray-500 text-xs font-medium">
                  {holeIndex + 1}
                </span>
                {/* Debug info for hole dimensions */}
                <div className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-1 leading-tight">
                  {hole.width}×{hole.height}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

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
  totalAllowedPrints,
  setSelectedSlot,
  setTemplateSlots,
}: PhotoSelectionScreenProps) {
  const [editingTemplate, setEditingTemplate] = useState<TemplateSlot[] | null>(null);
  const [showAddPrintModal, setShowAddPrintModal] = useState(false);
  const [selectedType, setSelectedType] = useState<TemplateType | null>(null);
  const [selectedSize, setSelectedSize] = useState<'4R' | '5R' | 'A4'>('4R');
  const [addPrintQuantity, setAddPrintQuantity] = useState(1);
  const [hasScrolled, setHasScrolled] = useState(false);
  
  // New workflow states
  const [viewMode, setViewMode] = useState<'normal' | 'photo-viewer' | 'sliding-templates' | 'template-editor' | 'template-first' | 'photo-selection'>('normal');
  const [selectedPhotoForViewer, setSelectedPhotoForViewer] = useState<Photo | null>(null);
  const [selectedPhotoForTemplate, setSelectedPhotoForTemplate] = useState<Photo | null>(null);
  const [selectedTemplateForViewer, setSelectedTemplateForViewer] = useState<string | null>(null);
  const [selectedSlotForEditor, setSelectedSlotForEditor] = useState<TemplateSlot | null>(null);

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
      // Get PNG templates from window
      const pngTemplates = (window as any).pngTemplates || [];
      const template = pngTemplates.find((t: any) => 
        t.templateType === selectedType || 
        t.name.toLowerCase().includes(selectedType.toLowerCase())
      );
      
      if (template) {
        const newSlotsToAdd: TemplateSlot[] = [];
        // Find the next available index for a new template to ensure unique IDs
        const existingTemplateIds = new Set(templateSlots.map(s => s.templateId));
        const nextTemplateIndex = existingTemplateIds.size;
        
        for (let i = 0; i < addPrintQuantity; i++) {
          const newTemplateId = `${template.id}_${nextTemplateIndex + i}`;
          
          for (let slotIndex = 0; slotIndex < template.holes.length; slotIndex++) {
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

  // New workflow handlers
  
  // Photo-first workflow
  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhotoForViewer(photo);
    setViewMode('photo-viewer');
  };

  const handleAddToTemplate = (photo: Photo) => {
    setSelectedPhotoForTemplate(photo);
    // Keep the fullscreen viewer open but dimmed in background
    setViewMode('sliding-templates');
  };

  const handleSlotSelectFromSlidingBar = (slot: TemplateSlot) => {
    setSelectedSlotForEditor(slot);
    setViewMode('template-editor');
  };

  // Template-first workflow  
  const handleTemplateClick = (templateId: string) => {
    setSelectedTemplateForViewer(templateId);
    setViewMode('template-first');
  };

  const handleSlotSelectFromTemplate = (slot: TemplateSlot) => {
    setSelectedSlotForEditor(slot);
    setViewMode('photo-selection');
  };

  const handlePhotoSelectForSlot = (photo: Photo) => {
    setSelectedPhotoForTemplate(photo);
    setViewMode('template-editor');
  };

  // Template editor
  const handleApplyPhotoToSlot = (slotId: string, photoId: string, transform?: { scale: number; x: number; y: number }) => {
    console.log('🔧 Apply button clicked:', { slotId, photoId, transform });
    console.log('🔧 Current templateSlots before update:', templateSlots);
    
    const updatedSlots = templateSlots.map(s =>
      s.id === slotId ? { ...s, photoId, transform } : s
    );
    
    console.log('🔧 Updated slots after applying photo:', updatedSlots);
    
    // Check if photo exists in photos array
    const photo = photos.find(p => p.id === photoId);
    console.log('🔧 Photo found in photos array:', photo);
    
    setTemplateSlots(updatedSlots);
    
    // Reset states and return to normal view
    resetViewStates();
  };

  const resetViewStates = () => {
    setViewMode('normal');
    setSelectedPhotoForViewer(null);
    setSelectedPhotoForTemplate(null);
    setSelectedTemplateForViewer(null);
    setSelectedSlotForEditor(null);
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col lg:flex-row overflow-hidden" style={{ touchAction: 'manipulation' }}>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Photo Grid Section */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Photo Grid - Scrollable area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4" onScroll={() => setHasScrolled(true)}>
            {!selectedSlot && !hasScrolled && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                <p className="text-yellow-800 text-center font-medium text-sm">
                  👉 Select a print slot {/* Changed from down arrow to right arrow for desktop */}
                  <span className="lg:hidden">below</span>
                  <span className="hidden lg:inline">on the right</span>
                  {' '}to start choosing photos
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-0 pb-4">
              {photos.map((photo) => (
                <PhotoCard 
                  key={photo.id}
                  photo={photo}
                  onSelect={() => handlePhotoClick(photo)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Print Templates - Different layouts for mobile vs desktop */}
        {/* Mobile/Tablet: Horizontal bottom section */}
        <div className="lg:hidden bg-white shadow-lg border-t flex-shrink-0" style={{ height: '380px', touchAction: 'pan-x' }}>
          <div className="p-2 sm:p-3 h-full flex flex-col">
            <div className="flex-shrink-0 mb-2">
              <div className="flex items-center justify-between mb-1">
                <button
                  onClick={handleBack}
                  className="flex items-center space-x-1 px-2 py-1 rounded-lg font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-all duration-200 text-xs"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span>Back</span>
                </button>
                
                <button 
                  onClick={openAddPrintModal} 
                  className="bg-green-600 text-white px-2 py-1 rounded-lg font-medium hover:bg-green-700 flex items-center space-x-1 text-xs"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  <span>Add</span>
                </button>

                <button
                  onClick={handlePhotoContinue}
                  className="bg-blue-600 text-white px-3 py-1 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 text-xs"
                >
                  Done
                </button>
              </div>
              <h2 className="text-sm font-bold text-gray-800 text-center">📷 {clientName} • {selectedPackage?.name} • {totalAllowedPrints} print(s)</h2>
              {selectedSlot && (
                <div className="mt-1 text-xs text-white bg-blue-600 px-2 py-0.5 rounded-full text-center">
                  📍 Selecting: {selectedSlot.templateName} - Slot {selectedSlot.slotIndex + 1}
                </div>
              )}
            </div>
            <div className="flex-1 overflow-hidden">
              <div className="flex space-x-2 sm:space-x-3 overflow-x-auto h-full pb-2" style={{ touchAction: 'pan-x' }}>
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
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <h3 className="font-semibold mb-2 text-center text-xs leading-tight truncate px-1">{templateName}</h3>
                    <div className="w-full rounded-lg overflow-hidden border border-gray-200">
                      <div onClick={() => handleTemplateClick(templateId)}>
                        <TemplateVisual
                          key={`${templateId}-${slots.map(s => s.photoId).join('-')}`} // Force re-render when photos change
                          template={{ id: templateId.split('_')[0], name: templateName, slots: slots.length }}
                          slots={slots}
                          onSlotClick={() => {}} // Disabled - clicking template goes to template-first mode
                          photos={photos}
                          selectedSlot={selectedSlot}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Vertical right sidebar */}
        <div className="hidden lg:flex bg-white shadow-lg border-l flex-shrink-0 flex-col" style={{ width: '320px' }}>
          {/* Desktop Header in Sidebar */}
          <div className="p-2 border-b">
            <div className="flex items-center justify-between mb-2">
              <button 
                onClick={openAddPrintModal} 
                className="bg-green-600 text-white px-2 py-1 rounded-lg font-medium hover:bg-green-700 flex items-center space-x-1 text-xs"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
                <span>Add</span>
              </button>
            </div>
            <h2 className="text-sm font-bold text-gray-800 text-center">📷 {clientName} Templates</h2>
            <div className="text-xs text-gray-600 text-center">{selectedPackage?.name} • {totalAllowedPrints} print(s)</div>
            {selectedSlot && (
              <div className="mt-1 text-xs text-white bg-blue-600 px-2 py-0.5 rounded-full text-center">
                📍 Selecting: {selectedSlot.templateName} - Slot {selectedSlot.slotIndex + 1}
              </div>
            )}
          </div>

          {/* Templates List */}
          <div className="flex-1 overflow-y-auto p-4">
            <div className="space-y-2">
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
                <div key={templateId} className="relative">
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
                  <h3 className="font-semibold mb-2 text-center text-sm">{templateName}</h3>
                  <div className="w-full rounded-lg overflow-hidden border border-gray-200" style={{ height: '400px' }}>
                    <div onClick={() => handleTemplateClick(templateId)}>
                      <TemplateVisual
                        key={`${templateId}-${slots.map(s => s.photoId).join('-')}`} // Force re-render when photos change
                        template={{ id: templateId.split('_')[0], name: templateName, slots: slots.length }}
                        slots={slots}
                        onSlotClick={() => {}} // Disabled - clicking template goes to template-first mode
                        photos={photos}
                        selectedSlot={selectedSlot}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop Navigation in Sidebar */}
          <div className="p-4 border-t bg-gray-50">
            <div className="space-y-2">
              <button
                onClick={handleBack}
                className="w-full px-4 py-2 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200 text-sm"
              >
                ← Back to Package
              </button>
              <button
                onClick={handlePhotoContinue}
                className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg font-medium hover:bg-blue-700 transition-all duration-200 shadow-md"
              >
                Finalize Selections
              </button>
            </div>
          </div>
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
                    <label className="block text-sm font-medium text-gray-700">PNG Template</label>
                    <select
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      value={selectedType || ''}
                      onChange={(e) => setSelectedType(e.target.value as TemplateType)}
                    >
                      <option value="">Select PNG template</option>
                      {((window as any).pngTemplates || [])
                        .filter((t: any) => t.printSize === selectedSize)
                        .map((t: any) => (
                          <option key={t.id} value={t.templateType}>
                            {t.name} ({t.holes.length} slots)
                          </option>
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

      {/* New Workflow Components */}
      
      {/* Fullscreen Photo Viewer */}
      <FullscreenPhotoViewer
        photo={selectedPhotoForViewer!}
        photos={photos}
        onClose={resetViewStates}
        onAddToTemplate={handleAddToTemplate}
        isVisible={(viewMode === 'photo-viewer' || viewMode === 'sliding-templates') && !!selectedPhotoForViewer}
        isDimmed={viewMode === 'sliding-templates'}
      />

      {/* Sliding Template Bar (from photo) */}
      <SlidingTemplateBar
        templateSlots={templateSlots}
        selectedPhoto={selectedPhotoForTemplate!}
        photos={photos}
        onSlotSelect={handleSlotSelectFromSlidingBar}
        onClose={resetViewStates}
        isVisible={viewMode === 'sliding-templates' && !!selectedPhotoForTemplate}
        TemplateVisual={TemplateVisual}
      />

      {/* Fullscreen Template Selector (template-first) */}
      <FullscreenTemplateSelector
        templateSlots={templateSlots}
        selectedTemplateId={selectedTemplateForViewer || ''}
        photos={photos}
        onSlotSelect={handleSlotSelectFromTemplate}
        onClose={resetViewStates}
        isVisible={viewMode === 'template-first' && !!selectedTemplateForViewer}
        TemplateVisual={TemplateVisual}
      />

      {/* Photo Selection Mode (template-first) */}
      <PhotoSelectionMode
        photos={photos}
        selectedSlot={selectedSlotForEditor!}
        onPhotoSelect={handlePhotoSelectForSlot}
        onBack={() => setViewMode('template-first')}
        isVisible={viewMode === 'photo-selection' && !!selectedSlotForEditor}
      />

      {/* Fullscreen Template Editor */}
      <FullscreenTemplateEditor
        templateSlots={templateSlots}
        selectedSlot={selectedSlotForEditor!}
        selectedPhoto={selectedPhotoForTemplate!}
        photos={photos}
        onApply={handleApplyPhotoToSlot}
        onClose={resetViewStates}
        isVisible={viewMode === 'template-editor' && !!selectedSlotForEditor && !!selectedPhotoForTemplate}
      />
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
    
    // If we have a thumbnail, use higher resolution for better quality on modern displays
    if (photo.thumbnailUrl) {
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s400')); // =s400 (better quality for grid)
      fallbacks.push(photo.thumbnailUrl.replace('=s220', '=s600')); // =s600 (high quality fallback)
      fallbacks.push(photo.thumbnailUrl); // =s220 (original size as fallback)
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
      className="relative overflow-hidden cursor-pointer hover:opacity-90 transition-opacity duration-200"
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
        
        {/* Filename overlay at bottom */}
        <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white px-2 py-1">
          <p className="text-xs truncate">{photo.name}</p>
        </div>
      </div>
    </div>
  );
} 