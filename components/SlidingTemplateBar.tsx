import { useState, useRef } from 'react';
import { TemplateSlot, Photo } from '../types';

interface SlidingTemplateBarProps {
  templateSlots: TemplateSlot[];
  selectedPhoto: Photo;
  photos: Photo[];
  onSlotSelect: (slot: TemplateSlot) => void;
  onClose: () => void;
  isVisible: boolean;
  TemplateVisual: React.FC<any>;
}

export default function SlidingTemplateBar({
  templateSlots,
  selectedPhoto,
  photos,
  onSlotSelect,
  onClose,
  isVisible,
  TemplateVisual
}: SlidingTemplateBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (!isVisible) return null;

  // Group slots by template
  const templateGroups = templateSlots.reduce((acc, slot) => {
    if (!acc[slot.templateId]) {
      acc[slot.templateId] = {
        templateId: slot.templateId,
        templateName: slot.templateName,
        templateType: slot.templateType,
        slots: [],
      };
    }
    acc[slot.templateId].slots.push(slot);
    return acc;
  }, {} as Record<string, { templateId: string; templateName: string; templateType: string; slots: TemplateSlot[] }>);

  const templates = Object.values(templateGroups);

  const getFilledSlots = (slots: TemplateSlot[]) => {
    return slots.filter(slot => slot.photoId).length;
  };

  return (
    <div 
      className={`fixed inset-0 z-40 transition-all duration-500 ease-out ${
        isVisible ? 'bg-black bg-opacity-50' : 'bg-transparent pointer-events-none'
      }`}
    >
      {/* Background overlay */}
      <div 
        className="absolute inset-0" 
        onClick={onClose}
      />
      
      {/* Sliding template bar */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl shadow-2xl transition-transform duration-500 ease-out ${
          isVisible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{ height: '50vh', minHeight: '400px' }}
      >
        {/* Handle bar */}
        <div className="w-full flex justify-center py-3 border-b border-gray-200">
          <div className="w-12 h-1 bg-gray-300 rounded-full"></div>
        </div>

        {/* Header with Large Photo Preview */}
        <div className="px-4 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-lg text-gray-800">Add to Print Template</h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          {/* Large Photo Preview */}
          <div className="flex items-center space-x-4">
            <div className="flex-shrink-0">
              <img
                src={selectedPhoto.thumbnailUrl ? selectedPhoto.thumbnailUrl.replace('=s220', '=s800') : selectedPhoto.url}
                alt={selectedPhoto.name}
                className="w-20 h-20 object-cover rounded-xl shadow-md border-2 border-white"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-800 truncate">{selectedPhoto.name}</p>
              <p className="text-sm text-gray-600 mt-1">Tap a placeholder below to add this photo</p>
              <div className="mt-2 flex items-center space-x-2">
                <div className="h-1 bg-blue-200 rounded-full flex-1">
                  <div className="h-1 bg-blue-500 rounded-full w-full"></div>
                </div>
                <span className="text-xs text-blue-600 font-medium">Ready to place</span>
              </div>
            </div>
          </div>
        </div>

        {/* Templates scroll area */}
        <div className="flex-1 overflow-hidden">
          <div 
            ref={scrollRef}
            className="flex space-x-4 overflow-x-auto h-full p-4 pb-6"
            style={{ scrollBehavior: 'smooth' }}
          >
            {templates.map(({ templateId, templateName, templateType, slots }) => {
              const filledSlots = getFilledSlots(slots);
              const totalSlots = slots.length;
              
              return (
                <div 
                  key={templateId} 
                  className="flex-shrink-0 bg-gray-50 rounded-xl p-4 border border-gray-200"
                  style={{ width: '280px' }}
                >
                  {/* Template info */}
                  <div className="mb-3">
                    <h4 className="font-semibold text-gray-800 text-center mb-1">{templateName}</h4>
                    <div className="flex items-center justify-center space-x-2 text-xs text-gray-500">
                      <span>{templateType.charAt(0).toUpperCase() + templateType.slice(1)}</span>
                      <span>•</span>
                      <span>{filledSlots}/{totalSlots} filled</span>
                    </div>
                  </div>

                  {/* Template preview */}
                  <div className="aspect-[2/3] bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 mb-3">
                    <TemplateVisual
                      template={{ 
                        id: templateType, 
                        name: templateName, 
                        slots: totalSlots 
                      }}
                      slots={slots}
                      photos={photos}
                      selectedSlot={null}
                      onSlotClick={(slot: TemplateSlot) => {
                        console.log('🎯 Slot clicked in SlidingTemplateBar:', slot);
                        onSlotSelect(slot);
                      }}
                    />
                  </div>

                  {/* Capacity indicator */}
                  <div className="flex justify-center space-x-1">
                    {Array.from({ length: totalSlots }, (_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < filledSlots ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Instructions */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <p className="text-center text-sm text-gray-600">
            Tap a placeholder to add this photo and adjust positioning
          </p>
        </div>
      </div>
    </div>
  );
}