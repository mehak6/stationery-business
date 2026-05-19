'use client'

import React, { useState, useEffect, useRef } from 'react';
import { Download, Upload, Clock, AlertTriangle, CheckCircle, Settings, Database, RefreshCw } from 'lucide-react';
import {
  createAndDownloadBackup,
  createYearEndArchive,
  readBackupFile,
  isBackupDue,
  getBackupInterval,
  setBackupInterval,
  getLastBackupDate,
  formatBackupDate,
  getDaysUntilNextBackup,
  BackupData
} from '../../lib/backup-utils';
import { createProduct, createSale, createPartyPurchase, getProducts, getSales, getPartyPurchases } from '../../lib/offline-adapter';
import { performManualSync } from '../../lib/sync-manager';

interface BackupRestoreProps {
  onClose: () => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
}

export default function BackupRestore({ onClose, showToast }: BackupRestoreProps) {
  const [loading, setLoading] = useState(false);
  const [backupInterval, setBackupIntervalState] = useState(10);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [daysUntilBackup, setDaysUntilBackup] = useState(0);
  const [restorePreview, setRestorePreview] = useState<BackupData | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const reloadTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load current settings
    setBackupIntervalState(getBackupInterval());
    setLastBackup(getLastBackupDate());
    setDaysUntilBackup(getDaysUntilNextBackup());

    // Check if backup is due and notify
    if (isBackupDue()) {
      showToast('Backup is due! Consider creating a backup now.', 'warning');
    }

    // Cleanup reload timer on unmount
    return () => {
      if (reloadTimerRef.current) {
        clearTimeout(reloadTimerRef.current);
      }
    };
  }, []);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (restorePreview) {
          setRestorePreview(null);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscapeKey);
    return () => document.removeEventListener('keydown', handleEscapeKey);
  }, [onClose, restorePreview]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'unset'; };
  }, []);

  const handleCreateBackup = async () => {
    setLoading(true);
    try {
      await createAndDownloadBackup('manual');
      setLastBackup(new Date().toISOString());
      setDaysUntilBackup(getBackupInterval());
      showToast('Backup created and downloaded successfully!', 'success');
    } catch (error) {
      console.error('Backup error:', error);
      showToast('Failed to create backup. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const backup = await readBackupFile(file);
      setRestorePreview(backup);
    } catch (error: any) {
      showToast(error.message || 'Failed to read backup file', 'error');
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRestore = async () => {
    if (!restorePreview) return;

    setIsRestoring(true);
    try {
      // Get current data counts
      const [currentProducts, currentSales, currentPurchases] = await Promise.all([
        getProducts(),
        getSales(10000),
        getPartyPurchases()
      ]);

      // Restore products
      let productsRestored = 0;
      for (const product of restorePreview.products) {
        // Check if product already exists
        const exists = currentProducts.find(p => p.id === product.id || p.name === product.name);
        if (!exists) {
          await createProduct({
            name: product.name,
            category_id: product.category_id,
            barcode: product.barcode,
            purchase_price: product.purchase_price,
            selling_price: product.selling_price,
            stock_quantity: product.stock_quantity,
            min_stock_level: product.min_stock_level,
            description: product.description
          });
          productsRestored++;
        }
      }

      // Restore sales
      let salesRestored = 0;
      for (const sale of restorePreview.sales) {
        const exists = currentSales.find(s => s.id === sale.id);
        if (!exists) {
          await createSale({
            product_id: sale.product_id,
            quantity: sale.quantity,
            unit_price: sale.unit_price,
            total_amount: sale.total_amount,
            profit: sale.profit,
            sale_date: sale.sale_date
          });
          salesRestored++;
        }
      }

      // Restore party purchases
      let purchasesRestored = 0;
      for (const purchase of restorePreview.partyPurchases) {
        const exists = currentPurchases.find(p => p.id === purchase.id);
        if (!exists) {
          await createPartyPurchase({
            party_name: purchase.party_name,
            item_name: purchase.item_name,
            barcode: purchase.barcode,
            purchased_quantity: purchase.purchased_quantity,
            remaining_quantity: purchase.remaining_quantity,
            purchase_price: purchase.purchase_price,
            selling_price: purchase.selling_price,
            purchase_date: purchase.purchase_date
          });
          purchasesRestored++;
        }
      }

      showToast(
        `Restored: ${productsRestored} products, ${salesRestored} sales, ${purchasesRestored} purchases`,
        'success'
      );

      try {
        const syncResult = await performManualSync();
        if (syncResult.status === 'success') {
          showToast('Restore synced to cloud database successfully.', 'success');
        } else if (syncResult.status === 'paused') {
          showToast('Restore completed locally. Cloud sync paused (Supabase paused).', 'warning');
        } else {
          showToast('Restore completed locally, but sync reported errors. Please retry sync.', 'warning');
        }
      } catch {
        showToast('Restore completed locally. Unable to sync now; please sync once online.', 'warning');
      }

      setRestorePreview(null);

      // Refresh the page to show restored data
      reloadTimerRef.current = setTimeout(() => {
        window.location.reload();
      }, 1500);

    } catch (error) {
      console.error('Restore error:', error);
      showToast('Failed to restore backup. Please try again.', 'error');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleIntervalChange = (days: number) => {
    setBackupIntervalState(days);
    setBackupInterval(days);
    setDaysUntilBackup(getDaysUntilNextBackup());
    showToast(`Backup interval set to ${days} days`, 'info');
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="backup-restore-title"
    >
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto mx-4 my-8">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Database className="h-6 w-6 text-primary-600" />
              <h2 id="backup-restore-title" className="text-xl font-bold text-gray-900">
                Backup & Restore
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Close dialog"
              type="button"
            >
              ×
            </button>
          </div>

          {/* Restore Preview */}
          {restorePreview ? (
            <div className="space-y-4">
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-yellow-800">Restore Preview</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      This will add missing data from the backup. Existing data will not be overwritten.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p className="text-sm text-gray-600">
                  <strong>Backup Date:</strong> {formatBackupDate(restorePreview.timestamp)}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Products:</strong> {restorePreview.metadata.totalProducts}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Sales:</strong> {restorePreview.metadata.totalSales}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Party Purchases:</strong> {restorePreview.metadata.totalPartyPurchases}
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setRestorePreview(null)}
                  className="flex-1 py-2 px-4 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRestore}
                  disabled={isRestoring}
                  className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  type="button"
                >
                  {isRestoring ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Restoring...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" />
                      Restore Now
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Backup Status */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-gray-500" />
                  <span className="font-medium text-gray-900">Backup Status</span>
                </div>
                {lastBackup ? (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      Last backup: <strong>{formatBackupDate(lastBackup)}</strong>
                    </p>
                    <p className="text-sm text-gray-600">
                      Next backup due in: <strong>{daysUntilBackup} days</strong>
                    </p>
                    {isBackupDue() && (
                      <div className="flex items-center gap-2 text-orange-600 mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span className="text-sm font-medium">Backup is overdue!</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">No backup created yet</p>
                )}
              </div>

              {/* Backup Interval Setting */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="h-5 w-5 text-gray-500" />
                  <span className="font-medium text-gray-900">Auto-Backup Interval</span>
                </div>
                <div className="flex gap-2">
                  {[7, 10, 14, 30].map((days) => (
                    <button
                      key={days}
                      onClick={() => handleIntervalChange(days)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        backupInterval === days
                          ? 'bg-primary-600 text-white'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                      type="button"
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>

              {/* Year-End Archive */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Database className="h-5 w-5 text-amber-600" />
                  <span className="font-medium text-amber-900">Year-End Archive (2025-26)</span>
                </div>
                <p className="text-xs text-amber-700 mb-4">
                  Download a complete, permanent record of the previous financial year including all sales, reports, categories, and final stock levels.
                </p>
                <button
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await createYearEndArchive('2025-26');
                      showToast('Year-End Archive (2025-26) downloaded successfully!', 'success');
                    } catch (error) {
                      showToast('Failed to create archive.', 'error');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full py-2 px-4 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center gap-2 text-sm font-semibold transition-colors shadow-sm"
                  type="button"
                >
                  <Download className="h-4 w-4" />
                  Download 2025-26 Archive
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={handleCreateBackup}
                  disabled={loading}
                  className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                  type="button"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Creating Backup...
                    </>
                  ) : (
                    <>
                      <Download className="h-5 w-5" />
                      Create Backup Now
                    </>
                  )}
                </button>

                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="backup-file-input"
                  />
                  <label
                    htmlFor="backup-file-input"
                    className="w-full py-3 px-4 border-2 border-dashed border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 font-medium cursor-pointer"
                  >
                    <Upload className="h-5 w-5" />
                    Restore from Backup File
                  </label>
                </div>
              </div>

              {/* Info */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium">Backup includes:</p>
                    <ul className="mt-1 list-disc list-inside space-y-0.5">
                      <li>All products and stock levels</li>
                      <li>Sales history and transactions</li>
                      <li>Party purchases and transfers</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
