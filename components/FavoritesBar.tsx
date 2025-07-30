import React from 'react';
import { Photo } from '../types';

interface FavoritesBarProps {
  favoritedPhotos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onRemoveFavorite: (photoId: string) => void;
  isActiveInteractionArea?: boolean; // New prop to indicate when this is the active area
  layout?: 'horizontal' | 'vertical'; // New prop to control layout
  showRemoveButtons?: boolean; // New prop to control remove button visibility
  usedPhotoIds?: Set<string>; // New prop to track which photos are already used
  isExpanded?: boolean; // New prop to control expanded state with animations
}

export default function FavoritesBar({
  favoritedPhotos,
  onPhotoClick,
  onRemoveFavorite,
  isActiveInteractionArea = false,
  layout = 'horizontal',
  showRemoveButtons = true,
  usedPhotoIds = new Set(),
  isExpanded = false
}: FavoritesBarProps) {
  
  
  if (favoritedPhotos.length === 0) {
    return (
      <div className={`flex items-center justify-center transition-all duration-300 ease-in-out ${
        layout === 'horizontal' 
          ? isExpanded ? 'h-64 border-t' : 'h-24 border-t'
          : 'h-full'
      } ${
        isActiveInteractionArea 
          ? 'bg-yellow-50 border-yellow-300 border-t-2' 
          : isExpanded && layout === 'horizontal'
          ? 'bg-blue-50 border-blue-300 border-t-2'
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
    // Horizontal layout (original mobile/tablet design) with expansion animation
    return (
      <div className={`border-t overflow-hidden transition-all duration-300 ease-in-out ${
        isExpanded ? 'h-64' : 'h-24'
      } ${
        isActiveInteractionArea 
          ? 'bg-yellow-50 border-yellow-300 border-t-2 shadow-lg' 
          : isExpanded
          ? 'bg-blue-50 border-blue-300 border-t-2 shadow-lg'
          : 'bg-white'
      }`}>
        <div className="h-full flex items-center">
          <div className={`flex-shrink-0 px-3 text-sm font-medium ${
            isActiveInteractionArea ? 'text-yellow-700 font-bold' : isExpanded ? 'text-blue-700 font-bold' : 'text-gray-700'
          }`}>
            {isActiveInteractionArea ? '⚡ ' : isExpanded ? '📌 ' : ''}Favorites ({favoritedPhotos.length})
            {isActiveInteractionArea && <div className="text-xs text-yellow-600">Tap to fill slot</div>}
            {isExpanded && !isActiveInteractionArea && <div className="text-xs text-blue-600">Slot selected - choose photo</div>}
          </div>
          
          <div className="flex-1 overflow-x-auto">
            <div className={`flex px-2 py-2 transition-all duration-300 ease-in-out ${
              isExpanded ? 'space-x-4' : 'space-x-2'
            }`} style={{ touchAction: 'pan-x' }}>
              {favoritedPhotos.map((photo) => {
                const isUsed = usedPhotoIds.has(photo.id);
                return (
                  <div
                    key={photo.id}
                    className="flex-shrink-0 relative group cursor-pointer"
                    onClick={() => onPhotoClick(photo)}
                  >
                    <div className={`rounded-lg overflow-hidden border-2 transition-all duration-300 ease-in-out ${
                      isExpanded ? 'h-32' : 'h-16'
                    } ${
                      isUsed
                        ? 'border-green-400 shadow-md' // Used photos get green border
                        : isActiveInteractionArea 
                        ? 'border-yellow-400 hover:border-yellow-500 shadow-md hover:shadow-lg hover:scale-105' 
                        : isExpanded
                        ? 'border-blue-400 hover:border-blue-500 shadow-md hover:shadow-lg hover:scale-105'
                        : 'border-gray-200 hover:border-blue-400'
                    }`} style={{
                      width: isExpanded ? 'auto' : '64px',
                      aspectRatio: isExpanded ? 'auto' : '1'
                    }}>
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt={photo.name}
                        className={`w-full h-full object-cover transition-opacity duration-200 ${
                          isUsed ? 'opacity-60' : 'opacity-100'
                        }`}
                      />
                      
                      {/* Used indicator overlay */}
                      {isUsed && (
                        <div className="absolute inset-0 bg-green-600 bg-opacity-20 flex items-center justify-center">
                          <div className="bg-green-600 text-white text-xs px-1 rounded font-medium">
                            Used
                          </div>
                        </div>
                      )}
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
                  <div className={`absolute bottom-0 right-0 bg-yellow-500 text-white rounded-full flex items-center justify-center transition-all duration-300 ease-in-out ${
                    isExpanded ? 'w-5 h-5 text-sm' : 'w-4 h-4 text-xs'
                  }`}>
                    ⭐
                  </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  } else {
    // Vertical layout (desktop grid design) with expansion support
    return (
      <div className={`h-full transition-all duration-300 ease-in-out ${
        isActiveInteractionArea 
          ? 'bg-yellow-50 border-yellow-300 shadow-lg' 
          : isExpanded
          ? 'bg-blue-50 border-blue-300 shadow-lg'
          : 'bg-white'
      }`}>
        <div className={`grid gap-2 p-4 transition-all duration-300 ease-in-out ${
          isExpanded ? 'grid-cols-2 gap-3' : 'grid-cols-3 gap-2'
        }`}>
          {favoritedPhotos.map((photo) => {
            const isUsed = usedPhotoIds.has(photo.id);
            return (
              <div
                key={photo.id}
                className="relative cursor-pointer group transition-all duration-300 ease-in-out"
                onClick={() => onPhotoClick(photo)}
                style={{
                  aspectRatio: isExpanded ? 'auto' : '1'
                }}
              >
                <div className={`w-full rounded-lg overflow-hidden border-2 transition-all duration-300 ease-in-out ${
                  isExpanded ? 'h-auto' : 'h-full'
                } ${
                  isUsed
                    ? 'border-green-400 shadow-md' // Used photos get green border
                    : isActiveInteractionArea 
                    ? 'border-yellow-400 hover:border-yellow-500 shadow-md hover:shadow-lg hover:scale-105' 
                    : isExpanded
                    ? 'border-blue-400 hover:border-blue-500 shadow-md hover:shadow-lg hover:scale-105'
                    : 'border-gray-200 hover:border-blue-400'
                }`}>
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.name}
                    className={`w-full h-full object-cover transition-opacity duration-200 ${
                      isUsed ? 'opacity-60' : 'opacity-100'
                    }`}
                  />
                  
                  {/* Used indicator overlay */}
                  {isUsed && (
                    <div className="absolute inset-0 bg-green-600 bg-opacity-20 flex items-center justify-center">
                      <div className="bg-green-600 text-white text-xs px-1 rounded font-medium">
                        Used
                      </div>
                    </div>
                  )}
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
              <div className={`absolute bottom-0 right-0 bg-yellow-500 text-white rounded-full flex items-center justify-center transition-all duration-300 ease-in-out ${
                isExpanded ? 'w-5 h-5 text-sm' : 'w-4 h-4 text-xs'
              }`}>
                ⭐
              </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}