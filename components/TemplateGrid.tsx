import React from 'react';
import { TemplateSlot, Photo } from '../types';

interface TemplateGridProps {
  templateSlots: TemplateSlot[];
  photos: Photo[];
  selectedSlot: TemplateSlot | null;
  onSlotClick: (slot: TemplateSlot) => void;
  onViewTemplate: (template: { templateId: string; templateName: string; slots: TemplateSlot[] }) => void;
  onSwapTemplate: (template: { templateId: string; templateName: string; slots: TemplateSlot[] }) => void;
  onDeleteTemplate?: (templateId: string) => void;
  TemplateVisual: React.ComponentType<any>;
  layout?: 'horizontal' | 'vertical' | 'main';
  showActions?: boolean;
}

export default function TemplateGrid({
  templateSlots,
  photos,
  selectedSlot,
  onSlotClick,
  onViewTemplate,
  onSwapTemplate,
  onDeleteTemplate,
  TemplateVisual,
  layout = 'horizontal',
  showActions = true
}: TemplateGridProps) {
  
  // Group slots by template
  const templateGroups = Object.values(
    templateSlots.reduce((acc, slot) => {
      if (!acc[slot.templateId]) {
        acc[slot.templateId] = {
          templateId: slot.templateId,
          templateName: slot.templateName,
          slots: [],
        };
      }
      acc[slot.templateId].slots.push(slot);
      return acc;
    }, {} as Record<string, { templateId: string; templateName: string; slots: TemplateSlot[] }>)
  );

  const containerClasses = layout === 'horizontal' 
    ? "flex space-x-2 sm:space-x-3 overflow-x-auto h-full pb-2" 
    : layout === 'main'
    ? "grid grid-cols-1 md:grid-cols-2 gap-6 p-4"
    : "space-y-2";

  const itemClasses = layout === 'horizontal' 
    ? "flex-shrink-0 relative pt-4" 
    : layout === 'main'
    ? "relative bg-white rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
    : "relative";

  const itemStyle = layout === 'horizontal' 
    ? { width: '180px' } 
    : {};

  const visualHeight = layout === 'horizontal' 
    ? undefined 
    : layout === 'main'
    ? { height: '500px' }
    : { height: '400px' };

  return (
    <div className={containerClasses} style={{ touchAction: layout === 'horizontal' ? 'pan-x' : 'auto' }}>
      {templateGroups.map(({ templateId, templateName, slots }) => (
        <div key={templateId} className={itemClasses} style={itemStyle}>
          {/* Action buttons */}
          {showActions && (
            <div className="absolute top-0 left-0 right-0 flex justify-end items-center z-30">
              <div className="flex space-x-1">
                <button
                  onClick={() => onViewTemplate({ templateId, templateName, slots })}
                  title="View Template"
                  className="bg-blue-600 text-white rounded-full p-1 shadow-lg hover:bg-blue-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`${layout === 'horizontal' ? 'h-3 w-3' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </button>
                <button
                  onClick={() => onSwapTemplate({ templateId, templateName, slots })}
                  title="Change Template"
                  className="bg-green-600 text-white rounded-full p-1 shadow-lg hover:bg-green-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className={`${layout === 'horizontal' ? 'h-3 w-3' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                </button>
                {/* Delete button (only for additional prints) */}
                {onDeleteTemplate && templateName.includes('(Additional)') && (
                  <button
                    onClick={() => onDeleteTemplate(templateId)}
                    title="Delete Print"
                    className="bg-red-600 text-white rounded-full p-1 shadow-lg hover:bg-red-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className={`${layout === 'horizontal' ? 'h-3 w-3' : 'h-4 w-4'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          )}
          
          <h3 className={`font-semibold mb-2 text-center leading-tight truncate px-1 relative z-20 ${
            layout === 'horizontal' ? 'text-xs' : 'text-sm'
          }`}>
            {templateName}
          </h3>
          
          <div className="w-full rounded-lg overflow-hidden border border-gray-200" style={visualHeight}>
            <TemplateVisual
              key={`template-${templateId}-type-${slots[0]?.templateType || 'unknown'}-name-${templateName.replace(/\s+/g, '-')}-slots-${slots.map(s => `${s.id}-${s.photoId || 'empty'}-${s.templateType || 'unknown'}`).join('|')}`}
              template={{ id: slots[0]?.templateType || templateId.split('_')[0], name: templateName, slots: slots.length }}
              slots={slots}
              onSlotClick={onSlotClick}
              photos={photos}
              selectedSlot={selectedSlot}
            />
          </div>
        </div>
      ))}
    </div>
  );
}