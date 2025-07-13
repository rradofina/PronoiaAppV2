import { Package, TemplateSlot, Photo, GoogleAuth, TemplateType } from '../../types';
import { useState } from 'react';
import PhotoCropper from '../PhotoCropper';
import { PRINT_SIZES, TEMPLATE_TYPES } from '../../utils/constants';

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
  TemplateVisual: React.FC<any>; // Using any for now to avoid circular dependencies
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
  const [isCropping, setIsCropping] = useState(false);
  const [currentEditingTemplateId, setCurrentEditingTemplateId] = useState<string | null>(null);

  const onSlotSelect = (slot: TemplateSlot) => {
    setSelectedSlot(slot);
    setIsCropping(true);
    if (!currentEditingTemplateId) {
      setCurrentEditingTemplateId(slot.templateId);
    }
  };

  const handleCropperSelect = (photo: Photo, transform?: { scale: number; offsetX: number; offsetY: number }) => {
    if (selectedSlot) {
      const finalTransform = transform || { scale: 1, offsetX: 0, offsetY: 0 };
      const updatedSlots = templateSlots.map(s => 
        s.id === selectedSlot.id 
          ? { ...s, photoId: photo.id, transform: finalTransform } 
          : s
      );
      setTemplateSlots(updatedSlots);
      
      const templateSlotsGroup = updatedSlots.filter(s => s.templateId === selectedSlot.templateId);
      const nextEmpty = templateSlotsGroup.find(s => !s.photoId && s.slotIndex > selectedSlot.slotIndex);
      
      if (nextEmpty) {
        setSelectedSlot(nextEmpty);
      } else {
        setIsCropping(false);
        setCurrentEditingTemplateId(null);
        setSelectedSlot(null);
        
        if (updatedSlots.every(s => s.photoId)) {
          handlePhotoContinue();
        }
      }
    }
  };

  const handleAddPrint = () => {
    const type = prompt('Enter template type (solo, collage, etc.)');
    let size: '4R' | '5R' | 'A4' = '4R';
    const input = prompt('Enter size (4R, 5R, A4)') as '4R' | '5R' | 'A4' | null;
    if (input) size = input;
    
    const template = TEMPLATE_TYPES.find(t => t.id === type);
    if (template) {
      const newTemplateIndex = templateSlots.length;
      const newTemplateId = `${type}_${newTemplateIndex}`;
      const newSlots = [];
      for (let slotIndex = 0; slotIndex < template.slots; slotIndex++) {
        newSlots.push({
          id: `${type}_${newTemplateIndex}_${slotIndex}`,
          templateId: newTemplateId,
          templateName: `${template.name} (Additional)`,
          templateType: type as TemplateType,
          printSize: size,
          slotIndex,
          photoId: undefined
        });
      }
      setTemplateSlots([...templateSlots, ...newSlots]);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="bg-white shadow-sm p-4 flex-shrink-0">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            Photo Selection
          </h1>
          <p className="text-gray-600">
            Assign photos to your print slots for {clientName}
          </p>
          <div className="mt-1 text-sm text-blue-600">
            {selectedPackage?.name} • {totalAllowedPrints} print(s)
            {totalAllowedPrints > (selectedPackage?.templateCount || 0) && (
              <span className="ml-2 text-green-600">+ {totalAllowedPrints - (selectedPackage?.templateCount || 0)} additional</span>
            )}
            {googleAuth.userEmail === 'demo@example.com' && <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">DEMO MODE</span>}
          </div>
          {selectedSlot && (
            <div className="mt-2 text-sm text-white bg-blue-600 px-4 py-2 rounded-full inline-block">
              📍 Selecting for: {selectedSlot.templateName} - Slot {selectedSlot.slotIndex + 1}
            </div>
          )}
        </div>
      </div>

      {/* Photo Grid - Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedSlot && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <p className="text-yellow-800 text-center font-medium">
              👇 Select a print slot below to start choosing photos
            </p>
          </div>
        )}

        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 pb-4">
          {photos.map((photo) => (
            <PhotoCard 
              key={photo.id}
              photo={photo}
              onSelect={() => handlePhotoSelect(photo)}
            />
          ))}
        </div>
      </div>

      {/* Print Templates - Fixed at bottom with increased height */}
      <div className="bg-white shadow-lg p-4 flex-shrink-0">
        <h2 className="text-xl font-bold text-gray-800 mb-3 text-center">Your Print Templates</h2>
        <div className="flex flex-col md:flex-row space-y-4 md:space-x-4 md:space-y-0 overflow-y-auto md:overflow-x-auto pb-2" style={{ maxHeight: '500px' }}>
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
            <div key={templateId} className="flex-shrink-0 w-full md:w-80">
              <h3 className="font-semibold mb-2 text-center">{templateName}</h3>
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
        <div className="mt-4 flex justify-between items-center">
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            ← Back to Templates
          </button>
          <button
            onClick={handlePhotoContinue}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-blue-700 transition-all duration-200 shadow-md"
          >
            Finalize Selections
          </button>
        </div>
      </div>

      {isCropping && selectedSlot && (
        <PhotoCropper 
          photos={photos} 
          selectedSlot={selectedSlot} 
          onPhotoSelect={handleCropperSelect} 
          onClose={() => setIsCropping(false)} 
        />
      )}

      <button 
        onClick={handleAddPrint} 
        className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700"
      >
        + Add Print
      </button>
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