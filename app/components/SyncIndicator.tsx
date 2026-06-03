'use client';

import { useState, useEffect } from 'react';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { RefreshCw, CheckCircle, AlertCircle, Clock, Wifi, WifiOff, PauseCircle } from 'lucide-react';

export default function SyncIndicator() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const [isResuming, setIsResuming] = useState(false);

  const {
    syncStatus,
    isSyncing,
    lastSyncTime,
    timeSinceLastSync,
    error,
    stats,
    triggerSync,
    resume,
    isOnline,
    supabaseStatus
  } = useSyncStatus();

  const healthLabels: Record<string, string> = {
    fully_synced: 'Fully synced',
    recovered_retry: 'Recovered retry',
    skipped_old_local_sale: 'Old local sale skipped',
    skipped_orphan: 'Orphan skipped',
    insufficient_stock_skipped: 'Insufficient stock skipped',
    local_cache_needs_refresh: 'Refresh local cache',
    real_failure: 'Real failure',
    paused: 'Paused'
  };

  const handleResume = async () => {
    setIsResuming(true);
    try {
      const success = await resume();
      if (!success) {
        // Still 503, notify user it's taking time
        console.log('Project still waking up...');
      }
    } finally {
      setIsResuming(false);
    }
  };

  // Only render on client side
  if (!isClient) {
    return null;
  }

  const getStatusIcon = () => {
    if (!isOnline) {
      return <WifiOff className="w-4 h-4" />;
    }

    if (supabaseStatus === 'paused') {
      return isResuming ? <RefreshCw className="w-4 h-4 animate-spin text-orange-500" /> : <PauseCircle className="w-4 h-4 text-orange-500" />;
    }

    if (isSyncing) {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }

    switch (syncStatus) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'idle':
        return <Clock className="w-4 h-4 text-gray-500" />;
      default:
        return <RefreshCw className="w-4 h-4" />;
    }
  };

  const getStatusText = () => {
    if (!isOnline) {
      return 'Offline';
    }

    if (supabaseStatus === 'paused') {
      return isResuming ? 'Waking up...' : 'Project Paused';
    }

    if (isSyncing) {
      return 'Syncing...';
    }

    if (stats.isQueued) {
      return 'Sync queued';
    }

    switch (syncStatus) {
      case 'success':
        if (stats.syncHealth && stats.syncHealth !== 'fully_synced') {
          return healthLabels[stats.syncHealth] || 'Synced with notes';
        }
        return timeSinceLastSync ? `Fully synced ${timeSinceLastSync}` : 'Fully synced';
      case 'error':
        return healthLabels[stats.syncHealth] || 'Sync failed';
      case 'idle':
        return 'Not synced';
      default:
        return 'Ready';
    }
  };

  const getStatusColor = () => {
    if (!isOnline) {
      return 'bg-gray-500';
    }

    if (supabaseStatus === 'paused') {
      return 'bg-orange-500';
    }

    if (isSyncing) {
      return 'bg-blue-500';
    }

    switch (syncStatus) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'idle':
        return 'bg-gray-500';
      default:
        return 'bg-blue-500';
    }
  };

  return (
    <div className="fixed bottom-4 left-4 z-40">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 min-w-[200px]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-full ${getStatusColor()} bg-opacity-10`}>
              {getStatusIcon()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {getStatusText()}
              </p>
              {error && (
                <p className="text-xs text-red-600 mt-0.5 line-clamp-1">
                  {error}
                </p>
              )}
              {lastSyncTime && !error && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {stats.totalSynced} synced
                  {stats.totalSkipped > 0 && `, ${stats.totalSkipped} skipped`}
                  {stats.totalRecovered > 0 && `, ${stats.totalRecovered} recovered`}
                </p>
              )}
              {!error && stats.details && stats.details.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                  {stats.details[0].replace(/_/g, ' ').replace(':', ': ')}
                </p>
              )}
            </div>
          </div>

          {isOnline && !isSyncing && supabaseStatus !== 'paused' && (
            <button
              onClick={triggerSync}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Sync now"
            >
              <RefreshCw className="w-4 h-4 text-gray-600" />
            </button>
          )}

          {isOnline && supabaseStatus === 'paused' && (
            <button
              onClick={handleResume}
              disabled={isResuming}
              className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 disabled:opacity-50 text-orange-700 rounded-lg transition-colors flex items-center gap-1.5 text-xs font-bold border border-orange-200"
              title="Resume Supabase Project"
            >
              <RefreshCw className={`w-3 h-3 ${isResuming ? 'animate-spin' : ''}`} />
              {isResuming ? 'WAKING UP...' : 'RESUME'}
            </button>
          )}
        </div>

        {/* Sync progress indicator */}
        {isSyncing && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-500 h-full rounded-full animate-pulse w-3/4" />
              </div>
              <span className="text-xs text-gray-500">Syncing</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
