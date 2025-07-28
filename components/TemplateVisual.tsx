import React from 'react';
import { TemplateSlot, Photo } from '../types';

interface TemplateVisualProps {
  template: { id: string; name: string; slots: number };
  slots: TemplateSlot[];
  onSlotClick: (slot: TemplateSlot) => void;
  photos: Photo[];
  selectedSlot: TemplateSlot | null;
}

const TemplateVisual: React.FC<TemplateVisualProps> = ({
  template,
  slots,
  onSlotClick,
  photos,
  selectedSlot
}) => {
  console.log('🎨 TemplateVisual render:', {
    templateId: template.id,
    templateName: template.name,
    templateSlots: template.slots,
    slotsLength: slots.length,
    // Dynamic template types - remove hardcoded array
    template: { id: template.id, type: template.id }
  });
  const getPhotoUrl = (photoId?: string | null) => {
    if (!photoId) {
      console.log('🖼️ TemplateVisual: No photoId provided');
      return null;
    }
    
    const photo = photos.find(p => p.id === photoId);
    if (!photo) {
      console.log('🖼️ TemplateVisual: Photo not found for ID:', photoId, 'Available photos:', photos.length);
      return null;
    }
    
    console.log('🖼️ TemplateVisual: Found photo:', photo.name, 'ID:', photoId);
    
    // Use higher resolution thumbnail for better template preview quality
    if (photo.thumbnailUrl) {
      const url = photo.thumbnailUrl.replace('=s220', '=s600');
      console.log('🖼️ TemplateVisual: Using thumbnail URL:', url);
      return url;
    }
    
    console.log('🖼️ TemplateVisual: Using original URL:', photo.url);
    return photo.url || null;
  };

  // 4R print format (4x6 inches) - width:height ratio of 2:3 (or 4:6)
  const printAspectRatio = '2/3'; // CSS aspect-ratio for 4x6 print

  if (template.id === 'solo') {
    // Solo Template - Single large photo with proper padding/border for 4R print
    return (
      <div className="bg-white p-4 rounded-lg shadow-md w-full h-full" style={{ aspectRatio: printAspectRatio, minHeight: '200px' }}>
        <div 
          className={`w-full h-full cursor-pointer transition-all duration-200 border-2 border-gray-200 rounded ${
            selectedSlot === slots[0] ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:border-gray-300'
          }`}
          onClick={() => onSlotClick(slots[0])}
          style={{ 
            backgroundImage: getPhotoUrl(slots[0]?.photoId) ? `url(${getPhotoUrl(slots[0]?.photoId)})` : 'none',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundColor: getPhotoUrl(slots[0]?.photoId) ? 'transparent' : '#f8f9fa'
          }}
        >
          {!getPhotoUrl(slots[0]?.photoId) && (
            <div className="w-full h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-3xl mb-2">+</div>
                <div className="text-xs font-medium">Tap to Add Photo</div>
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
      <div className="bg-white p-3 rounded-lg shadow-md w-full h-full" style={{ aspectRatio: printAspectRatio, minHeight: '200px' }}>
        <div className="grid grid-cols-2 gap-2 h-full">
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
                backgroundPosition: 'center',
                backgroundColor: getPhotoUrl(slot?.photoId) ? 'transparent' : '#f8f9fa'
              }}
            >
              {!getPhotoUrl(slot?.photoId) && (
                <div className="w-full h-full flex items-center justify-center text-gray-500 border-2 border-dashed border-gray-300">
                  <div className="text-center">
                    <div className="text-lg mb-1">+</div>
                    <div className="text-xs font-medium">Tap to Add</div>
                  </div>
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
      <div className="bg-white rounded-lg shadow-md overflow-hidden w-full h-full" style={{ aspectRatio: printAspectRatio, minHeight: '200px' }}>
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
                backgroundPosition: 'center',
                backgroundColor: getPhotoUrl(slot?.photoId) ? 'transparent' : '#f8f9fa'
              }}
            >
              {!getPhotoUrl(slot?.photoId) && (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <div className="text-lg mb-1">+</div>
                    <div className="text-xs font-medium">Tap to Add</div>
                  </div>
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
      <div className="bg-white p-3 rounded-lg shadow-md w-full h-full" style={{ aspectRatio: printAspectRatio, minHeight: '200px' }}>
        <div className="grid grid-rows-3 gap-1 h-full">
          {[0, 1, 2].map((row) => (
            <div key={row} className="grid grid-cols-2 gap-1 h-full">
              {slots.slice(row * 2, row * 2 + 2).map((slot, index) => (
                <div
                  key={index}
                  className={`cursor-pointer transition-all duration-200 ${
                    selectedSlot === slot ? 'ring-2 ring-blue-500 ring-inset' : ''
                  }`}
                  onClick={() => onSlotClick(slot)}
                  style={{ 
                    backgroundImage: getPhotoUrl(slot?.photoId) ? `url(${getPhotoUrl(slot?.photoId)})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundColor: getPhotoUrl(slot?.photoId) ? 'transparent' : '#f8f9fa'
                  }}
                >
                  {!getPhotoUrl(slot?.photoId) && (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 border border-dashed border-gray-300">
                      <div className="text-center">
                        <div className="text-sm mb-1">+</div>
                        <div className="text-xs font-medium">Add</div>
                      </div>
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

  // Fallback for any unmatched template types - render a simple preview
  console.warn(`⚠️ TemplateVisual: Unknown template type "${template.id}", using fallback rendering`);
  
  return (
    <div className="bg-white p-3 rounded-lg shadow-md w-full h-full" style={{ aspectRatio: printAspectRatio, minHeight: '200px' }}>
      <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
        <div className="text-center text-gray-500">
          <div className="text-lg mb-2">{template.name}</div>
          <div className="text-xs">
            {template.slots} slot{template.slots !== 1 ? 's' : ''}
          </div>
          <div className="text-xs text-gray-400 mt-1">
            Type: {template.id}
          </div>
        </div>
      </div>
    </div>
  );
};

TemplateVisual.displayName = 'TemplateVisual';

export default TemplateVisual;