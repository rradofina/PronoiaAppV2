import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

// Store and Utils
import useAppStore from '../stores/useAppStore';
import { TEMPLATE_LAYOUTS, TEMPLATE_DESCRIPTIONS } from '../utils/constants';

// Types
import { TemplateType } from '../types';

export default function TemplateSelection() {
  const { 
    session,
    templates,
    addTemplate,
    removeTemplate,
    canAddTemplate,
    getRemainingTemplates,
    nextStep
  } = useAppStore();

  const [selectedTypes, setSelectedTypes] = useState<TemplateType[]>([]);

  useEffect(() => {
    // Initialize with existing templates
    setSelectedTypes(templates.map(t => t.type));
  }, [templates]);

  const handleTemplateToggle = (templateType: TemplateType) => {
    if (selectedTypes.includes(templateType)) {
      // Remove template
      const templateToRemove = templates.find(t => t.type === templateType);
      if (templateToRemove) {
        removeTemplate(templateToRemove.id);
        setSelectedTypes(prev => prev.filter(t => t !== templateType));
        toast.success(`${templateType} template removed`);
      }
    } else {
      // Add template
      if (canAddTemplate()) {
        addTemplate(templateType);
        setSelectedTypes(prev => [...prev, templateType]);
        toast.success(`${templateType} template added`);
      } else {
        toast.error('You have reached your template limit for this package');
      }
    }
  };

  const handleContinue = () => {
    if (templates.length === 0) {
      toast.error('Please select at least one template');
      return;
    }

    nextStep();
  };

  const getTemplatePreview = (templateType: TemplateType) => {
    const layout = TEMPLATE_LAYOUTS[templateType];
    const { count, arrangement } = layout.slots;

    return (
      <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
        <div className={`grid gap-1 ${
          templateType === 'solo' || templateType === 'photocard' 
            ? 'grid-cols-1' 
            : templateType === 'collage' 
              ? 'grid-cols-2' 
              : 'grid-cols-1'
        }`}>
          {Array.from({ length: Math.min(count, 6) }, (_, i) => (
            <div
              key={i}
              className={`bg-gray-300 rounded ${
                templateType === 'photostrip' 
                  ? 'w-8 h-4' 
                  : templateType === 'collage' 
                    ? 'w-6 h-6' 
                    : 'w-12 h-16'
              }`}
            />
          ))}
        </div>
      </div>
    );
  };

  if (!session) {
    return (
      <div className="container-tablet py-8 text-center">
        <p className="text-gray-600">No session found. Please go back and select a package.</p>
      </div>
    );
  }

  const templateTypes: TemplateType[] = ['solo', 'collage', 'photocard', 'photostrip'];

  return (
    <div className="container-tablet py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Select Template Types
        </h1>
        <p className="text-lg text-gray-600 mb-4">
          Choose up to {session.maxTemplates} template types for {session.clientName}
        </p>
        <div className="flex items-center justify-center space-x-4 text-sm text-gray-500">
          <span>📦 {session.packageType}</span>
          <span>•</span>
          <span>🎯 {templates.length} / {session.maxTemplates} selected</span>
          <span>•</span>
          <span>📋 {getRemainingTemplates()} remaining</span>
        </div>
      </motion.div>

      {/* Template Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {templateTypes.map((templateType, index) => {
          const isSelected = selectedTypes.includes(templateType);
          const isDisabled = !isSelected && !canAddTemplate();

          return (
            <motion.div
              key={templateType}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`
                relative bg-white rounded-xl shadow-lg overflow-hidden border-2 transition-all duration-200 cursor-pointer
                ${isSelected 
                  ? 'border-blue-500 ring-2 ring-blue-200' 
                  : isDisabled 
                    ? 'border-gray-200 opacity-50 cursor-not-allowed' 
                    : 'border-gray-200 hover:border-gray-300 hover:shadow-xl'
                }
              `}
              onClick={() => !isDisabled && handleTemplateToggle(templateType)}
              whileHover={!isDisabled ? { scale: 1.02 } : {}}
              whileTap={!isDisabled ? { scale: 0.98 } : {}}
            >
              {/* Selection Indicator */}
              {isSelected && (
                <div className="absolute top-4 right-4 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center z-10">
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}

              <div className="p-6">
                {/* Template Preview */}
                <div className="mb-4">
                  {getTemplatePreview(templateType)}
                </div>

                {/* Template Info */}
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 capitalize">
                    {templateType} Template
                  </h3>
                  <p className="text-gray-600 text-sm mb-3">
                    {TEMPLATE_DESCRIPTIONS[templateType]}
                  </p>

                  {/* Template Details */}
                  <div className="flex items-center justify-center space-x-4 text-xs text-gray-500">
                    <span>📐 {TEMPLATE_LAYOUTS[templateType].slots.count} photos</span>
                    <span>•</span>
                    <span>📏 4R size</span>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="px-6 pb-6">
                <button
                  className={`
                    w-full py-2 px-4 rounded-lg font-medium transition-all duration-200
                    ${isSelected 
                      ? 'bg-red-100 text-red-700 hover:bg-red-200' 
                      : isDisabled 
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }
                  `}
                  disabled={isDisabled}
                >
                  {isSelected ? 'Remove Template' : isDisabled ? 'Limit Reached' : 'Add Template'}
                </button>
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
        className="text-center"
      >
        <button
          onClick={handleContinue}
          disabled={templates.length === 0}
          className="btn-primary text-lg px-12 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue to Photo Selection ({templates.length} template{templates.length !== 1 ? 's' : ''})
        </button>
      </motion.div>
    </div>
  );
} 