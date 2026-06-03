'use client';

import { performFullSync } from './supabase-sync';
import { getSyncMetaDB } from './pouchdb-client';
import { checkSupabaseStatus } from './supabase-status';

export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error' | 'paused';
export type SyncHealth =
  | 'fully_synced'
  | 'recovered_retry'
  | 'skipped_old_local_sale'
  | 'skipped_orphan'
  | 'insufficient_stock_skipped'
  | 'local_cache_needs_refresh'
  | 'real_failure'
  | 'paused';

export interface SyncBucketStats {
  push: number;
  pull: number;
  errors: number;
  skipped?: number;
  recovered?: number;
  details?: string[];
}

export interface SyncResult {
  status: SyncStatus;
  health: SyncHealth;
  timestamp: string;
  stats: {
    products: SyncBucketStats;
    sales: SyncBucketStats;
    categories: SyncBucketStats;
    partyPurchases: SyncBucketStats;
  };
  totalSynced: number;
  totalErrors: number;
  totalSkipped: number;
  totalRecovered: number;
  details?: string[];
  duration: number;
  error?: string;
}

export interface SyncConfig {
  autoSync: boolean;
  syncInterval: number; // milliseconds
  retryAttempts: number;
  retryDelay: number; // milliseconds
  enableBackgroundSync: boolean;
}

// Default configuration
const DEFAULT_CONFIG: SyncConfig = {
  autoSync: true,
  syncInterval: 5 * 60 * 1000, // 5 minutes
  retryAttempts: 3,
  retryDelay: 5000, // 5 seconds
  enableBackgroundSync: true
};

// Sync manager state
let currentConfig: SyncConfig = { ...DEFAULT_CONFIG };
let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;
let lastSyncResult: SyncResult | null = null;
let syncListeners: Set<(result: SyncResult) => void> = new Set();

// Get sync configuration
export const getSyncConfig = (): SyncConfig => {
  return { ...currentConfig };
};

// Update sync configuration
export const updateSyncConfig = (config: Partial<SyncConfig>): void => {
  currentConfig = { ...currentConfig, ...config };

  // Restart auto-sync if needed
  if (currentConfig.autoSync) {
    startAutoSync();
  } else {
    stopAutoSync();
  }

  // Save config to IndexedDB
  saveSyncConfig(currentConfig);
};

interface SyncConfigDoc {
  _id: string;
  _rev?: string;
  config: SyncConfig;
  updated_at: string;
  created_at: string;
}

interface LastSyncResultDoc {
  _id: string;
  _rev?: string;
  result: SyncResult;
  updated_at: string;
  created_at: string;
}

interface SyncQueueDoc {
  _id: string;
  _rev?: string;
  queued: boolean;
  queued_at?: string;
  cleared_at?: string;
}

// Save config to IndexedDB
const saveSyncConfig = async (config: SyncConfig): Promise<void> => {
  try {
    const db = await getSyncMetaDB();

    const docId = 'sync_config';
    let doc: SyncConfigDoc;

    try {
      const existing = await db.get(docId) as SyncConfigDoc;
      doc = {
        ...existing,
        config,
        updated_at: new Date().toISOString()
      };
    } catch {
      doc = {
        _id: docId,
        config,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    await db.put(doc);
  } catch (err) {
    console.error('Error saving sync config:', err);
  }
};

// Load config from IndexedDB
export const loadSyncConfig = async (): Promise<SyncConfig> => {
  try {
    const db = await getSyncMetaDB();
    const doc = await db.get('sync_config') as SyncConfigDoc;
    return doc.config || DEFAULT_CONFIG;
  } catch {
    return DEFAULT_CONFIG;
  }
};

// Add sync listener
export const addSyncListener = (listener: (result: SyncResult) => void): void => {
  syncListeners.add(listener);
};

// Remove sync listener
export const removeSyncListener = (listener: (result: SyncResult) => void): void => {
  syncListeners.delete(listener);
};

// Notify all listeners
const notifyListeners = (result: SyncResult): void => {
  syncListeners.forEach(listener => {
    try {
      listener(result);
    } catch (err) {
      console.error('Error in sync listener:', err);
    }
  });
};

// Sleep helper for retry delays
const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Perform sync with retry logic
const syncWithRetry = async (
  attempt: number = 1
): Promise<SyncResult> => {
  const startTime = Date.now();

  try {
    // Check if Supabase is available
    const { checkSupabaseStatus } = await import('./supabase-status');
    const status = await checkSupabaseStatus();
    
    if (status === 'paused') {
      console.warn('Supabase project is paused. Skipping sync.');
      
      const duration = Date.now() - startTime;
      const result: SyncResult = {
        status: 'paused',
        health: 'paused',
        timestamp: new Date().toISOString(),
        stats: {
          products: { push: 0, pull: 0, errors: 0 },
          sales: { push: 0, pull: 0, errors: 0 },
          categories: { push: 0, pull: 0, errors: 0 },
          partyPurchases: { push: 0, pull: 0, errors: 0 }
        },
        totalSynced: 0,
        totalErrors: 0,
        totalSkipped: 0,
        totalRecovered: 0,
        duration,
        error: 'Supabase project is paused. Please resume to sync.'
      };

      lastSyncResult = result;
      await saveLastSyncResult(result);
      notifyListeners(result);
      return result;
    }

    // Perform the sync
    const stats = await performFullSync();

    // Calculate totals
    const totalSynced =
      stats.products.push + stats.products.pull +
      stats.sales.push + stats.sales.pull +
      stats.categories.push + stats.categories.pull +
      stats.partyPurchases.push + stats.partyPurchases.pull;

    const totalErrors =
      stats.products.errors +
      stats.sales.errors +
      stats.categories.errors +
      stats.partyPurchases.errors;

    const totalSkipped =
      (stats.products.skipped || 0) +
      (stats.sales.skipped || 0) +
      (stats.categories.skipped || 0) +
      (stats.partyPurchases.skipped || 0);

    const totalRecovered =
      (stats.products.recovered || 0) +
      (stats.sales.recovered || 0) +
      (stats.categories.recovered || 0) +
      (stats.partyPurchases.recovered || 0);

    const details = [
      ...(stats.products.details || []),
      ...(stats.sales.details || []),
      ...(stats.categories.details || []),
      ...(stats.partyPurchases.details || [])
    ];

    const health: SyncHealth = totalErrors > 0
      ? 'real_failure'
      : totalRecovered > 0
        ? 'recovered_retry'
        : details.some(detail => detail.startsWith('insufficient_stock_skipped'))
          ? 'insufficient_stock_skipped'
          : details.some(detail => detail.startsWith('skipped_old_local_sale'))
            ? 'skipped_old_local_sale'
            : details.some(detail => detail.startsWith('skipped_orphan'))
              ? 'local_cache_needs_refresh'
              : totalSkipped > 0
                ? 'skipped_orphan'
                : 'fully_synced';

    const duration = Date.now() - startTime;

    const result: SyncResult = {
      status: totalErrors > 0 ? 'error' : 'success',
      health,
      timestamp: new Date().toISOString(),
      stats,
      totalSynced,
      totalErrors,
      totalSkipped,
      totalRecovered,
      details,
      duration
    };

    // Save last sync result
    await saveLastSyncResult(result);

    return result;
  } catch (err) {
    console.error(`Sync attempt ${attempt} failed:`, err);

    // Retry if attempts remaining
    if (attempt < currentConfig.retryAttempts) {
      const delay = currentConfig.retryDelay * attempt; // Exponential backoff
      console.log(`Retrying in ${delay}ms...`);
      await sleep(delay);
      return syncWithRetry(attempt + 1);
    }

    // All retries failed
    const duration = Date.now() - startTime;
    const result: SyncResult = {
      status: 'error',
      health: 'real_failure',
      timestamp: new Date().toISOString(),
      stats: {
        products: { push: 0, pull: 0, errors: 0 },
        sales: { push: 0, pull: 0, errors: 0 },
        categories: { push: 0, pull: 0, errors: 0 },
        partyPurchases: { push: 0, pull: 0, errors: 0 }
      },
      totalSynced: 0,
      totalErrors: 1,
      totalSkipped: 0,
      totalRecovered: 0,
      duration,
      error: err instanceof Error ? err.message : 'Unknown error'
    };

    await saveLastSyncResult(result);

    return result;
  }
};

// Save last sync result to IndexedDB
const saveLastSyncResult = async (result: SyncResult): Promise<void> => {
  try {
    const db = await getSyncMetaDB();

    const docId = 'last_sync_result';
    let doc: LastSyncResultDoc;

    try {
      const existing = await db.get(docId) as LastSyncResultDoc;
      doc = {
        ...existing,
        result,
        updated_at: new Date().toISOString()
      };
    } catch {
      doc = {
        _id: docId,
        result,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    }

    await db.put(doc);
    lastSyncResult = result;
  } catch (err) {
    console.error('Error saving sync result:', err);
  }
};

// Get last sync result
export const getLastSyncResult = async (): Promise<SyncResult | null> => {
  if (lastSyncResult) {
    return lastSyncResult;
  }

  try {
    const db = await getSyncMetaDB();
    const doc = await db.get('last_sync_result') as LastSyncResultDoc;
    lastSyncResult = doc.result;
    return doc.result;
  } catch {
    return null;
  }
};

// Perform manual sync
export const performManualSync = async (): Promise<SyncResult> => {
  if (isSyncing) {
    throw new Error('Sync already in progress');
  }

  isSyncing = true;

  try {
    const result = await syncWithRetry();
    notifyListeners(result);
    return result;
  } finally {
    isSyncing = false;
  }
};

// Auto-sync handler
const performAutoSync = async (): Promise<void> => {
  if (isSyncing) {
    console.log('Sync already in progress, skipping...');
    return;
  }

  if (!navigator.onLine) {
    console.log('Device is offline, skipping sync...');
    return;
  }

  console.log('Starting auto-sync...');
  isSyncing = true;

  try {
    const result = await syncWithRetry();
    console.log('Auto-sync completed:', result);
    notifyListeners(result);
  } catch (err) {
    console.error('Auto-sync failed:', err);
  } finally {
    isSyncing = false;
  }
};

// Start auto-sync
export const startAutoSync = (): void => {
  // Clear existing interval
  if (syncInterval) {
    clearInterval(syncInterval);
  }

  if (!currentConfig.autoSync) {
    return;
  }

  console.log(`Starting auto-sync with interval: ${currentConfig.syncInterval}ms`);

  // Perform initial sync
  performAutoSync();

  // Set up recurring sync
  syncInterval = setInterval(performAutoSync, currentConfig.syncInterval);
};

// Stop auto-sync
export const stopAutoSync = (): void => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('Auto-sync stopped');
  }
};

// Check if sync is in progress
export const isSyncInProgress = (): boolean => {
  return isSyncing;
};

// Initialize sync manager
export const initializeSyncManager = async (): Promise<void> => {
  console.log('Initializing sync manager...');

  // Load saved configuration
  const savedConfig = await loadSyncConfig();
  currentConfig = savedConfig;

  // Load last sync result
  lastSyncResult = await getLastSyncResult();

  // Start auto-sync if enabled
  if (currentConfig.autoSync && typeof window !== 'undefined') {
    startAutoSync();

    // Listen for online/offline events
    window.addEventListener('online', () => {
      console.log('Device came online, starting sync...');
      performAutoSync();
    });

    window.addEventListener('offline', () => {
      console.log('Device went offline');
    });
  }

  console.log('Sync manager initialized:', currentConfig);
};

// Register background sync (Service Worker)
export const registerBackgroundSync = async (): Promise<void> => {
  if (!currentConfig.enableBackgroundSync) {
    return;
  }

  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return;
  }

  if (!('sync' in navigator.serviceWorker)) {
    console.warn('Background Sync not supported');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await (registration as any).sync.register('sync-data');
    console.log('Background sync registered');
  } catch (err) {
    console.error('Error registering background sync:', err);
  }
};

// Queue sync for later (when offline)
export const queueSync = async (): Promise<void> => {
  try {
    const db = await getSyncMetaDB();

    const docId = 'sync_queue';
    let doc: SyncQueueDoc;

    try {
      const existing = await db.get(docId) as SyncQueueDoc;
      doc = {
        ...existing,
        queued: true,
        queued_at: new Date().toISOString()
      };
    } catch {
      doc = {
        _id: docId,
        queued: true,
        queued_at: new Date().toISOString()
      };
    }

    await db.put(doc);
    console.log('Sync queued for later');

    // Register background sync if supported
    await registerBackgroundSync();
  } catch (err) {
    console.error('Error queuing sync:', err);
  }
};

// Check if sync is queued
export const isSyncQueued = async (): Promise<boolean> => {
  try {
    const db = await getSyncMetaDB();
    const doc = await db.get('sync_queue') as SyncQueueDoc;
    return doc.queued || false;
  } catch {
    return false;
  }
};

// Clear sync queue
export const clearSyncQueue = async (): Promise<void> => {
  try {
    const db = await getSyncMetaDB();
    const doc = await db.get('sync_queue') as SyncQueueDoc;
    doc.queued = false;
    doc.cleared_at = new Date().toISOString();
    await db.put(doc);
  } catch (err) {
    // Document doesn't exist, nothing to clear
  }
};

// Get sync statistics
export const getSyncStats = async () => {
  const lastResult = await getLastSyncResult();
  const isQueued = await isSyncQueued();

  return {
    lastSync: lastResult?.timestamp || null,
    lastStatus: lastResult?.status || 'idle',
    syncHealth: lastResult?.health || 'fully_synced',
    totalSynced: lastResult?.totalSynced || 0,
    totalErrors: lastResult?.totalErrors || 0,
    totalSkipped: lastResult?.totalSkipped || 0,
    totalRecovered: lastResult?.totalRecovered || 0,
    details: lastResult?.details || [],
    isSyncing,
    isQueued,
    autoSyncEnabled: currentConfig.autoSync,
    syncInterval: currentConfig.syncInterval
  };
};

// Force sync now (bypass checks)
export const forceSyncNow = async (): Promise<SyncResult> => {
  console.log('Forcing sync now...');
  isSyncing = false; // Reset flag
  return performManualSync();
};

// Cleanup on app close
export const cleanupSyncManager = (): void => {
  stopAutoSync();
  syncListeners.clear();
};
