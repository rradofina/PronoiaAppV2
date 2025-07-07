import { Package, TemplateType, GoogleAuth, TemplateTypeInfo } from '../../types';

interface TemplateSelectionScreenProps {
  selectedPackage: Package | null;
  clientName: string;
  googleAuth: GoogleAuth;
  templateTypes: TemplateTypeInfo[];
  templateCounts: Record<string, number>;
  getTotalTemplateCount: () => number;
  handleTemplateCountChange: (templateId: string, change: number) => void;
  handleBack: () => void;
  handleTemplateContinue: () => void;
}

export default function TemplateSelectionScreen({
  selectedPackage,
  clientName,
  googleAuth,
  templateTypes,
  templateCounts,
  getTotalTemplateCount,
  handleTemplateCountChange,
  handleBack,
  handleTemplateContinue,
}: TemplateSelectionScreenProps) {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Print Selection
          </h1>
          <p className="text-gray-600 text-lg">
            Choose up to {selectedPackage?.templateCount} print types for {clientName}
          </p>
          <div className="mt-2 text-sm text-blue-600">
            {selectedPackage?.name} • ₱{selectedPackage?.price}
            {googleAuth.userEmail === 'demo@example.com' && <span className="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">DEMO MODE</span>}
          </div>
        </div>

        {/* Progress Info */}
        <div className="bg-white rounded-lg p-4 mb-6 shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">
              Prints Selected: {getTotalTemplateCount()} / {selectedPackage?.templateCount}
            </span>
            <div className="w-48 bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(getTotalTemplateCount() / (selectedPackage?.templateCount || 1)) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Print Types */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {templateTypes.map((template) => {
            const count = templateCounts[template.id] || 0;
            const totalCount = getTotalTemplateCount();
            const canIncrease = totalCount < (selectedPackage?.templateCount || 0);

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
                    {template.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">
                    {template.name}
                  </h3>
                  <p className="text-gray-600 mb-3">
                    {template.description}
                  </p>
                  <p className="text-sm text-gray-500 italic mb-4">
                    {template.preview}
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
                  const template = templateTypes.find(t => t.id === templateId);
                  return (
                    <div key={templateId} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                      {template?.name}: {count}
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