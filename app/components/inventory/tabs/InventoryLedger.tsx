'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Filter, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import {
  getInventoryTransactions,
  getProducts,
  type InventoryTransaction
} from 'lib/offline-adapter';
import type { Product } from 'supabase_client';
import { useToast } from 'app/context/ToastContext';

interface InventoryLedgerProps {
  onNavigate: (view: string) => void;
}

const ACTION_LABELS: Record<string, string> = {
  sale_created: 'Sale deducted stock',
  sale_quantity_increased: 'Sale edit deducted more',
  sale_quantity_decreased: 'Sale edit restored stock',
  sale_product_changed_restore: 'Sale product changed restore',
  sale_product_changed_deduct: 'Sale product changed deduct',
  sale_deleted_restore: 'Sale deleted restore',
  manual_stock_added: 'Manual stock added',
  manual_stock_reduced: 'Manual stock reduced',
  damaged_stock_removed: 'Damaged stock removed',
  party_transfer: 'Party transfer',
  year_reset: 'Year reset',
  stock_repair: 'Repair / correction'
};

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'sale_created', label: 'Sale deducted' },
  { value: 'sale_quantity_increased', label: 'Sale increased' },
  { value: 'sale_quantity_decreased', label: 'Sale decreased' },
  { value: 'sale_deleted_restore', label: 'Sale deleted restore' },
  { value: 'manual_stock_added', label: 'Manual add' },
  { value: 'manual_stock_reduced', label: 'Manual reduce' },
  { value: 'damaged_stock_removed', label: 'Damaged' },
  { value: 'party_transfer', label: 'Party transfer' },
  { value: 'stock_repair', label: 'Repair / correction' },
  { value: 'year_reset', label: 'Year reset' }
];

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const getProductName = (entry: InventoryTransaction) => {
  return entry.products?.name || (entry.metadata as any)?.product_name || 'Unknown product';
};

const getQuantityClass = (quantity: number) => {
  if (quantity > 0) return 'text-green-700 bg-green-50';
  if (quantity < 0) return 'text-red-700 bg-red-50';
  return 'text-gray-700 bg-gray-50';
};

export default function InventoryLedger({ onNavigate }: InventoryLedgerProps) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<InventoryTransaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [selectedAction, setSelectedAction] = useState('');

  const loadLedger = useCallback(async () => {
    try {
      setLoading(true);
      const [ledgerRows, productRows] = await Promise.all([
        getInventoryTransactions(1000, {
          productId: selectedProductId || undefined,
          action: selectedAction || undefined
        }),
        getProducts()
      ]);
      setEntries(ledgerRows);
      setProducts(productRows || []);
    } catch (error) {
      console.error('Error loading inventory ledger:', error);
      showToast('Unable to load inventory ledger', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, selectedAction, showToast]);

  useEffect(() => {
    loadLedger();
  }, [loadLedger]);

  const filteredEntries = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    if (!search) return entries;
    return entries.filter(entry => {
      const productName = getProductName(entry).toLowerCase();
      const action = (ACTION_LABELS[entry.action] || entry.action).toLowerCase();
      const reason = (entry.reason || '').toLowerCase();
      const source = (entry.source || '').toLowerCase();
      return productName.includes(search) || action.includes(search) || reason.includes(search) || source.includes(search);
    });
  }, [entries, searchTerm]);

  const summary = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => {
        acc.total += 1;
        if (entry.quantity_change > 0) acc.increased += entry.quantity_change;
        if (entry.quantity_change < 0) acc.reduced += Math.abs(entry.quantity_change);
        return acc;
      },
      { total: 0, increased: 0, reduced: 0 }
    );
  }, [filteredEntries]);

  return (
    <div className="p-6 bg-primary-50 min-h-screen pb-24">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Inventory Ledger</h1>
          <p className="text-gray-600 mt-2">Audit stock movement by product, sale, transfer, damage, repair, and user source.</p>
        </div>
        <button
          onClick={loadLedger}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-white text-primary-600 hover:bg-primary-50 border-2 border-primary-200 font-bold shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <p className="stat-label">Ledger Rows</p>
          <p className="stat-value">{summary.total}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Stock Added / Restored</p>
          <p className="stat-value text-green-700">{summary.increased}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Stock Reduced</p>
          <p className="stat-value text-red-700">{summary.reduced}</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm mb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_220px] gap-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search product, reason, source, action"
              className="w-full input-field pl-12"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full input-field pl-10"
            >
              <option value="">All products</option>
              {products
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map(product => (
                  <option key={product.id} value={product.id}>{product.name}</option>
                ))}
            </select>
          </div>
          <select
            value={selectedAction}
            onChange={(e) => setSelectedAction(e.target.value)}
            className="input-field"
          >
            {ACTION_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary-500 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">Loading ledger...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className="py-16 text-center">
            <Activity className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No ledger entries found.</p>
            <button onClick={() => onNavigate('products')} className="mt-4 text-primary-600 font-bold hover:text-primary-700">
              Go to Products
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">When</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">Action</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase text-gray-500">Change</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase text-gray-500">Before</th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase text-gray-500">After</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">Who / Source</th>
                  <th className="px-4 py-3 text-left text-xs font-black uppercase text-gray-500">Why</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredEntries.map(entry => (
                  <tr key={entry.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">{formatDateTime(entry.created_at)}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-bold text-gray-900">{getProductName(entry)}</p>
                      {entry.sale_id && <p className="text-[10px] text-gray-400">Sale: {entry.sale_id.slice(0, 8)}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-gray-700">{ACTION_LABELS[entry.action] || entry.action}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`inline-flex justify-center min-w-[64px] rounded-full px-2 py-1 text-sm font-black ${getQuantityClass(entry.quantity_change)}`}>
                        {entry.quantity_change > 0 ? '+' : ''}{entry.quantity_change}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-gray-600">{entry.stock_before}</td>
                    <td className="px-4 py-3 text-right text-sm font-black text-gray-900">{entry.stock_after}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-primary-500" />
                        <span>{entry.source || 'database'}</span>
                      </div>
                      {entry.created_by && <p className="text-[10px] text-gray-400 ml-6">{entry.created_by.slice(0, 8)}</p>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-xs">
                      <p className="line-clamp-2">{entry.reason || 'No reason recorded'}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
