import { Package, TemplateSlot, Photo, GoogleAuth } from '../../types';

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
}: PhotoSelectionScreenProps) {
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header - Fixed at top */}
      <div className="bg-white shadow-sm p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Templates
          </button>
          <div className="text-sm text-gray-500">
            {selectedPackage?.name} • {getTotalTemplateCount()} print(s)
          </div>
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            Photo Selection
          </h1>
          <p className="text-gray-600">
            Assign photos to your print slots for {clientName}
          </p>
          {googleAuth.userEmail === 'demo@example.com' && (
            <span className="mt-2 inline-block bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">DEMO MODE</span>
          )}
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
            <div
              key={photo.id}
              onClick={() => handlePhotoSelect(photo)}
              className="bg-white rounded-lg shadow-sm overflow-hidden cursor-pointer transform hover:scale-105 transition-transform duration-200"
            >
              <div className="w-full relative" style={{ aspectRatio: '2/3' }}>
                {/* Main image */}
                <img 
                  src={photo.thumbnailUrl || photo.url} 
                  alt={photo.name} 
                  className="w-full h-full object-cover"
                  onLoad={(e) => {
                    console.log(`Image loaded: ${photo.name}`);
                    // Hide the placeholder when image loads
                    const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                    if (placeholder) {
                      placeholder.style.display = 'none';
                    }
                  }}
                  onError={(e) => {
                    console.error(`Failed to load image: ${photo.name}, URL: ${photo.url}`);
                    // Try fallback URL
                    const target = e.target as HTMLImageElement;
                    if (target.src !== photo.url && photo.url) {
                      target.src = photo.url;
                    } else {
                      // Show placeholder
                      target.style.display = 'none';
                      const placeholder = target.nextElementSibling as HTMLElement;
                      if (placeholder) {
                        placeholder.style.display = 'flex';
                      }
                    }
                  }}
                />
                {/* Fallback placeholder */}
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 text-gray-400">
                  <div className="text-center">
                    <div className="text-2xl mb-1">📷</div>
                    <div className="text-xs px-2 text-center">{photo.name}</div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-center p-2 truncate text-gray-600">{photo.name}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Print Templates - Fixed at bottom */}
      <div className="bg-white shadow-lg p-4 flex-shrink-0 max-h-80 overflow-y-auto">
        <h2 className="text-xl font-bold text-gray-800 mb-3 text-center">Your Print Templates</h2>
        <div className="flex space-x-4 overflow-x-auto pb-2">
          {/* Group slots by template */}
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
            <div key={templateId} className="flex-shrink-0 w-80">
              <h3 className="font-semibold mb-2 text-center text-sm">{templateName}</h3>
              <div className="w-full h-40 rounded-lg overflow-hidden border border-gray-200">
                <TemplateVisual
                  template={{ id: templateId.split('_')[0], name: templateName, slots: slots.length }}
                  slots={slots}
                  onSlotClick={handleSlotSelect}
                  photos={photos}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <button
            onClick={handlePhotoContinue}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-blue-700 transition-all duration-200 shadow-md"
          >
            Finalize Selections
          </button>
        </div>
      </div>
    </div>
  );
} 