/**
 * Backup and Restore Utilities for Inventory Pro
 * Handles automatic backups and data restoration
 */

import { 
  getProducts, 
  getSales, 
  getPartyPurchases, 
  getCategories,
  getClosingStockForYear,
  getInventoryTransactions
} from './offline-adapter';
import * as OfflineDB from './offline-db';

export interface BackupData {
  version: string;
  timestamp: string;
  financialYear?: string;
  products: any[];
  sales: any[];
  partyPurchases: any[];
  categories: any[];
  inventoryTransactions: any[];
  closingStock: Record<string, number>;
  productHistory: any[];
  metadata: {
    totalProducts: number;
    totalSales: number;
    totalPartyPurchases: number;
    totalCategories: number;
    totalInventoryTransactions: number;
    backupType: 'manual' | 'automatic' | 'archive';
  };
}

const BACKUP_VERSION = '1.2.0';
const BACKUP_INTERVAL_KEY = 'inventory_pro_backup_interval';
const LAST_BACKUP_KEY = 'inventory_pro_last_backup';


const getActiveFinancialYear = (): string => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('inventory_pro_fy');
    if (saved && /^\d{4}-\d{2}$/.test(saved)) return saved;
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const startYear = month >= 3 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
};

/**
 * Create a backup of all data
 */
export async function createBackup(
  backupType: 'manual' | 'automatic' | 'archive' = 'manual',
  financialYear?: string
): Promise<BackupData> {
  try {
    const [products, sales, partyPurchases, categories, inventoryTransactions] = await Promise.all([
      getProducts(),
      getSales(20000), // Get up to 20k sales
      getPartyPurchases(),
      getCategories(),
      getInventoryTransactions(50000)
    ]);

    // Fetch closing stock for specific year if archive, else for current/last known
    const targetFY = financialYear || getActiveFinancialYear();
    const closingStock = await getClosingStockForYear(targetFY);

    // Fetch all history entries
    const productHistory = await OfflineDB.getAllProductHistory();

    const backup: BackupData = {
      version: BACKUP_VERSION,
      timestamp: new Date().toISOString(),
      financialYear: targetFY,
      products: products || [],
      sales: sales || [],
      partyPurchases: partyPurchases || [],
      categories: categories || [],
      inventoryTransactions: inventoryTransactions || [],
      closingStock: closingStock || {},
      productHistory: productHistory || [],
      metadata: {
        totalProducts: products?.length || 0,
        totalSales: sales?.length || 0,
        totalPartyPurchases: partyPurchases?.length || 0,
        totalCategories: categories?.length || 0,
        totalInventoryTransactions: inventoryTransactions?.length || 0,
        backupType
      }
    };

    // Update last backup timestamp only for regular backups
    if (backupType !== 'archive') {
      localStorage.setItem(LAST_BACKUP_KEY, backup.timestamp);
    }

    return backup;
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

/**
 * Download backup as JSON file
 */
export function downloadBackup(backup: BackupData): void {
  const dataStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const date = new Date(backup.timestamp);
  const dateStr = date.toISOString().split('T')[0];
  const timeStr = date.toTimeString().split(' ')[0].replace(/:/g, '-');
  
  const prefix = backup.metadata.backupType === 'archive' 
    ? `inventory_archive_${backup.financialYear}_` 
    : `inventory_pro_backup_`;
    
  const filename = `${prefix}${dateStr}_${timeStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Create and download an archive for a specific financial year
 */
export async function createYearEndArchive(financialYear: string): Promise<void> {
  const backup = await createBackup('archive', financialYear);
  downloadBackup(backup);
}

/**
 * Create and download backup in one step
 */
export async function createAndDownloadBackup(backupType: 'manual' | 'automatic' = 'manual'): Promise<void> {
  const backup = await createBackup(backupType);
  downloadBackup(backup);
}

export async function exportDataset(
  dataset: 'products' | 'sales' | 'party_purchases' | 'inventory_transactions' | 'full_backup'
): Promise<void> {
  if (dataset === 'full_backup') {
    await createAndDownloadBackup('manual');
    return;
  }

  const loaders = {
    products: () => getProducts(),
    sales: () => getSales(50000),
    party_purchases: () => getPartyPurchases(),
    inventory_transactions: () => getInventoryTransactions(50000)
  };

  const rows = await loaders[dataset]();
  const exportedAt = new Date().toISOString();
  const payload = {
    version: BACKUP_VERSION,
    exportedAt,
    dataset,
    count: rows.length,
    rows
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const filename = `inventory_${dataset}_${exportedAt.split('T')[0]}_${exportedAt.split('T')[1].slice(0, 8).replace(/:/g, '-')}.json`;
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Read backup file and parse it
 */
export function readBackupFile(file: File): Promise<BackupData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);

        // Validate backup structure
        if (!data.version || !data.timestamp || !data.products) {
          throw new Error('Invalid backup file format');
        }

        resolve(data as BackupData);
      } catch (error) {
        reject(new Error('Failed to parse backup file. Please ensure it is a valid backup.'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read backup file'));
    reader.readAsText(file);
  });
}

/**
 * Check if automatic backup is due (every 10 days)
 */
export function isBackupDue(): boolean {
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  if (!lastBackup) return true;

  const lastBackupDate = new Date(lastBackup);
  const now = new Date();
  const daysSinceBackup = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24);

  const interval = getBackupInterval();
  return daysSinceBackup >= interval;
}

/**
 * Get backup interval in days (default 10)
 */
export function getBackupInterval(): number {
  const interval = localStorage.getItem(BACKUP_INTERVAL_KEY);
  return interval ? parseInt(interval, 10) : 10;
}

/**
 * Set backup interval in days
 */
export function setBackupInterval(days: number): void {
  localStorage.setItem(BACKUP_INTERVAL_KEY, days.toString());
}

/**
 * Get last backup date
 */
export function getLastBackupDate(): string | null {
  return localStorage.getItem(LAST_BACKUP_KEY);
}

/**
 * Format date for display
 */
export function formatBackupDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Get days until next backup
 */
export function getDaysUntilNextBackup(): number {
  const lastBackup = localStorage.getItem(LAST_BACKUP_KEY);
  if (!lastBackup) return 0;

  const lastBackupDate = new Date(lastBackup);
  const now = new Date();
  const daysSinceBackup = (now.getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24);
  const interval = getBackupInterval();

  return Math.max(0, Math.ceil(interval - daysSinceBackup));
}
