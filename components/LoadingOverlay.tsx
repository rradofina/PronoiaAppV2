// Updated: Loading overlay component
import { motion, AnimatePresence } from 'framer-motion';
import useAppStore from '../stores/useAppStore';

export default function LoadingOverlay() {
  const { loadingState } = useAppStore();

  return (
    <AnimatePresence>
      {loadingState.isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-xl p-8 shadow-xl max-w-sm w-full mx-4"
          >
            <div className="text-center">
              <div className="loading-spinner mb-4"></div>
              
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                {loadingState.message || 'Loading...'}
              </h3>
              
              {loadingState.progress !== undefined && (
                <div className="mt-4">
                  <div className="progress-bar">
                    <motion.div
                      className="progress-bar-fill"
                      initial={{ width: 0 }}
                      animate={{ width: `${loadingState.progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {Math.round(loadingState.progress)}% complete
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
} 