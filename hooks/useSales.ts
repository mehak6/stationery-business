'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAllSales,
  getSaleById,
  getSalesByDate,
  createSale as createSaleDB,
  updateSale as updateSaleDB,
  deleteSale as deleteSaleDB,
  type Sale
} from '../lib/offline-db';
import { initializeDatabases } from '../lib/pouchdb-client';

export const useSales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'pending' | 'syncing'>('synced');

  // Initialize databases on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      initializeDatabases();
      loadSales();
    }
  }, []);

  const loadSales = useCallback(async (limit?: number) => {
    try {
      setLoading(true);
      setError(null);
      const data = await getAllSales(limit);
      setSales(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales');
      console.error('Error loading sales:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const createSale = useCallback(async (sale: Omit<Sale, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const newSale = await createSaleDB(sale);
      setSales(prev => [newSale, ...prev]);
      setSyncStatus('synced');
      return newSale;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sale');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const updateSale = useCallback(async (id: string, updates: Partial<Sale>) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const updated = await updateSaleDB(id, updates);
      if (updated) {
        setSales(prev => prev.map(s => s.id === id ? updated : s));
      }
      setSyncStatus('synced');
      return updated;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update sale');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const deleteSale = useCallback(async (id: string) => {
    try {
      setError(null);
      setSyncStatus('pending');
      const success = await deleteSaleDB(id);
      if (success) {
        setSales(prev => prev.filter(s => s.id !== id));
      }
      setSyncStatus('synced');
      return success;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete sale');
      setSyncStatus('synced');
      throw err;
    }
  }, []);

  const getSale = useCallback(async (id: string) => {
    try {
      return await getSaleById(id);
    } catch (err) {
      console.error('Error getting sale:', err);
      return null;
    }
  }, []);

  const getSalesByDateRange = useCallback(async (date: string) => {
    try {
      setError(null);
      const data = await getSalesByDate(date);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get sales by date');
      console.error('Error getting sales by date:', err);
      return [];
    }
  }, []);

  const refreshSales = useCallback((limit?: number) => {
    loadSales(limit);
  }, [loadSales]);

  return {
    sales,
    loading,
    error,
    syncStatus,
    createSale,
    updateSale,
    deleteSale,
    getSale,
    getSalesByDateRange,
    refreshSales
  };
};
