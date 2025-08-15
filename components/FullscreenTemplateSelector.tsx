import { useState } from 'react';
import { TemplateSlot, Photo } from '../types';

interface FullscreenTemplateSelectorProps {
  templateSlots: TemplateSlot[];
  selectedTemplateId: string;
  photos: Photo[];
  onSlotSelect: (slot: TemplateSlot) => void;
  onClose: () => void;
  isVisible: boolean;
  TemplateVisual: React.FC<any>;
}

export default function FullscreenTemplateSelector({
  templateSlots,
  selectedTemplateId,
  photos,
  onSlotSelect,
  onClose,
  isVisible,
  TemplateVisual
}: FullscreenTemplateSelectorProps) {
  if (!isVisible) return null;

  const templateGroup = templateSlots.filter(slot => slot.templateId === selectedTemplateId);
  const template = templateGroup[0];

  if (!template) return null;

  const getFilledSlots = () => templateGroup.filter(slot => slot.photoId).length;
  const totalSlots = templateGroup.length;

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col">
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      {/* <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        FullscreenTemplateSelector.tsx
      </div> */}
      {/* Header */}
      <div className="flex items-center justify-between p-4 text-white">
        <button
          onClick={onClose}
          className="flex items-center space-x-2 text-white hover:text-gray-300"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span>Back</span>
        </button>
        
        <div className="text-center">
          <h3 className="font-medium">{template.templateName}</h3>
          <p className="text-sm text-gray-300">{getFilledSlots()}/{totalSlots} filled</p>
        </div>
        
        <div className="w-16" /> {/* Spacer */}
      </div>

      {/* Instructions */}
      <div className="px-4 pb-4">
        <p className="text-center text-gray-300 text-sm">
          Tap a slot to add a photo
        </p>
      </div>

      {/* Template Display */}
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <TemplateVisual
            template={{ 
              id: template.templateType, 
              name: template.templateName, 
              slots: templateGroup.length 
            }}
            slots={templateGroup}
            photos={photos}
            selectedSlot={null}
            onSlotClick={(slot: TemplateSlot) => onSlotSelect(slot)}
          />
        </div>
      </div>

      {/* Slot Status */}
      <div className="p-4 bg-gray-900">
        <div className="flex items-center justify-center space-x-2">
          {templateGroup.map((slot, index) => (
            <div
              key={slot.id}
              className={`w-3 h-3 rounded-full ${
                slot.photoId ? 'bg-green-500' : 'bg-gray-600'
              }`}
              title={`Slot ${index + 1}${slot.photoId ? ' (filled)' : ' (empty)'}`}
            />
          ))}
        </div>
        <p className="text-center text-gray-400 text-xs mt-2">
          {totalSlots - getFilledSlots()} empty slots remaining
        </p>
      </div>
    </div>
  );
}