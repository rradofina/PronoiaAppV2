import React from 'react';
import { TemplateSlot, Photo, Package, GoogleAuth } from '../../types';

import { TemplateVisual } from '../../pages/index'; // Assuming it's exported

interface ReviewScreenProps {
  clientName: string;
  selectedPackage: Package | null;
  googleAuth: GoogleAuth;
  templateSlots: TemplateSlot[];
  photos: Photo[];
  handleBack: () => void;
  handleExport: () => void;
  TemplateVisual: React.FC<any>;
}

export default function ReviewScreen({
  clientName,
  selectedPackage,
  googleAuth,
  templateSlots,
  photos,
  handleBack,
  handleExport,
  TemplateVisual,
}: ReviewScreenProps) {
  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-white shadow-sm p-4 flex-shrink-0">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-800 mb-1">
            Review Your Prints
          </h1>
          <p className="text-gray-600">
            Final check for {clientName}'s selection
          </p>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {Object.values(
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
          ).map(({ templateId, templateName, slots }) => (
            <div key={templateId} className="bg-white rounded-lg shadow-md p-4">
              <h3 className="font-semibold mb-2 text-center">{templateName}</h3>
              <TemplateVisual
                template={{ id: templateId.split('_')[0], name: templateName, slots: slots.length }}
                slots={slots}
                onSlotClick={() => {}} // Read-only in review
                photos={photos}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-white shadow-lg p-4 flex-shrink-0">
        <div className="flex justify-between items-center">
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50"
          >
            ← Edit Selections
          </button>
          <button
            onClick={handleExport}
            className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium text-lg hover:bg-blue-700"
          >
            Export to Drive
          </button>
        </div>
      </div>
    </div>
  );
} 