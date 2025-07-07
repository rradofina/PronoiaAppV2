// Updated: Package selection component
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import clsx from 'clsx';

// Store
import useAppStore from '../stores/useAppStore';

// Utils
import { PACKAGES } from '../utils/constants';

// Types
import { PhotoStudioPackage } from '../types';

// Components
import GoogleDriveSetup from './GoogleDriveSetup';
import SessionBrowser from './SessionBrowser';

interface PackageSelectionProps {
  onGoogleDriveConnect: () => Promise<void>;
}

export default function PackageSelection({ onGoogleDriveConnect }: PackageSelectionProps) {
  const { 
    googleDriveConnected, 
    mainSessionsFolder,
    selectPackage, 
    setLoading 
  } = useAppStore();

  const [selectedPackage, setSelectedPackage] = useState<PhotoStudioPackage['id'] | null>(null);
  const [clientName, setClientName] = useState('');
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [selectedSessionName, setSelectedSessionName] = useState('');
  const [showMainFolderSetup, setShowMainFolderSetup] = useState(false);

  const handlePackageSelect = (packageId: PhotoStudioPackage['id']) => {
    setSelectedPackage(packageId);
  };

  const handleContinue = async () => {
    if (!selectedPackage) {
      toast.error('Please select a package');
      return;
    }

    if (!clientName.trim()) {
      toast.error('Please enter client name');
      return;
    }

    if (!googleDriveConnected) {
      toast.error('Please connect to Google Drive first');
      return;
    }

    if (!selectedSessionId.trim()) {
      toast.error('Please select a session');
      return;
    }

    try {
      setLoading(true, 'Setting up session...');
      selectPackage(selectedPackage, clientName.trim(), selectedSessionId.trim());
      toast.success('Package selected successfully!');
    } catch (error) {
      console.error('Failed to select package:', error);
      toast.error('Failed to set up session');
    } finally {
      setLoading(false);
    }
  };

  const handleMainFolderSetupComplete = () => {
    setShowMainFolderSetup(false);
  };

  const handleSessionSelect = (sessionId: string, sessionName: string) => {
    setSelectedSessionId(sessionId);
    setSelectedSessionName(sessionName);
  };

  return (
    <div className="container-tablet py-8 h-full overflow-auto">
      <div className="max-w-4xl mx-auto">
        {/* Welcome Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome to Pronoia Photo Studio
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Create beautiful photo templates for your clients. 
            Select a package and connect to Google Drive to get started.
          </p>
        </motion.div>

        {/* Google Drive Connection */}
        {!googleDriveConnected && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8"
          >
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <svg className="w-12 h-12 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z"/>
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Connect to Google Drive
              </h3>
              <p className="text-gray-600 mb-4">
                Connect your Google Drive account to access client photos and save templates.
              </p>
              <button
                onClick={onGoogleDriveConnect}
                className="btn-primary"
              >
                Connect Google Drive
              </button>
            </div>
          </motion.div>
        )}

        {/* Client Information Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="card mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Client Information</h2>
          
          <div className="space-y-6">
            <div>
              <label htmlFor="clientName" className="block text-sm font-medium text-gray-700 mb-2">
                Client Name *
              </label>
              <input
                type="text"
                id="clientName"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Enter client name"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
                disabled={!googleDriveConnected}
              />
            </div>

            {googleDriveConnected && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Session Selection *
                </label>
                {!mainSessionsFolder ? (
                  <div className="space-y-2">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-sm text-yellow-700">
                        Set up your main Sessions folder first
                      </p>
                    </div>
                    <button
                      onClick={() => setShowMainFolderSetup(true)}
                      className="btn-secondary"
                    >
                      Setup Main Folder
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-700">
                        Main folder: {mainSessionsFolder.name}
                      </p>
                    </div>
                    <SessionBrowser onSessionSelect={handleSessionSelect} />
                    {selectedSessionName && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                        <p className="text-sm text-blue-700">
                          Selected session: {selectedSessionName}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>

        {/* Package Selection */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Package</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PACKAGES.map((pkg, index) => (
              <motion.div
                key={pkg.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className={clsx(
                  'package-card',
                  selectedPackage === pkg.id && 'selected',
                  !googleDriveConnected && 'opacity-50 cursor-not-allowed'
                )}
                onClick={() => googleDriveConnected && handlePackageSelect(pkg.id)}
              >
                <div className="text-4xl font-bold text-primary-600 mb-4">
                  {pkg.id}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  {pkg.name}
                </h3>
                <div className="text-3xl font-bold text-gray-900 mb-2">
                  {pkg.templateCount}
                  <span className="text-sm font-normal text-gray-600 ml-1">
                    template{pkg.templateCount !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-gray-600 text-sm">
                  {pkg.description}
                </p>
                
                {selectedPackage === pkg.id && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute top-4 right-4"
                  >
                    <div className="w-6 h-6 bg-primary-500 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Continue Button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center"
        >
          <button
            onClick={handleContinue}
            disabled={!selectedPackage || !clientName.trim() || !googleDriveConnected || !selectedSessionId.trim()}
            className="btn-primary text-lg px-12 py-4"
          >
            Continue to Templates
          </button>
        </motion.div>
      </div>

      {/* Main Folder Setup Modal */}
      {showMainFolderSetup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  Setup Main Sessions Folder
                </h2>
                <button
                  onClick={() => setShowMainFolderSetup(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <GoogleDriveSetup onComplete={handleMainFolderSetupComplete} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 