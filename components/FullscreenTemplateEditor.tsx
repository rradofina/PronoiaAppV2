import { useState, useRef } from 'react';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { TemplateSlot, Photo } from '../types';

interface FullscreenTemplateEditorProps {
  templateSlots: TemplateSlot[];
  selectedSlot: TemplateSlot;
  selectedPhoto: Photo;
  photos: Photo[];
  onApply: (slotId: string, photoId: string, transform?: { scale: number; x: number; y: number }) => void;
  onClose: () => void;
  isVisible: boolean;
  TemplateVisual: React.FC<any>;
}

export default function FullscreenTemplateEditor({
  templateSlots,
  selectedSlot,
  selectedPhoto,
  photos,
  onApply,
  onClose,
  isVisible,
  TemplateVisual
}: FullscreenTemplateEditorProps) {
  const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
  const transformRef = useRef<any>();

  if (!isVisible) return null;

  const handleApply = () => {
    onApply(selectedSlot.id, selectedPhoto.id, transform);
  };

  const handleTransformChange = (ref: any, state: any) => {
    setTransform({
      scale: state.scale,
      x: state.positionX,
      y: state.positionY
    });
  };

  // Create a temporary slot array with the photo assigned
  const tempSlots = templateSlots.map(slot => 
    slot.id === selectedSlot.id 
      ? { ...slot, photoId: selectedPhoto.id }
      : slot
  );

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <button
          onClick={onClose}
          className="flex items-center space-x-2 text-white hover:text-gray-300"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          <span>Cancel</span>
        </button>
        
        <div className="text-center">
          <h3 className="font-medium">{selectedSlot.templateName}</h3>
          <p className="text-sm text-gray-300">Slot {selectedSlot.slotIndex + 1}</p>
        </div>
        
        <button
          onClick={handleApply}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
        >
          Apply
        </button>
      </div>

      {/* Photo Info */}
      <div className="px-4 pb-4 border-b border-gray-800">
        <div className="flex items-center space-x-3">
          <img
            src={selectedPhoto.thumbnailUrl ? selectedPhoto.thumbnailUrl.replace('=s220', '=s400') : selectedPhoto.url}
            alt={selectedPhoto.name}
            className="w-10 h-10 object-cover rounded"
          />
          <div className="text-white">
            <p className="font-medium text-sm">{selectedPhoto.name}</p>
            <p className="text-xs text-gray-400">Pinch to zoom, drag to position</p>
          </div>
        </div>
      </div>

      {/* Template Editor */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Show template with the selected slot highlighted for positioning */}
          <div className="relative">
            <TemplateVisual
              template={{ 
                id: selectedSlot.templateType, 
                name: selectedSlot.templateName, 
                slots: templateSlots.filter(s => s.templateId === selectedSlot.templateId).length 
              }}
              slots={tempSlots.filter(s => s.templateId === selectedSlot.templateId)}
              photos={photos}
              selectedSlot={selectedSlot}
              onSlotClick={() => {}} // Disabled in editor mode
            />
            
            {/* Overlay for the specific slot being edited */}
            <div className="absolute inset-0 pointer-events-none">
              {/* This would overlay on the specific slot position for pinch/zoom interaction */}
            </div>
          </div>

          {/* Transform Controls */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-white text-sm">
              <span>Zoom: {(transform.scale * 100).toFixed(0)}%</span>
              <button
                onClick={() => {
                  if (transformRef.current) {
                    transformRef.current.resetTransform();
                  }
                }}
                className="text-blue-400 hover:text-blue-300"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="p-4 bg-gray-900 text-center">
        <p className="text-gray-400 text-sm">
          Use pinch gestures to zoom and drag to reposition the photo within the frame
        </p>
      </div>
    </div>
  );
}