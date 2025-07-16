import { useState } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { TemplateSlot, Photo } from '../types';

interface InlineTemplateEditorProps {
  templateSlots: TemplateSlot[];
  initialSelectedSlotId: string;
  photos: Photo[];
  onClose: () => void;
  onPhotoSelect: (photo: Photo, slotId: string) => void;
  onTransformChange: (slotId: string, transform: { scale: number; x: number; y: number }) => void;
  templateVisual: React.FC<any>;
}

export default function InlineTemplateEditor({
  templateSlots,
  initialSelectedSlotId,
  photos,
  onClose,
  onPhotoSelect,
  onTransformChange,
  templateVisual: TemplateVisual,
}: InlineTemplateEditorProps) {
  const [activeSlotId, setActiveSlotId] = useState(initialSelectedSlotId);
  
  const currentTemplate = templateSlots[0];
  if (!currentTemplate) return null;

  const getPhotoUrl = (photoId?: string) => photos.find(p => p.id === photoId)?.url;

  return (
    <div className="fixed inset-0 z-20 bg-black bg-opacity-75 flex flex-col items-center justify-center p-4">
      {/* Photo gallery at the top */}
      <div className="w-full max-w-5xl mb-4 flex-shrink-0">
        <h3 className="text-white text-center text-lg font-semibold mb-2">Select a Photo</h3>
        <div className="flex space-x-3 overflow-x-auto bg-gray-900 bg-opacity-50 p-3 rounded-xl">
          {photos.map(photo => (
            <img
              key={photo.id}
              src={photo.thumbnailUrl || photo.url}
              alt={photo.name}
              onClick={() => onPhotoSelect(photo, activeSlotId)}
              className="w-24 h-24 object-cover rounded-lg cursor-pointer hover:ring-2 ring-blue-400 transition-all"
            />
          ))}
        </div>
      </div>

      {/* Enlarged Template - with constrained height */}
      <div className="w-full max-w-5xl bg-white p-4 rounded-lg shadow-xl flex-grow flex flex-col" style={{ minHeight: 0 }}>
        <h3 className="text-center font-bold mb-2">{currentTemplate.templateName}</h3>
        <div className="relative flex-grow w-full h-full flex items-center justify-center">
            <div className="w-full h-full" style={{ aspectRatio: '4 / 6', margin: 'auto' }}>
                <TemplateVisual
                    template={{ id: currentTemplate.templateType, name: currentTemplate.templateName, slots: templateSlots.length }}
                    slots={templateSlots}
                    photos={photos}
                    selectedSlotId={activeSlotId}
                    onSlotClick={(slot: TemplateSlot) => setActiveSlotId(slot.id)}
                />
            </div>
        </div>
      </div>


      {/* Action buttons */}
      <div className="mt-4 flex-shrink-0">
        <button
          onClick={onClose}
          className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-blue-700 transition-all duration-200 shadow-md"
        >
          OK
        </button>
      </div>
    </div>
  );
} 