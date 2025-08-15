import { TemplateSlot, Photo } from '../types';

interface TemplateSelectorProps {
  templateSlots: TemplateSlot[];
  photos: Photo[];
  selectedPhoto: Photo;
  onTemplateSelect: (templateId: string) => void;
  onClose: () => void;
  isVisible: boolean;
}

export default function TemplateSelector({
  templateSlots,
  photos,
  selectedPhoto,
  onTemplateSelect,
  onClose,
  isVisible
}: TemplateSelectorProps) {
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
    <div className="fixed inset-0 z-50 bg-black bg-opacity-95 flex flex-col">
      {/* DEV-DEBUG-OVERLAY: Screen identifier - REMOVE BEFORE PRODUCTION */}
      {/* <div className="fixed bottom-2 left-2 z-50 bg-red-600 text-white px-2 py-1 text-xs font-mono rounded shadow-lg pointer-events-none">
        TemplateSelector.tsx
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
        
        <h3 className="font-medium">Choose Print Template</h3>
        
        <div className="w-16" /> {/* Spacer */}
      </div>

      {/* Selected Photo Preview */}
      <div className="p-4 border-b border-gray-600">
        <div className="flex items-center space-x-3">
          <img
            src={selectedPhoto.thumbnailUrl ? selectedPhoto.thumbnailUrl.replace('=s220', '=s400') : selectedPhoto.url}
            alt={selectedPhoto.name}
            className="w-12 h-12 object-cover rounded"
          />
          <div className="text-white">
            <p className="font-medium">{selectedPhoto.name}</p>
            <p className="text-sm text-gray-300">Select where to place this photo</p>
          </div>
        </div>
      </div>

      {/* Template Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {templates.map(({ templateId, templateName, templateType, slots }) => {
            const filledSlots = getFilledSlots(slots);
            const totalSlots = slots.length;
            
            return (
              <button
                key={templateId}
                onClick={() => onTemplateSelect(templateId)}
                className="bg-gray-800 rounded-lg p-4 text-left hover:bg-gray-700 transition-colors"
              >
                <div className="aspect-[2/3] bg-gray-700 rounded mb-3 flex items-center justify-center">
                  <span className="text-gray-400 text-sm">Template Preview</span>
                </div>
                
                <h4 className="text-white font-medium mb-1">{templateName}</h4>
                <p className="text-gray-400 text-sm mb-2">
                  {templateType.charAt(0).toUpperCase() + templateType.slice(1)} Template
                </p>
                
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">
                    {filledSlots}/{totalSlots} filled
                  </span>
                  <div className="flex space-x-1">
                    {Array.from({ length: totalSlots }, (_, i) => (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full ${
                          i < filledSlots ? 'bg-green-500' : 'bg-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}