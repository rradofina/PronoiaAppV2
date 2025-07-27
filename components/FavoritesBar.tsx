import React from 'react';
import { Photo } from '../types';

interface FavoritesBarProps {
  favoritedPhotos: Photo[];
  onPhotoClick: (photo: Photo) => void;
  onRemoveFavorite: (photoId: string) => void;
}

export default function FavoritesBar({
  favoritedPhotos,
  onPhotoClick,
  onRemoveFavorite
}: FavoritesBarProps) {
  
  if (favoritedPhotos.length === 0) {
    return (
      <div className="h-24 bg-gray-100 border-t flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-2xl mb-1">⭐</div>
          <p className="text-sm">No favorites yet - star photos to add them here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-24 bg-white border-t overflow-hidden">
      <div className="h-full flex items-center">
        <div className="flex-shrink-0 px-3 text-sm font-medium text-gray-700">
          Favorites ({favoritedPhotos.length})
        </div>
        
        <div className="flex-1 overflow-x-auto">
          <div className="flex space-x-2 px-2 py-2" style={{ touchAction: 'pan-x' }}>
            {favoritedPhotos.map((photo) => (
              <div
                key={photo.id}
                className="flex-shrink-0 relative group cursor-pointer"
                onClick={() => onPhotoClick(photo)}
              >
                <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-blue-400 transition-colors">
                  <img
                    src={photo.thumbnailUrl || photo.url}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Remove button on hover */}
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
}