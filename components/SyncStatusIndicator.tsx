import React from 'react';
import { SyncStatus } from '../services/templateSyncService';

interface SyncStatusIndicatorProps {
  status: SyncStatus | null;
  className?: string;
}

export default function SyncStatusIndicator({ status, className = '' }: SyncStatusIndicatorProps) {
  if (!status) return null;

  const getStatusContent = () => {
    switch (status) {
      case 'pending':
        return (
          <>
            <span className="text-yellow-600 transition-opacity duration-1000 opacity-70 hover:opacity-100">⏳</span>
            <span className="text-xs text-yellow-600 ml-1 transition-opacity duration-300">Pending</span>
          </>
        );
      case 'syncing':
        return (
          <>
            <span className="text-blue-600 transition-all duration-500 ease-in-out transform hover:scale-110" style={{
              animation: 'spin 2s linear infinite',
              animationDuration: '2s' // Slower than default Tailwind spin
            }}>🔄</span>
            <span className="text-xs text-blue-600 ml-1 transition-opacity duration-300">Saving...</span>
          </>
        );
      case 'synced':
        return (
          <>
            <span className="text-green-600 transition-all duration-300 transform hover:scale-110">✅</span>
            <span className="text-xs text-green-600 ml-1 transition-opacity duration-300">Saved</span>
          </>
        );
      case 'error':
        return (
          <>
            <span className="text-red-600 transition-all duration-300 transform hover:scale-110">❌</span>
            <span className="text-xs text-red-600 ml-1 transition-opacity duration-300">Error</span>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex items-center transition-all duration-300 ease-in-out ${className}`}>
      {getStatusContent()}
    </div>
  );
}