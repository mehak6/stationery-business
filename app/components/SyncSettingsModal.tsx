'use client';

import { useState, useEffect } from 'react';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { X, Settings, RefreshCw } from 'lucide-react';

interface SyncSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SyncSettingsModal({ isOpen, onClose }: SyncSettingsModalProps) {
  const { syncConfig, updateConfig, lastSyncResult, stats, triggerSync, forceSync } = useSyncStatus();

  const [autoSync, setAutoSync] = useState(true);
  const [syncInterval, setSyncInterval] = useState(5);
  const [retryAttempts, setRetryAttempts] = useState(3);
  const [enableBackgroundSync, setEnableBackgroundSync] = useState(true);

  useEffect(() => {
    if (syncConfig) {
      setAutoSync(syncConfig.autoSync);
      setSyncInterval(syncConfig.syncInterval / 60000); // Convert to minutes
      setRetryAttempts(syncConfig.retryAttempts);
      setEnableBackgroundSync(syncConfig.enableBackgroundSync);
    }
  }, [syncConfig]);

  const handleSave = () => {
    updateConfig({
      autoSync,
      syncInterval: syncInterval * 60000, // Convert to milliseconds
      retryAttempts,
      enableBackgroundSync
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Sync Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Last Sync Info */}
          {lastSyncResult && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <h3 className="text-sm font-medium text-gray-700">Last Sync</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-gray-500">Status</p>
                  <p className="font-medium capitalize">{lastSyncResult.status}</p>
                </div>
                <div>
                  <p className="text-gray-500">Duration</p>
                  <p className="font-medium">{lastSyncResult.duration}ms</p>
                </div>
                <div>
                  <p className="text-gray-500">Items Synced</p>
                  <p className="font-medium">{lastSyncResult.totalSynced}</p>
                </div>
                <div>
                  <p className="text-gray-500">Errors</p>
                  <p className="font-medium">{lastSyncResult.totalErrors}</p>
                </div>
                <div>
                  <p className="text-gray-500">Skipped</p>
                  <p className="font-medium">{lastSyncResult.totalSkipped || 0}</p>
                </div>
                <div>
                  <p className="text-gray-500">Recovered</p>
                  <p className="font-medium">{lastSyncResult.totalRecovered || 0}</p>
                </div>
              </div>

              {/* Detailed Stats */}
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-1">
                <p className="text-xs font-medium text-gray-700">Sync Details</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div>Products: {lastSyncResult.stats.products.push}↑ {lastSyncResult.stats.products.pull}↓</div>
                  <div>Sales: {lastSyncResult.stats.sales.push}↑ {lastSyncResult.stats.sales.pull}↓</div>
                  <div>Categories: {lastSyncResult.stats.categories.push}↑ {lastSyncResult.stats.categories.pull}↓</div>
                  <div>Purchases: {lastSyncResult.stats.partyPurchases.push}↑ {lastSyncResult.stats.partyPurchases.pull}↓</div>
                </div>
              </div>
            </div>
          )}

          {/* Auto Sync */}
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Auto Sync</p>
                <p className="text-sm text-gray-500">Automatically sync data in the background</p>
              </div>
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              />
            </label>
          </div>

          {/* Sync Interval */}
          <div className="space-y-2">
            <label className="block">
              <p className="font-medium text-gray-900">Sync Interval</p>
              <p className="text-sm text-gray-500">How often to sync data automatically</p>
            </label>
            <select
              value={syncInterval}
              onChange={(e) => setSyncInterval(Number(e.target.value))}
              disabled={!autoSync}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value={1}>Every 1 minute</option>
              <option value={5}>Every 5 minutes</option>
              <option value={10}>Every 10 minutes</option>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every hour</option>
            </select>
          </div>

          {/* Retry Attempts */}
          <div className="space-y-2">
            <label className="block">
              <p className="font-medium text-gray-900">Retry Attempts</p>
              <p className="text-sm text-gray-500">Number of times to retry failed syncs</p>
            </label>
            <select
              value={retryAttempts}
              onChange={(e) => setRetryAttempts(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={0}>No retries</option>
              <option value={1}>1 retry</option>
              <option value={3}>3 retries</option>
              <option value={5}>5 retries</option>
              <option value={10}>10 retries</option>
            </select>
          </div>

          {/* Background Sync */}
          <div className="space-y-2">
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="font-medium text-gray-900">Background Sync</p>
                <p className="text-sm text-gray-500">Sync when app is in background (requires Service Worker)</p>
              </div>
              <input
                type="checkbox"
                checked={enableBackgroundSync}
                onChange={(e) => setEnableBackgroundSync(e.target.checked)}
                className="w-5 h-5 text-primary-600 rounded focus:ring-primary-500"
              />
            </label>
          </div>

          {/* Manual Sync Actions */}
          <div className="pt-4 border-t border-gray-200 space-y-2">
            <p className="text-sm font-medium text-gray-700">Manual Actions</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={triggerSync}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Sync Now
              </button>
              <button
                onClick={forceSync}
                className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Force Sync
              </button>
            </div>
            <p className="text-xs text-gray-500">
              Force sync will bypass all checks and attempt to sync immediately
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
