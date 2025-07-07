// Updated: Photo cropper component
import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';

// Types
import { Photo, PhotoSlot } from '../types';

interface PhotoCropperProps {
  photos: Photo[];
  selectedSlot: PhotoSlot;
  onPhotoSelect: (photo: Photo, transform?: { scale: number; offsetX: number; offsetY: number }) => void;
  onClose: () => void;
}

interface Transform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export default function PhotoCropper({ photos, selectedSlot, onPhotoSelect, onClose }: PhotoCropperProps) {
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [transform, setTransform] = useState<Transform>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });
  
  const [isDragging, setIsDragging] = useState(false);
  const [lastTouch, setLastTouch] = useState<{ x: number; y: number } | null>(null);
  const [lastPinchDistance, setLastPinchDistance] = useState<number>(0);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Initialize with existing photo if editing
  useEffect(() => {
    if (selectedSlot.photo) {
      setSelectedPhoto(selectedSlot.photo);
      if (selectedSlot.photoTransform) {
        setTransform(selectedSlot.photoTransform);
      }
    }
  }, [selectedSlot]);

  const handlePhotoClick = (photo: Photo) => {
    setSelectedPhoto(photo);
    setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
    setImageLoaded(false);
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  // Touch event handlers using simple event objects
  const handleTouchStart = (e: any) => {
    e.preventDefault();
    
    if (e.touches.length === 1) {
      // Single touch - start dragging
      setIsDragging(true);
      setLastTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      // Multi-touch - pinch gesture
      setIsDragging(false);
      const distance = getDistance(e.touches[0], e.touches[1]);
      setLastPinchDistance(distance);
    }
  };

  const handleTouchMove = (e: any) => {
    e.preventDefault();
    
    if (e.touches.length === 1 && isDragging && lastTouch) {
      // Single touch - pan image
      const deltaX = e.touches[0].clientX - lastTouch.x;
      const deltaY = e.touches[0].clientY - lastTouch.y;
      
      setTransform({
        ...transform,
        offsetX: transform.offsetX + deltaX,
        offsetY: transform.offsetY + deltaY,
      });
      
      setLastTouch({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    } else if (e.touches.length === 2) {
      // Multi-touch - pinch to zoom
      const distance = getDistance(e.touches[0], e.touches[1]);
      const scaleFactor = distance / lastPinchDistance;
      
      setTransform({
        ...transform,
        scale: Math.max(0.5, Math.min(3, transform.scale * scaleFactor)),
      });
      
      setLastPinchDistance(distance);
    }
  };

  const handleTouchEnd = (e: any) => {
    e.preventDefault();
    setIsDragging(false);
    setLastTouch(null);
    setLastPinchDistance(0);
  };

  // Mouse events for desktop testing
  const handleMouseDown = (e: any) => {
    if (e.button === 0) { // Left click only
      setIsDragging(true);
      setLastTouch({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: any) => {
    if (isDragging && lastTouch) {
      const deltaX = e.clientX - lastTouch.x;
      const deltaY = e.clientY - lastTouch.y;
      
      setTransform({
        ...transform,
        offsetX: transform.offsetX + deltaX,
        offsetY: transform.offsetY + deltaY,
      });
      
      setLastTouch({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setLastTouch(null);
  };

  const handleWheel = (e: any) => {
    e.preventDefault();
    const scaleFactor = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform({
      ...transform,
      scale: Math.max(0.5, Math.min(3, transform.scale * scaleFactor)),
    });
  };

  const getDistance = (touch1: any, touch2: any) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleReset = () => {
    setTransform({ scale: 1, offsetX: 0, offsetY: 0 });
  };

  const handleConfirm = () => {
    if (selectedPhoto) {
      onPhotoSelect(selectedPhoto, transform);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      {/* Header */}
      <div className="bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            {selectedSlot.label || `Photo Slot ${selectedSlot.index + 1}`}
          </h2>
          <p className="text-gray-600">Select and frame your photo</p>
        </div>
        <button
          onClick={onClose}
          className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full flex items-center justify-center"
        >
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex">
        {/* Photo Selection Sidebar */}
        <div className="w-80 bg-white border-r overflow-y-auto">
          <div className="p-4">
            <h3 className="font-semibold text-gray-900 mb-4">Choose Photo ({photos.length})</h3>
            <div className="grid grid-cols-2 gap-3">
              {photos.map((photo) => (
                <motion.div
                  key={photo.id}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handlePhotoClick(photo)}
                  className={`
                    relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all
                    ${selectedPhoto?.id === photo.id 
                      ? 'border-blue-500 ring-2 ring-blue-200' 
                      : 'border-gray-200 hover:border-gray-300'
                    }
                  `}
                >
                  <img
                    src={photo.thumbnailUrl}
                    alt={photo.name}
                    className="w-full h-full object-cover"
                  />
                  {selectedPhoto?.id === photo.id && (
                    <div className="absolute inset-0 bg-blue-500 bg-opacity-20 flex items-center justify-center">
                      <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Photo Cropper Area */}
        <div className="flex-1 flex flex-col">
          {selectedPhoto ? (
            <>
              {/* Cropping Instructions */}
              <div className="bg-gray-900 text-white px-6 py-3">
                <div className="flex items-center justify-center space-x-6 text-sm">
                  <span className="flex items-center space-x-2">
                    <span>🤏</span>
                    <span>Pinch to zoom</span>
                  </span>
                  <span className="flex items-center space-x-2">
                    <span>👆</span>
                    <span>Drag to pan</span>
                  </span>
                  <span className="flex items-center space-x-2">
                    <span>🔄</span>
                    <span>Scroll to zoom (desktop)</span>
                  </span>
                </div>
              </div>

              {/* Crop Area */}
              <div className="flex-1 relative bg-gray-100 overflow-hidden">
                <div
                  className="absolute inset-4 bg-white rounded-lg shadow-lg overflow-hidden cursor-move"
                  style={{
                    aspectRatio: selectedSlot.position.width / selectedSlot.position.height,
                    maxWidth: '90%',
                    maxHeight: '90%',
                    margin: 'auto',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onWheel={handleWheel}
                >
                  <img
                    src={selectedPhoto.url}
                    alt={selectedPhoto.name}
                    className="absolute inset-0 select-none pointer-events-none"
                    onLoad={handleImageLoad}
                    style={{
                      transform: `scale(${transform.scale}) translate(${transform.offsetX}px, ${transform.offsetY}px)`,
                      transformOrigin: 'center',
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                    }}
                  />
                  
                  {/* Loading overlay */}
                  {!imageLoaded && (
                    <div className="absolute inset-0 bg-gray-200 flex items-center justify-center">
                      <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>

                {/* Crop frame overlay */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-4 border-2 border-dashed border-blue-500 rounded-lg"></div>
                </div>
              </div>

              {/* Controls */}
              <div className="bg-white border-t px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div className="text-sm text-gray-600">
                    Zoom: {(transform.scale * 100).toFixed(0)}%
                  </div>
                  <button
                    onClick={handleReset}
                    className="btn-secondary text-sm"
                  >
                    Reset
                  </button>
                </div>
                
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onClose}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleConfirm}
                    className="btn-primary"
                  >
                    Use This Photo
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* No photo selected */
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              <div className="text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-lg font-medium">Select a photo to start framing</p>
                <p className="text-sm">Choose from the photos on the left</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { PhotoCropper }; 