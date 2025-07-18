import React from 'react';
import { TemplateSlot, Photo } from '../types';

interface TemplateVisualProps {
  template: { id: string; name: string; slots: number };
  slots: TemplateSlot[];
  onSlotClick: (slot: TemplateSlot) => void;
  photos: Photo[];
  selectedSlot: TemplateSlot | null;
}

const TemplateVisual: React.FC<TemplateVisualProps> = React.memo(({
  template,
  slots,
  onSlotClick,
  photos,
  selectedSlot
}) => {
  const getPhotoUrl = (photoId?: string | null) => {
    if (!photoId) return null;
    return photos.find(p => p.id === photoId)?.url || null;
  };

  // 4R print format (4x6 inches) - width:height ratio of 2:3 (or 4:6)
  const printAspectRatio = '2/3'; // CSS aspect-ratio for 4x6 print

  if (template.id === 'solo') {
    // Solo Template - Single large photo with border for 4R print
    return (
      <div className="bg-white p-3 rounded-lg shadow-md w-full" style={{ aspectRatio: printAspectRatio }}>
        <div 
          className={`w-full h-full border-2 border-dashed border-gray-300 rounded cursor-pointer transition-all duration-200 ${
            selectedSlot === slots[0] ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
          }`}
          onClick={() => onSlotClick(slots[0])}
          style={{ 
            backgroundImage: getPhotoUrl(slots[0]?.photoId) ? `url(${getPhotoUrl(slots[0]?.photoId)})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {!getPhotoUrl(slots[0]?.photoId) && (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <div className="text-center">
                <div className="text-2xl mb-1">📷</div>
                <div className="text-xs">Click to add photo</div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (template.id === 'collage') {
    // Collage Template - 2x2 grid with borders and gaps
    return (
      <div className="bg-white p-3 rounded-lg shadow-md w-full" style={{ aspectRatio: printAspectRatio }}>
        <div className="grid grid-cols-2 gap-2 h-full">
          {slots.slice(0, 4).map((slot, index) => (
            <div
              key={index}
              className={`border-2 border-dashed border-gray-300 rounded cursor-pointer transition-all duration-200 ${
                selectedSlot === slot ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
              }`}
              onClick={() => onSlotClick(slot)}
              style={{ 
                backgroundImage: getPhotoUrl(slot?.photoId) ? `url(${getPhotoUrl(slot?.photoId)})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {!getPhotoUrl(slot?.photoId) && (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <div className="text-xs">📷</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (template.id === 'photocard') {
    // Photocard Template - 2x2 grid like collage but NO borders/gaps (edge-to-edge)
    return (
      <div className="bg-white rounded-lg shadow-md overflow-hidden w-full" style={{ aspectRatio: printAspectRatio }}>
        <div className="grid grid-cols-2 gap-0 h-full">
          {slots.slice(0, 4).map((slot, index) => (
            <div
              key={index}
              className={`cursor-pointer transition-all duration-200 ${
                selectedSlot === slot ? 'ring-2 ring-blue-500 ring-inset' : ''
              }`}
              onClick={() => onSlotClick(slot)}
              style={{ 
                backgroundImage: getPhotoUrl(slot?.photoId) ? `url(${getPhotoUrl(slot?.photoId)})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              {!getPhotoUrl(slot?.photoId) && (
                <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100">
                  <div className="text-xs">📷</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (template.id === 'photostrip') {
    // Photo Strip Template - 3 rows of 2 photos each (6 total) like collage but 3 rows
    return (
      <div className="bg-white p-3 rounded-lg shadow-md w-full" style={{ aspectRatio: printAspectRatio }}>
        <div className="grid grid-rows-3 gap-1 h-full">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid grid-cols-2 gap-1 h-full">
              {slots.slice(row * 2, row * 2 + 2).map((slot, index) => (
                <div
                  key={index}
                  className={`border-2 border-dashed border-gray-300 rounded cursor-pointer transition-all duration-200 ${
                    selectedSlot === slot ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
                  }`}
                  onClick={() => onSlotClick(slot)}
                  style={{ 
                    backgroundImage: getPhotoUrl(slot?.photoId) ? `url(${getPhotoUrl(slot?.photoId)})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                >
                  {!getPhotoUrl(slot?.photoId) && (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <div className="text-xs">📷</div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
});

TemplateVisual.displayName = 'TemplateVisual';

export default TemplateVisual;