import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { TemplateSlot, Photo } from '../types';

interface InlineTemplateEditorProps {
  templateSlots: TemplateSlot[];
  photos: Photo[];
  onClose: () => void;
  onPhotoSelect: (photo: Photo, slotId: string) => void;
  onTransformChange: (slotId: string, transform: { scale: number; x: number; y: number }) => void;
  templateVisual: React.FC<any>;
}

export default function InlineTemplateEditor({
  templateSlots,
  photos,
  onClose,
  onPhotoSelect,
  onTransformChange,
  templateVisual: TemplateVisual,
}: InlineTemplateEditorProps) {
  const currentTemplate = templateSlots[0];
  if (!currentTemplate) return null;

  const getPhotoUrl = (photoId?: string) => photos.find(p => p.id === photoId)?.url;

  return (
    <div className="fixed inset-0 z-20 bg-black bg-opacity-75 flex flex-col items-center justify-center p-4">
      {/* Photo gallery at the top */}
      <div className="w-full max-w-4xl mb-4">
        <div className="flex space-x-2 overflow-x-auto bg-gray-800 p-2 rounded-lg">
          {photos.map(photo => (
            <img
              key={photo.id}
              src={photo.thumbnailUrl || photo.url}
              alt={photo.name}
              onClick={() => onPhotoSelect(photo, currentTemplate.id)}
              className="w-20 h-20 object-cover rounded-md cursor-pointer hover:opacity-75"
            />
          ))}
        </div>
      </div>

      {/* Enlarged Template */}
      <div className="w-full max-w-4xl bg-white p-4 rounded-lg shadow-xl">
        <h3 className="text-center font-bold mb-2">{currentTemplate.templateName}</h3>
        <div style={{ aspectRatio: '4/6' }}>
          <TemplateVisual
            template={{ id: currentTemplate.templateType, name: currentTemplate.templateName, slots: templateSlots.length }}
            slots={templateSlots.map(slot => ({
              ...slot,
              render: (photoId?: string) => (
                <TransformWrapper
                  onTransformed={(ref, state) => onTransformChange(slot.id, { scale: state.scale, x: state.positionX, y: state.positionY })}
                  initialScale={slot.transform?.scale || 1}
                  initialPositionX={slot.transform?.x || 0}
                  initialPositionY={slot.transform?.y || 0}
                >
                  <TransformComponent>
                    {photoId && <img src={getPhotoUrl(photoId)} alt="" className="w-full h-full object-cover" />}
                  </TransformComponent>
                </TransformWrapper>
              )
            }))}
            photos={photos}
            selectedSlot={null} // Not needed in this view
          />
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-4">
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