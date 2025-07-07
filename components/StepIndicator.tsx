// Updated: Step indicator component
import { motion } from 'framer-motion';

export default function StepIndicator({ currentStep }: { currentStep: string }) {
  const steps = [
    { id: 'package', label: 'Package' },
    { id: 'template', label: 'Templates' },
    { id: 'photos', label: 'Photos' },
    { id: 'preview', label: 'Preview' },
    { id: 'complete', label: 'Complete' },
  ];

  const currentIndex = steps.findIndex(step => step.id === currentStep);

  return (
    <div className="flex items-center justify-center space-x-4">
      {steps.map((step, index) => (
        <div key={step.id} className="flex items-center">
          <div
            className={`step-indicator ${
              index < currentIndex ? 'completed' : 
              index === currentIndex ? 'current' : 'pending'
            }`}
          >
            {index < currentIndex ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            ) : (
              index + 1
            )}
          </div>
          <span className="ml-2 text-sm font-medium text-gray-600 hidden sm:block">
            {step.label}
          </span>
          {index < steps.length - 1 && (
            <div className="w-8 h-px bg-gray-300 ml-4"></div>
          )}
        </div>
      ))}
    </div>
  );
} 