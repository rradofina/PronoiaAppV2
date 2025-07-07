// Updated: Photo selection component
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

// Store and Utils
import useAppStore from '../stores/useAppStore';
import { googleDriveService } from '../services/googleDriveService';
import { calculatePhotoSlots } from '../utils/constants';

// Types
import { Photo, Template, PhotoSlot } from '../types';

// Components
import { PhotoCropper } from './PhotoCropper';

export default function PhotoSelection() {
  const { 
    session,
    photos,
    templates,
    selectedTemplate,
    setPhotos,
    selectTemplate,
    selectPhotoForSlot,
    removePhotoFromSlot,
    setSelectedPhotoSlot,
    uiState,
    setLoading,
    nextStep
  } = useAppStore();

  const [isLoadingPhotos, setIsLoadingPhotos] = useState(false);
  const [showPhotoCropper, setShowPhotoCropper] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<PhotoSlot | null>(null);
  const [availablePhotos, setAvailablePhotos] = useState<Photo[]>([]);

  useEffect(() => {
    if (session?.googleDriveFolderId && photos.length === 0) {
      loadPhotosFromSession();
    }
  }, [session]);

  const loadPhotosFromSession = async () => {
    if (!session?.googleDriveFolderId) return;

    setIsLoadingPhotos(true);
    try {
      const sessionPhotos = await googleDriveService.getPhotosFromFolder(session.googleDriveFolderId);
      setPhotos(sessionPhotos);
      setAvailablePhotos(sessionPhotos);
      toast.success(`Loaded ${sessionPhotos.length} photos from session`);
    } catch (error) {
      console.error('Failed to load photos:', error);
      toast.error('Failed to load photos from session');
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  const handleTemplateSelect = (template: Template) => {
    selectTemplate(template);
    
    // Initialize photo slots if not already done
    if (template.photoSlots.length === 0) {
      const slots = calculatePhotoSlots(template.type);
      const photoSlots: PhotoSlot[] = slots.map((slot, index) => ({
        id: `slot_${template.id}_${index}`,
        position: slot,
        index,
        label: `Photo ${index + 1}`,
      }));
      
      // Update template with slots (this should be handled by the store)
      template.photoSlots = photoSlots;
    }
  };

  const handleSlotClick = (template: Template, slot: PhotoSlot) => {
    setSelectedSlot(slot);
    selectTemplate(template);
    setSelectedPhotoSlot(slot);
    setShowPhotoCropper(true);
  };

  const handlePhotoSelect = (photo: Photo, transform?: { scale: number; offsetX: number; offsetY: number }) => {
    if (!selectedTemplate || !selectedSlot) return;

    selectPhotoForSlot(selectedTemplate.id, selectedSlot.id, photo);
    
    // Update photo transform if provided
    if (transform) {
      selectedSlot.photoTransform = transform;
    }

    setShowPhotoCropper(false);
    setSelectedSlot(null);
    setSelectedPhotoSlot(null);
  };

  const handleRemovePhoto = (template: Template, slot: PhotoSlot) => {
    removePhotoFromSlot(template.id, slot.id);
    slot.photoTransform = undefined;
  };

  const handleContinue = () => {
    const incompleteTemplates = templates.filter(template => 
      template.photoSlots.some(slot => !slot.photo)
    );

    if (incompleteTemplates.length > 0) {
      toast.error('Please fill all photo slots before continuing');
      return;
    }

    nextStep();
  };

  const getTemplateProgress = (template: Template) => {
    const totalSlots = template.photoSlots.length;
    const filledSlots = template.photoSlots.filter(slot => slot.photo).length;
    return { filled: filledSlots, total: totalSlots, percentage: (filledSlots / totalSlots) * 100 };
  };

  if (isLoadingPhotos) {
    return (
      <div className="container-tablet py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-lg text-gray-600">Loading session photos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container-tablet py-8 h-full overflow-auto">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Select Photos for Templates
          </h1>
          <p className="text-lg text-gray-600">
            Tap photo slots to select and frame your photos. Use pinch and zoom to adjust framing.
          </p>
          <div className="flex items-center justify-center space-x-4 mt-4 text-sm text-gray-500">
            <span>📱 Tap to select</span>
            <span>🤏 Pinch to zoom</span>
            <span>👆 Drag to pan</span>
          </div>
        </motion.div>

        {/* Session Info */}
        {session && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-blue-50 rounded-lg p-4 mb-8"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-blue-900">{session.clientName}</p>
                <p className="text-blue-700">Package {session.packageType} • {availablePhotos.length} photos loaded</p>
              </div>
              <button
                onClick={loadPhotosFromSession}
                className="text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Refresh Photos
              </button>
            </div>
          </motion.div>
        )}

        {/* Templates Grid */}
        <div className="space-y-8">
          {templates.map((template, templateIndex) => {
            const progress = getTemplateProgress(template);
            
            return (
              <motion.div
                key={template.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + templateIndex * 0.1 }}
                className="bg-white rounded-xl shadow-lg overflow-hidden"
              >
                {/* Template Header */}
                <div className="bg-gray-50 px-6 py-4 border-b">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{template.name}</h3>
                      <p className="text-gray-600 capitalize">{template.type} template</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500">Progress</p>
                      <div className="flex items-center space-x-2">
                        <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${progress.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium text-gray-700">
                          {progress.filled}/{progress.total}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Photo Slots Grid */}
                <div className="p-6">
                  <div className={`grid gap-4 ${
                    template.type === 'solo' || template.type === 'photocard' 
                      ? 'grid-cols-1' 
                      : template.type === 'collage' 
                        ? 'grid-cols-2' 
                        : 'grid-cols-1'
                  }`}>
                    {template.photoSlots.map((slot, slotIndex) => (
                      <motion.div
                        key={slot.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + slotIndex * 0.05 }}
                        className="relative group"
                      >
                        <div
                          onClick={() => handleSlotClick(template, slot)}
                          className={`
                            relative overflow-hidden rounded-lg border-2 transition-all duration-200 cursor-pointer
                            ${slot.photo 
                              ? 'border-green-400 bg-green-50 hover:border-green-500' 
                              : 'border-dashed border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50'
                            }
                            ${template.type === 'photostrip' ? 'aspect-[3/4]' : 'aspect-[4/3]'}
                            min-h-[120px]
                          `}
                        >
                          {slot.photo ? (
                            <>
                              {/* Photo Preview */}
                              <img
                                src={slot.photo.thumbnailUrl}
                                alt={slot.photo.name}
                                className="w-full h-full object-cover"
                                style={{
                                  transform: slot.photoTransform 
                                    ? `scale(${slot.photoTransform.scale}) translate(${slot.photoTransform.offsetX}px, ${slot.photoTransform.offsetY}px)`
                                    : 'none'
                                }}
                              />
                              
                              {/* Remove button */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRemovePhoto(template, slot);
                                }}
                                className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </button>

                              {/* Edit indicator */}
                              <div className="absolute bottom-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded flex items-center space-x-1">
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                                <span>Edit</span>
                              </div>
                            </>
                          ) : (
                            /* Empty slot */
                            <div className="flex flex-col items-center justify-center h-full text-gray-400">
                              <svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <p className="text-sm font-medium">Tap to add photo</p>
                              <p className="text-xs">{slot.label}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <button
            onClick={handleContinue}
            disabled={templates.some(template => 
              template.photoSlots.some(slot => !slot.photo)
            )}
            className="btn-primary text-lg px-12 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue to Preview
          </button>
        </motion.div>
      </div>

      {/* Photo Cropper Modal */}
      {showPhotoCropper && selectedSlot && (
        <PhotoCropper
          photos={availablePhotos}
          selectedSlot={selectedSlot}
          onPhotoSelect={handlePhotoSelect}
          onClose={() => {
            setShowPhotoCropper(false);
            setSelectedSlot(null);
            setSelectedPhotoSlot(null);
          }}
        />
      )}
    </div>
  );
} 