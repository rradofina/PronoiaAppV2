import { useState } from 'react';
import { Photo, TemplateSlot } from '../types';

interface FullscreenPhotoViewerProps {
  photo: Photo;
  photos: Photo[];
  onClose: () => void;
  onAddToTemplate: (photo: Photo) => void;
  isVisible: boolean;
}

export default function FullscreenPhotoViewer({
  photo,
  photos,
  onClose,
  onAddToTemplate,
  isVisible
}: FullscreenPhotoViewerProps) {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(() => 
    photo ? photos.findIndex(p => p.id === photo.id) : 0
  );

  if (!isVisible || !photo) return null;

  const currentPhoto = photos[currentPhotoIndex] || photo;

  const handlePrevious = () => {
    setCurrentPhotoIndex(prev => prev > 0 ? prev - 1 : photos.length - 1);
  };

  const handleNext = () => {
    setCurrentPhotoIndex(prev => prev < photos.length - 1 ? prev + 1 : 0);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <button
          onClick={onClose}
          className="flex items-center space-x-2 text-white hover:text-gray-300"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        
        <div className="text-center">
          <h3 className="font-medium">{currentPhoto.name}</h3>
          <p className="text-sm text-gray-300">{currentPhotoIndex + 1} of {photos.length}</p>
        </div>
        
        <div className="w-6" /> {/* Spacer */}
      </div>

      {/* Photo Display */}
      <div className="flex-1 flex items-center justify-center relative">
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          className="absolute left-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        {/* Photo */}
        <img
          src={currentPhoto.url}
          alt={currentPhoto.name}
          className="max-w-full max-h-full object-contain"
        />

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="absolute right-4 z-10 bg-black bg-opacity-50 text-white rounded-full p-2 hover:bg-opacity-70"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Bottom Actions */}
      <div className="p-4">
        <button
          onClick={() => onAddToTemplate(currentPhoto)}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Add to Print Template
        </button>
      </div>
    </div>
  );
}