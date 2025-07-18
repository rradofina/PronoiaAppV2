import { TemplateSlot, Photo } from '../types';

interface PhotoSelectionModeProps {
  photos: Photo[];
  selectedSlot: TemplateSlot;
  onPhotoSelect: (photo: Photo) => void;
  onBack: () => void;
  isVisible: boolean;
}

export default function PhotoSelectionMode({
  photos,
  selectedSlot,
  onPhotoSelect,
  onBack,
  isVisible
}: PhotoSelectionModeProps) {
  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-40 bg-white flex flex-col">
      {/* Header with template indicator */}
      <div className="bg-white shadow-sm p-3 border-b">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            <span className="text-sm">Back</span>
          </button>
          
          <div className="text-center">
            <h3 className="font-medium text-gray-800">{selectedSlot.templateName}</h3>
            <p className="text-xs text-gray-500">Select photo for Slot {selectedSlot.slotIndex + 1}</p>
          </div>
          
          <div className="w-16" /> {/* Spacer */}
        </div>
      </div>

      {/* Template Indicator - Small version in corner */}
      <div className="absolute top-20 right-4 z-10 bg-white rounded-lg shadow-lg p-2 border">
        <div className="w-16 h-24 bg-gray-100 rounded flex items-center justify-center">
          <div className={`w-3 h-3 rounded border-2 ${
            selectedSlot ? 'border-blue-500 bg-blue-100' : 'border-gray-300'
          }`} />
        </div>
        <p className="text-xs text-center mt-1 text-gray-600">Slot {selectedSlot.slotIndex + 1}</p>
      </div>

      {/* Photo Grid */}
      <div className="flex-1 overflow-y-auto p-3">
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-0">
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => onPhotoSelect(photo)}
              className="relative overflow-hidden cursor-pointer hover:opacity-75 transition-opacity"
              style={{ aspectRatio: '2/3' }}
            >
              <img 
                src={photo.thumbnailUrl ? photo.thumbnailUrl.replace('=s220', '=s400') : photo.url} 
                alt={photo.name} 
                className="w-full h-full object-cover"
              />
              
              {/* Filename overlay */}
              <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white px-2 py-1">
                <p className="text-xs truncate">{photo.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="p-3 bg-gray-50 border-t">
        <p className="text-center text-gray-600 text-sm">
          Tap a photo to place it in the highlighted slot
        </p>
      </div>
    </div>
  );
}