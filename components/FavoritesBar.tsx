import React from 'react';
import { Photo } from '../types';

interface FavoritesBarProps {
  favoritedPhotos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onRemoveFavorite: (photoId: string) => void;
  isActiveInteractionArea?: boolean; // New prop to indicate when this is the active area
  layout?: 'horizontal' | 'vertical'; // New prop to control layout
  showRemoveButtons?: boolean; // New prop to control remove button visibility
}

export default function FavoritesBar({
  favoritedPhotos,
  onPhotoClick,
  onRemoveFavorite,
  isActiveInteractionArea = false,
  layout = 'horizontal',
  showRemoveButtons = true
}: FavoritesBarProps) {
  
  if (favoritedPhotos.length === 0) {
    return (
      <div className={`flex items-center justify-center ${
        layout === 'horizontal' 
          ? 'h-24 border-t' 
          : 'h-full'
      } ${
        isActiveInteractionArea 
          ? 'bg-yellow-50 border-yellow-300 border-t-2' 
          : 'bg-gray-100'
      }`}>
        <div className={`text-center ${
          isActiveInteractionArea ? 'text-yellow-600' : 'text-gray-500'
        }`}>
          <div className="text-2xl mb-1">⭐</div>
          <p className="text-sm">
            {isActiveInteractionArea 
              ? 'Select a favorite photo to fill the template slot'
              : 'No favorites yet - star photos to add them here'
            }
          </p>
        </div>
      </div>
    );
  }

  if (layout === 'horizontal') {
    // Horizontal layout (original mobile/tablet design)
    return (
      <div className={`h-24 border-t overflow-hidden transition-colors duration-200 ${
        isActiveInteractionArea 
          ? 'bg-yellow-50 border-yellow-300 border-t-2 shadow-lg' 
          : 'bg-white'
      }`}>
        <div className="h-full flex items-center">
          <div className={`flex-shrink-0 px-3 text-sm font-medium ${
            isActiveInteractionArea ? 'text-yellow-700 font-bold' : 'text-gray-700'
          }`}>
            {isActiveInteractionArea ? '⚡ ' : ''}Favorites ({favoritedPhotos.length})
            {isActiveInteractionArea && <div className="text-xs text-yellow-600">Tap to fill slot</div>}
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <div className="flex space-x-2 px-2 py-2" style={{ touchAction: 'pan-x' }}>
              {favoritedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  className="flex-shrink-0 relative group cursor-pointer"
                  onClick={() => onPhotoClick(photo)}
                >
                  <div className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                    isActiveInteractionArea 
                      ? 'border-yellow-400 hover:border-yellow-500 shadow-md hover:shadow-lg hover:scale-105' 
                      : 'border-gray-200 hover:border-blue-400'
                  }`}>
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={photo.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  {/* Remove button on hover - conditional */}
                  {showRemoveButtons && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveFavorite(photo.id);
                      }}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Remove from favorites"
                    >
                      ×
                    </button>
                  )}
                  
                  {/* Star indicator */}
                  <div className="absolute bottom-0 right-0 bg-yellow-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                    ⭐
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    // Vertical layout (desktop grid design)
    return (
      <div className={`h-full transition-colors duration-200 ${
        isActiveInteractionArea 
          ? 'bg-yellow-50 border-yellow-300 shadow-lg' 
          : 'bg-white'
      }`}>
        <div className="grid grid-cols-3 gap-2 p-4">
          {favoritedPhotos.map((photo) => (
            <div
              key={photo.id}
              className="relative aspect-square cursor-pointer group transition-all duration-200"
              onClick={() => onPhotoClick(photo)}
            >
              <div className={`w-full h-full rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                isActiveInteractionArea 
                  ? 'border-yellow-400 hover:border-yellow-500 shadow-md hover:shadow-lg hover:scale-105' 
                  : 'border-gray-200 hover:border-blue-400'
              }`}>
                <img
                  src={photo.thumbnailUrl || photo.url}
                  alt={photo.name}
                  className="w-full h-full object-cover"
                />
              </div>
              
              {/* Remove button on hover - conditional */}
              {showRemoveButtons && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFavorite(photo.id);
                  }}
                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove from favorites"
                >
                  ×
                </button>
              )}
              
              {/* Star indicator */}
              <div className="absolute bottom-0 right-0 bg-yellow-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs">
                ⭐
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
}