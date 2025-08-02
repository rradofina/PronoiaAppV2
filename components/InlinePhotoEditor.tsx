import React, { useState, useEffect } from 'react';
import { TemplateSlot, Photo, PhotoTransform, createPhotoTransform, isPhotoTransform } from '../types';
import PhotoRenderer from './PhotoRenderer';
import { photoCacheService } from '../services/photoCacheService';
import { getHighResPhotoUrls } from '../utils/photoUrlUtils';

interface InlinePhotoEditorProps {
  slot: TemplateSlot;
  photo: Photo;
  photos: Photo[];
  onApply: (slotId: string, photoId: string, transform: PhotoTransform) => void;
  onCancel: () => void;
  className?: string;
}

export default function InlinePhotoEditor({
  slot,
  photo,
  photos,
  onApply,
  onCancel,
  className = ''
}: InlinePhotoEditorProps) {
  const [selectedPhotoUrl, setSelectedPhotoUrl] = useState<string | null>(null);
  const [currentTransform, setCurrentTransform] = useState<PhotoTransform>(createPhotoTransform(1, 0.5, 0.5));
  const [photoKey, setPhotoKey] = useState<string>('');
  const [componentKey, setComponentKey] = useState<string>('');

  // Initialize transform when slot or photo changes
  useEffect(() => {
    console.log('🔧 InlinePhotoEditor - Transform initialization:', {
      slotId: slot?.id,
      hasExistingTransform: !!slot?.transform,
      existingTransform: slot?.transform,
      photoId: photo?.id,
      hasOnApply: !!onApply,
      hasOnCancel: !!onCancel
    });
    
    // Force re-render with new keys to clear any cached state and ensure fresh component
    const timestamp = Date.now();
    setPhotoKey(`inline-${slot?.id}-${photo?.id}-${timestamp}`);
    setComponentKey(`component-${slot?.id}-${photo?.id}-${timestamp}`);
    
    // If the slot already has a transform and we're re-editing the same photo, use it
    if (slot?.transform && isPhotoTransform(slot.transform) && slot.photoId === photo?.id) {
      console.log('✅ InlinePhotoEditor - Using existing transform for same photo');
      setCurrentTransform(slot.transform);
    } else {
      console.log('🔄 InlinePhotoEditor - Using default transform for new photo');
      setCurrentTransform(createPhotoTransform(1, 0.5, 0.5));
    }
    
    // Validate that we have the required props
    if (!onApply || !onCancel) {
      console.error('🚨 InlinePhotoEditor - Missing required handlers:', {
        hasOnApply: !!onApply,
        hasOnCancel: !!onCancel
      });
    }
  }, [slot?.id, photo?.id, slot?.transform, slot?.photoId, onApply, onCancel]);

  // Load photo URL with instant display and cache optimization
  useEffect(() => {
    if (photo) {
      // Set immediate URL for instant display
      const immediateUrl = photoCacheService.getImmediateUrl(photo);
      setSelectedPhotoUrl(immediateUrl);
      
      console.log('🚀 InlinePhotoEditor - Instant display with immediate URL for', photo.name);
      
      // Load high-quality blob in background and update when ready
      const loadOptimalPhoto = async () => {
        try {
          console.log('🔄 InlinePhotoEditor - Loading optimal blob...');
          const blobUrl = await photoCacheService.getBlobUrl(photo);
          
          // Only update if this is still the current photo
          if (photo) {
            setSelectedPhotoUrl(blobUrl);
            console.log('✅ InlinePhotoEditor - Upgraded to optimal blob URL for', photo.name);
          }
        } catch (error) {
          console.error('❌ InlinePhotoEditor - Failed to load optimal photo:', error);
          // Keep the immediate URL that's already displayed
        }
      };
      
      // Start loading optimal version (don't await to avoid blocking)
      loadOptimalPhoto();
    } else {
      setSelectedPhotoUrl(null);
    }
  }, [photo?.id]);

  // Handle transform changes from PhotoRenderer
  const handleTransformChange = (newTransform: PhotoTransform) => {
    setCurrentTransform(newTransform);
    console.log('🔧 InlinePhotoEditor - Transform updated:', newTransform);
  };

  // Handle apply button click
  const handleApply = () => {
    console.log('🔧 InlinePhotoEditor - APPLY BUTTON CLICKED');
    
    try {
      if (!slot?.id || !photo?.id) {
        console.error('🚨 InlinePhotoEditor - Missing required IDs:', { slotId: slot?.id, photoId: photo?.id });
        return;
      }

      if (!onApply) {
        console.error('🚨 InlinePhotoEditor - onApply handler is missing!');
        return;
      }

      console.log('🔧 InlinePhotoEditor - Applying transform:', {
        transform: currentTransform,
        photoId: photo.id,
        slotId: slot.id,
        hasOnApplyHandler: !!onApply
      });
      
      onApply(slot.id, photo.id, currentTransform);
      console.log('✅ InlinePhotoEditor - onApply called successfully');
    } catch (error) {
      console.error('🚨 InlinePhotoEditor - Error in handleApply:', error);
      // Fallback to basic transform if we have valid IDs
      if (slot?.id && photo?.id && onApply) {
        console.log('🔄 InlinePhotoEditor - Trying fallback with basic transform');
        onApply(slot.id, photo.id, createPhotoTransform(1, 0.5, 0.5));
      }
    }
  };

  // Handle cancel button click
  const handleCancel = () => {
    console.log('🔧 InlinePhotoEditor - CANCEL BUTTON CLICKED');
    
    if (!onCancel) {
      console.error('🚨 InlinePhotoEditor - onCancel handler is missing!');
      return;
    }

    console.log('🔧 InlinePhotoEditor - Calling onCancel handler');
    onCancel();
    console.log('✅ InlinePhotoEditor - onCancel called successfully');
  };

  if (!selectedPhotoUrl) {
    return (
      <div className={`w-full h-full bg-gray-200 border border-gray-300 border-dashed flex items-center justify-center ${className}`}>
        <span className="text-gray-500 text-xs">Loading...</span>
      </div>
    );
  }

  return (
    <div key={componentKey} className={`relative w-full h-full z-50 ${className}`}>
      {/* Interactive PhotoRenderer */}
      <PhotoRenderer
        key={photoKey}
        photoUrl={selectedPhotoUrl}
        photoAlt={photo?.name || 'Selected photo'}
        transform={currentTransform}
        interactive={true}
        onTransformChange={handleTransformChange}
        className="w-full h-full"
        debug={false}
        fallbackUrls={photo ? getHighResPhotoUrls(photo) : []}
        showClippingIndicators={true} // Enable clipping indicators
      />
      
      {/* Editing Controls Overlay */}
      <div className="absolute top-2 right-2 flex space-x-2 z-50">
        <button
          onClick={handleApply}
          className="bg-green-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-green-700 shadow-lg"
          title="Apply photo"
        >
          ✓
        </button>
        <button
          onClick={handleCancel}
          className="bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium hover:bg-red-700 shadow-lg"
          title="Cancel"
        >
          ✕
        </button>
      </div>
      
      {/* Editing Indicator */}
      <div className="absolute top-2 left-2 bg-yellow-500 text-black px-2 py-1 rounded-md text-xs font-medium shadow-lg z-50">
        Editing
      </div>
      
      {/* Instructions */}
      <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-70 text-white px-3 py-2 rounded-md text-xs text-center z-50">
        Pinch to zoom • Drag to position
      </div>
    </div>
  );
}