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
            <span className="animate-pulse text-yellow-600">⏳</span>
            <span className="text-xs text-yellow-600 ml-1">Pending</span>
          </>
        );
      case 'syncing':
        return (
          <>
            <span className="animate-spin inline-block text-blue-600">🔄</span>
            <span className="text-xs text-blue-600 ml-1">Saving...</span>
          </>
        );
      case 'synced':
        return (
          <>
            <span className="text-green-600">✅</span>
            <span className="text-xs text-green-600 ml-1">Saved</span>
          </>
        );
      case 'error':
        return (
          <>
            <span className="text-red-600">❌</span>
            <span className="text-xs text-red-600 ml-1">Error</span>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`flex items-center ${className}`}>
      {getStatusContent()}
    </div>
  );
}