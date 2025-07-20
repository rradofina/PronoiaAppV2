import { useState, useEffect } from 'react';
import { Package, TemplateType, GoogleAuth, TemplateTypeInfo, PrintSize } from '../../types';
import { PngTemplate, pngTemplateService } from '../../services/pngTemplateService';

interface TemplateSelectionScreenProps {
  selectedPackage: Package | null;
  clientName: string;
  googleAuth: GoogleAuth;
  templateCounts: Record<string, number>;
  getTotalTemplateCount: () => number;
  handleTemplateCountChange: (templateId: string, change: number) => void;
  handleBack: () => void;
  handleTemplateContinue: () => void;
  totalAllowedPrints: number;
  currentPrintSize?: PrintSize; // Add print size selection
}

export default function TemplateSelectionScreen({
  selectedPackage,
  clientName,
  googleAuth,
  templateCounts,
  getTotalTemplateCount,
  handleTemplateCountChange,
  handleBack,
  handleTemplateContinue,
  totalAllowedPrints,
  currentPrintSize = '4R', // Default to 4R for now
}: TemplateSelectionScreenProps) {
  const [pngTemplates, setPngTemplates] = useState<PngTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPngTemplates();
  }, [currentPrintSize]);

  const loadPngTemplates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      // Force refresh templates to see new naming logic
      const allTemplates = await pngTemplateService.loadTemplates(true); // Force refresh
      const filteredTemplates = allTemplates.filter(t => t.printSize === currentPrintSize);
      
      setPngTemplates(filteredTemplates);
      console.log(`📐 Loaded ${filteredTemplates.length} ${currentPrintSize} templates`);
    } catch (error: any) {
      console.error('Error loading PNG templates:', error);
      setError(error.message || 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Print Selection
          </h1>
          <p className="text-gray-600 text-lg">
            Choose up to {totalAllowedPrints} print types for {clientName}
          </p>
          <div className="mt-2 text-sm text-blue-600">
            {selectedPackage?.name} • ₱{selectedPackage?.price}
            {totalAllowedPrints > (selectedPackage?.templateCount || 0) && (
              <span className="ml-2 text-green-600">+ {totalAllowedPrints - (selectedPackage?.templateCount || 0)} additional</span>
            )}
          </div>
        </div>

        {/* Progress Info */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">
              Prints Selected: {getTotalTemplateCount()} / {totalAllowedPrints}
            </span>
            <div className="w-48 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(getTotalTemplateCount() / (totalAllowedPrints || 1)) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="text-center py-12">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-600">Loading {currentPrintSize} templates...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6 text-center">
            <p className="text-red-600 font-medium mb-2">Failed to load templates</p>
            <p className="text-red-500 text-sm mb-4">{error}</p>
            <button
              onClick={loadPngTemplates}
              className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        )}

        {/* PNG Templates */}
        {!isLoading && !error && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {pngTemplates.map((template) => {
              const count = templateCounts[template.id] || 0;
              const totalCount = getTotalTemplateCount();
              const canIncrease = totalCount < totalAllowedPrints;

              // Icon mapping for template types
              const getTemplateIcon = (type: string) => {
                const icons: Record<string, string> = {
                  'solo': '🖼️',
                  'collage': '🏁',
                  'photocard': '🎴',
                  'photostrip': '📸'
                };
                return icons[type] || '🖼️';
              };

              return (
                <div
                  key={template.id}
                  className={`bg-white rounded-lg p-6 transition-all duration-200 shadow-sm ${
                    count > 0
                      ? 'ring-2 ring-green-500 bg-green-50'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-4xl mb-3">
                      {getTemplateIcon(template.templateType)}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">
                      {template.name}
                    </h3>
                    <p className="text-gray-600 mb-3">
                      {template.holes.length} photo{template.holes.length !== 1 ? 's' : ''} • {template.printSize}
                    </p>
                    <p className="text-sm text-gray-500 italic mb-4">
                      {template.templateType.charAt(0).toUpperCase() + template.templateType.slice(1)} style template
                    </p>

                    {/* Counter Controls */}
                    <div className="flex items-center justify-center space-x-4">
                      <button
                        onClick={() => handleTemplateCountChange(template.id, -1)}
                        disabled={count === 0}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                          count === 0
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-red-500 text-white hover:bg-red-600 active:scale-95'
                        }`}
                      >
                        −
                      </button>

                      <div className="min-w-[60px] text-center">
                        <div className="text-2xl font-bold text-gray-800">{count}</div>
                        <div className="text-xs text-gray-500">prints</div>
                      </div>

                      <button
                        onClick={() => handleTemplateCountChange(template.id, 1)}
                        disabled={!canIncrease}
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-xl font-bold transition-all duration-200 ${
                          !canIncrease
                            ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                            : 'bg-green-500 text-white hover:bg-green-600 active:scale-95'
                        }`}
                      >
                        +
                      </button>
                    </div>

                    {count > 0 && (
                      <div className="mt-3 text-green-600 font-medium">
                        ✓ {count} selected
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* No Templates Message */}
        {!isLoading && !error && pngTemplates.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 text-4xl mb-4">📐</div>
            <p className="text-gray-600 font-medium mb-2">No {currentPrintSize} templates available</p>
            <p className="text-gray-500 text-sm">Add PNG templates to your Google Drive folder to get started</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex justify-between">
          <button
            onClick={handleBack}
            className="px-6 py-3 rounded-lg font-medium text-gray-600 bg-white border border-gray-300 hover:bg-gray-50 transition-all duration-200"
          >
            ← Back to Packages
          </button>
          <button
            onClick={handleTemplateContinue}
            disabled={getTotalTemplateCount() === 0}
            className={`px-8 py-3 rounded-lg font-medium text-lg transition-all duration-200 ${
              getTotalTemplateCount() > 0
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Continue to Photo Selection
          </button>
        </div>

        {/* Selected Prints Info */}
        {getTotalTemplateCount() > 0 && (
          <div className="mt-6 text-center">
            <p className="text-gray-600 mb-2">
              <span className="font-medium text-gray-800">Selected Prints Summary:</span>
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              {Object.entries(templateCounts).map(([templateId, count]) => {
                if (count > 0) {
                  const template = pngTemplates.find(t => t.id === templateId);
                  return (
                    <div key={templateId} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {template?.name || 'Template'}: {count}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 