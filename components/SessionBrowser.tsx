// Updated: Session browser component
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { googleDriveService } from '../services/googleDriveService';
import useAppStore from '../stores/useAppStore';

interface SessionBrowserProps {
  onSessionSelect: (sessionId: string, sessionName: string) => void;
}

interface SessionFolder {
  id: string;
  name: string;
  mimeType: string;
  parents?: string[];
}

export default function SessionBrowser({ onSessionSelect }: SessionBrowserProps) {
  const { mainSessionsFolder } = useAppStore();
  const [sessionFolders, setSessionFolders] = useState<SessionFolder[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (mainSessionsFolder) {
      loadSessionFolders();
    }
  }, [mainSessionsFolder]);

  const loadSessionFolders = async () => {
    if (!mainSessionsFolder) return;

    setIsLoading(true);
    try {
      const folders = await googleDriveService.listFolders(mainSessionsFolder.id);
      setSessionFolders(folders);
    } catch (error) {
      console.error('Failed to load session folders:', error);
      toast.error('Failed to load session folders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSessionSelect = () => {
    if (!selectedSessionId) {
      toast.error('Please select a session');
      return;
    }

    const selectedSession = sessionFolders.find(f => f.id === selectedSessionId);
    if (!selectedSession) {
      toast.error('Selected session not found');
      return;
    }

    onSessionSelect(selectedSession.id, selectedSession.name);
  };

  if (!mainSessionsFolder) {
    return (
      <div className="text-center py-8">
        <div className="text-gray-500">
          No main Sessions folder configured
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Select Session
          </h3>
          <p className="text-sm text-gray-600">
            Choose from: {mainSessionsFolder.name}
          </p>
        </div>
        <button
          onClick={loadSessionFolders}
          disabled={isLoading}
          className="flex items-center space-x-2 text-blue-600 hover:text-blue-800 disabled:opacity-50"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Refresh</span>
        </button>
      </div>

      {isLoading ? (
        <div className="bg-white border rounded-lg p-8 text-center">
          <div className="animate-spin w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">Loading sessions...</p>
        </div>
      ) : sessionFolders.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
            </svg>
          </div>
          <p className="text-gray-500 mb-2">No sessions found</p>
          <p className="text-sm text-gray-400">
            Create session folders in "{mainSessionsFolder.name}" to see them here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Session list */}
          <div className="bg-white border rounded-lg max-h-96 overflow-y-auto">
            {sessionFolders.map((session) => (
              <div
                key={session.id}
                onClick={() => setSelectedSessionId(session.id)}
                className={`p-4 border-b last:border-b-0 cursor-pointer hover:bg-gray-50 transition-colors ${
                  selectedSessionId === session.id ? 'bg-blue-50 border-blue-200' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 0l-2 3H2v18h20V3h-8l-2-3z" />
                      </svg>
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {session.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      Session folder
                    </p>
                  </div>
                  {selectedSessionId === session.id && (
                    <div className="flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action button */}
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-600">
              {selectedSessionId 
                ? `Selected: ${sessionFolders.find(f => f.id === selectedSessionId)?.name}`
                : 'Select a session to continue'
              }
            </p>
            <button
              onClick={handleSessionSelect}
              disabled={!selectedSessionId}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Use This Session
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
} 