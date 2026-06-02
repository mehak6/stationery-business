'use client';

/**
 * Product History Tracker
 * Tracks when products are added and stock changes
 */

import * as OfflineDB from './offline-db';

export interface ProductHistoryEntry {
  id: string;
  product_id: string;
  product_name: string;
  action: 'created' | 'stock_added' | 'stock_updated' | 'stock_reset' | 'stock_reduced' | 'damaged_stock_removed';
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  date: string;
  notes?: string;
}

type ProductHistoryCreateEntry = Omit<ProductHistoryEntry, 'id' | 'date'> & Partial<Pick<ProductHistoryEntry, 'date'>>;

export const addProductHistory = async (historyEntry: ProductHistoryCreateEntry): Promise<void> => {
  try {
    const entry: ProductHistoryEntry = {
      id: `history_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: new Date().toISOString(),
      ...historyEntry
    };

    await OfflineDB.saveProductHistory(entry);
  } catch (error) {
    console.error('Error adding product history:', error);
    throw error;
  }
};

export const addProductHistoryBulk = async (historyEntries: ProductHistoryCreateEntry[]): Promise<void> => {
  try {
    const now = new Date().toISOString();
    const entries: ProductHistoryEntry[] = historyEntries.map((he, index) => ({
      id: `history_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 5)}`,
      date: now,
      ...he
    }));

    await OfflineDB.saveProductHistoryBulk(entries);
  } catch (error) {
    console.error('Error adding product history bulk:', error);
    throw error;
  }
};

export const getProductHistory = async (productId: string): Promise<ProductHistoryEntry[]> => {
  try {
    const allHistory = await OfflineDB.getProductHistory(productId);
    return allHistory.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } catch (error) {
    console.error('Error getting product history:', error);
    return [];
  }
};

export const removeHistoryEntry = async (historyId: string): Promise<void> => {
  try {
    await OfflineDB.deleteProductHistory(historyId);
  } catch (error) {
    console.error('Error removing history entry:', error);
    throw error;
  }
};
