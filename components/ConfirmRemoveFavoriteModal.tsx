import React, { Fragment, useState, useEffect } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Photo, TemplateSlot } from '../types';
import { manualTemplateService } from '../services/manualTemplateService';
import PngTemplateVisual from './PngTemplateVisual';

interface TemplatePreview {
  templateId: string;
  templateName: string;
  template: any; // Full template data for rendering
  slots: TemplateSlot[]; // Slots specific to this template
}

interface ConfirmRemoveFavoriteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  photo: Photo | null;
  templateSlots: TemplateSlot[];
  photos: Photo[]; // All photos for rendering templates
}

export default function ConfirmRemoveFavoriteModal({
  isOpen,
  onClose,
  onConfirm,
  photo,
  templateSlots,
  photos
}: ConfirmRemoveFavoriteModalProps) {
  const [templatePreviews, setTemplatePreviews] = useState<TemplatePreview[]>([]);
  const [loading, setLoading] = useState(true);

  // Find all templates that contain this photo
  const templatesWithPhoto = React.useMemo(() => {
    if (!photo) return [];
    
    const photoTemplateIds = new Set<string>();
    templateSlots.forEach(slot => {
      if (slot.photoId === photo.id) {
        photoTemplateIds.add(slot.templateId);
      }
    });
    
    return Array.from(photoTemplateIds).map(templateId => {
      const slot = templateSlots.find(s => s.templateId === templateId);
      return {
        templateId,
        templateName: slot?.templateName || 'Unknown Template'
      };
    });
  }, [photo, templateSlots]);

  // Load template previews when modal opens
  useEffect(() => {
    const loadTemplatePreviews = async () => {
      if (!isOpen || templatesWithPhoto.length === 0) {
        setTemplatePreviews([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        // Get window templates (from package) first
        const windowTemplates = (window as any).pngTemplates || [];
        
        // If window templates don't have what we need, fall back to database
        let allTemplates = windowTemplates;
        if (windowTemplates.length === 0) {
          const dbTemplates = await manualTemplateService.getActiveTemplates();
          allTemplates = dbTemplates.map(template => ({
            ...template,
            holes: template.holes_data,
            driveFileId: template.drive_file_id
          }));
        }

        const previews: TemplatePreview[] = templatesWithPhoto.map(({ templateId, templateName }) => {
          // Find template by ID in available templates
          const template = allTemplates.find((t: any) => 
            t.id === templateId || 
            t.id.toString() === templateId ||
            templateId.startsWith(t.id.toString())
          );

          // Get all slots that belong to this template
          const templateSlotsList = templateSlots.filter(slot => slot.templateId === templateId);

          return {
            templateId,
            templateName,
            template: template ? {
              ...template,
              holes: template.holes_data || template.holes,
              driveFileId: template.drive_file_id || template.driveFileId
            } : null,
            slots: templateSlotsList
          };
        });

        setTemplatePreviews(previews);
      } catch (error) {
        console.error('Failed to load template previews:', error);
        setTemplatePreviews(templatesWithPhoto.map(({ templateId, templateName }) => ({
          templateId,
          templateName,
          template: null,
          slots: templateSlots.filter(slot => slot.templateId === templateId)
        })));
      } finally {
        setLoading(false);
      }
    };

    loadTemplatePreviews();
  }, [isOpen, templatesWithPhoto]);

  // Calculate dynamic thumbnail size based on number of templates
  const calculateThumbnailSize = (templateCount: number) => {
    if (templateCount === 0) return 80;
    
    const maxSize = 80;
    const minSize = 40;
    const availableWidth = 280; // Modal content width
    
    // Dynamic sizing - divide available space by count with gap consideration
    const calculatedSize = Math.floor((availableWidth - (templateCount - 1) * 8) / templateCount);
    
    // Clamp between min and max
    return Math.max(minSize, Math.min(maxSize, calculatedSize));
  };

  const thumbnailSize = calculateThumbnailSize(templatePreviews.length);

  if (!photo) return null;

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 mb-4"
                >
                  Remove from Favorites?
                </Dialog.Title>

                {/* Photo Preview */}
                <div className="flex justify-center mb-4">
                  <div className="w-24 h-32 rounded-lg overflow-hidden border-2 border-gray-200">
                    <img
                      src={photo.thumbnailUrl || photo.url}
                      alt={photo.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Message */}
                <div className="mb-4">
                  {templatePreviews.length > 0 ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-3">
                        This photo will remain in your template{templatePreviews.length > 1 ? 's' : ''}:
                      </p>
                      
                      {loading ? (
                        <div className="flex justify-center py-4">
                          <div className="animate-spin w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                        </div>
                      ) : (
                        <div 
                          className="flex flex-wrap justify-center gap-2 max-h-40 overflow-y-auto p-2 bg-gray-50 rounded-lg"
                        >
                          {templatePreviews.map((templatePreview) => (
                            <div key={templatePreview.templateId} className="flex flex-col items-center">
                              <div 
                                className="rounded border border-gray-300 overflow-hidden bg-white shadow-sm"
                                style={{ 
                                  width: `${thumbnailSize}px`, 
                                  height: `${Math.floor(thumbnailSize * 1.4)}px` 
                                }}
                              >
                                {templatePreview.template && templatePreview.slots.length > 0 ? (
                                  <div className="w-full h-full relative">
                                    <PngTemplateVisual
                                      pngTemplate={templatePreview.template}
                                      templateSlots={templatePreview.slots}
                                      onSlotClick={() => {}} // No-op for thumbnails
                                      photos={photos}
                                      selectedSlot={null}
                                      isActiveTemplate={false} // Disable interactions
                                    />
                                  </div>
                                ) : (
                                  <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs">
                                    Template
                                  </div>
                                )}
                              </div>
                              <span className="text-xs text-gray-600 mt-1 text-center max-w-full truncate">
                                {templatePreview.templateName.length > 12 
                                  ? `${templatePreview.templateName.substring(0, 12)}...` 
                                  : templatePreview.templateName}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <p className="text-sm text-gray-500 mt-3">
                        Only removing from your favorites list.
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-600">
                      This will remove the photo from your favorites list.
                    </p>
                  )}
                </div>

                <div className="flex space-x-3 justify-end mt-6">
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-500 focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="inline-flex justify-center rounded-md border border-transparent px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
                    onClick={() => {
                      onConfirm();
                      onClose();
                    }}
                  >
                    Remove from Favorites
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}