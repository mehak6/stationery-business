'use client';

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  Plus,
  DollarSign,
  Edit,
  Trash2,
  X,
  RefreshCw
} from 'lucide-react';
import {
  getProducts,
  createSale,
  updateSale,
  deleteSale,
  getAnalytics,
  getSalesByDateRange,
  syncAllData
} from 'lib/offline-adapter';
import { 
  getFinancialYear, 
  getFYRange 
} from 'lib/date-utils';
import { formatDateToDDMMYYYY, parseDDMMYYYYToISO, getCurrentDateISO, getCurrentDateDisplay } from '../utils/dateHelpers';
import type { Product, Sale } from 'supabase_client';
import { useToast } from 'app/context/ToastContext';
import { useSyncStatus } from 'hooks/useSyncStatus';

interface DashboardProps {
  onNavigate: (view: string) => void;
}

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { showToast } = useToast();
  const { syncStatus, lastSyncTime, stats, supabaseStatus, isSyncing, error } = useSyncStatus();
  const [syncing, setSyncing] = useState(false);
  const [analytics, setAnalytics] = useState({
    totalProducts: 0,
    totalSales: 0,
    totalProfit: 0,
    todaySales: 0,
    todayProfit: 0,
    lowStockProducts: 0
  });

  const [lowStockItems, setLowStockItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [showAllSales, setShowAllSales] = useState(false);
  const [allSalesLoading, setAllSalesLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(getCurrentDateISO());
  const [startDateDisplay, setStartDateDisplay] = useState('');
  const [endDateDisplay, setEndDateDisplay] = useState(getCurrentDateDisplay());
  const [allSalesPage, setAllSalesPage] = useState(1);
  const [allSalesTotal, setAllSalesTotal] = useState(0);
  const SALES_PER_PAGE = 20;

  type ExtendedSale = Sale & { 
    products?: { 
      name: string; 
      purchase_price: number; 
    } 
  };

  const [editingSale, setEditingSale] = useState<ExtendedSale | null>(null);
  const [editSaleData, setEditSaleData] = useState({
    quantity: 0,
    unit_price: 0,
    sale_date: ''
  });
  const [editSaleDateDisplay, setEditSaleDateDisplay] = useState('');
  const [actionReason, setActionReason] = useState('');
  const [lastDeletedSale, setLastDeletedSale] = useState<Sale | null>(null);
  const [auditEntries, setAuditEntries] = useState<Array<{ id: string; action: string; reason: string; saleId: string; at: string }>>([]);

  const DASHBOARD_CACHE_KEY = 'dashboard_analytics_cache_v1';
  const DASHBOARD_AUDIT_KEY = 'dashboard_sales_audit_v1';

  // Fetch dashboard data on component mount
  const fetchDashboardData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      console.log('🏁 Dashboard: Fetching analytics and products');

      const [analyticsData, productsData] = await Promise.all([
        getAnalytics(),
        getProducts()
      ]);
      
      console.log('📊 Dashboard Received:', analyticsData);

      setAnalytics(analyticsData || {
        totalProducts: 0,
        totalSales: 0,
        totalProfit: 0,
        todaySales: 0,
        todayProfit: 0,
        lowStockProducts: 0
      });

      // Filter low stock items
      const lowStock = (productsData || []).filter(p => p.stock_quantity <= p.min_stock_level);
      setLowStockItems(lowStock);
      if (typeof window !== 'undefined') {
        localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify({
          analytics: analyticsData,
          lowStockItems: lowStock,
          updatedAt: new Date().toISOString()
        }));
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setLowStockItems([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(DASHBOARD_CACHE_KEY);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed.analytics) setAnalytics(parsed.analytics);
          if (Array.isArray(parsed.lowStockItems)) setLowStockItems(parsed.lowStockItems);
          setLoading(false);
        } catch (e) {
          console.warn('Invalid dashboard cache', e);
        }
      }
      const savedAudit = localStorage.getItem(DASHBOARD_AUDIT_KEY);
      if (savedAudit) {
        try {
          setAuditEntries(JSON.parse(savedAudit));
        } catch {
          setAuditEntries([]);
        }
      }
    }
    fetchDashboardData();
  }, []);

  const addAuditEntry = (action: string, saleId: string, reason: string) => {
    const entry = { id: `${Date.now()}-${saleId}`, action, reason: reason || 'No reason provided', saleId, at: new Date().toISOString() };
    setAuditEntries(prev => {
      const next = [entry, ...prev].slice(0, 20);
      if (typeof window !== 'undefined') {
        localStorage.setItem(DASHBOARD_AUDIT_KEY, JSON.stringify(next));
      }
      return next;
    });
  };

  const handleSyncAndRefresh = async () => {
    try {
      setSyncing(true);
      showToast('Syncing & Refreshing...', 'info');
      
      // Perform sync if possible
      await syncAllData().catch(e => console.warn('Sync failed during refresh:', e));
      
      // Re-fetch all data
      await fetchDashboardData(true);
      
      if (showAllSales) {
        await fetchAllSales(allSalesPage);
      }
      
      showToast('Dashboard updated', 'success');
    } catch (error) {
      console.error('Refresh failed:', error);
      showToast('Refresh failed, showing local data', 'warning');
    } finally {
      setSyncing(false);
    }
  };

  const handleEditSale = (sale: Sale) => {
    setEditingSale(sale as ExtendedSale);
    const isoDate = sale.sale_date.split('T')[0];
    setEditSaleData({
      quantity: sale.quantity,
      unit_price: sale.unit_price,
      sale_date: isoDate
    });
    setEditSaleDateDisplay(formatDateToDDMMYYYY(isoDate));
  };

  const handleUpdateSale = async () => {
    if (!editingSale) return;

    try {
      const quantityDifference = editSaleData.quantity - editingSale.quantity;

      if (quantityDifference > 0) {
        const products = await getProducts();
        const product = products.find(p => p.id === editingSale.product_id);

        if (!product) {
          showToast('Error: Product not found.', 'error');
          return;
        }

        if (product.stock_quantity < quantityDifference) {
          showToast(`Insufficient stock!`, 'error');
          return;
        }
      }

      const totalAmount = Number(editSaleData.quantity) * Number(editSaleData.unit_price);
      const purchasePrice = (editingSale as any).products?.purchase_price || 0;
      const profit = totalAmount - (editSaleData.quantity * purchasePrice);

      const updates = {
        quantity: editSaleData.quantity,
        unit_price: editSaleData.unit_price,
        total_amount: totalAmount,
        profit: profit,
        sale_date: editSaleData.sale_date
      };

      const updatedSale = await updateSale(editingSale.id, updates);
      const displayUpdatedSale = {
        ...editingSale,
        ...updatedSale,
        product_name: (updatedSale as any).product_name || (editingSale as any).product_name || (editingSale as any).products?.name,
        products: (updatedSale as any).products || (editingSale as any).products
      };

      setAllSales(prev => prev.map(sale =>
        sale.id === editingSale.id ? displayUpdatedSale as Sale : sale
      ));
      addAuditEntry('edit_sale', editingSale.id, actionReason);
      await fetchDashboardData(true);

      if (showAllSales) {
        await fetchAllSales(allSalesPage);
      }

      showToast(`Sale updated successfully`, 'success');
      setEditingSale(null);
      setActionReason('');

    } catch (error) {
      console.error('Error updating sale:', error);
      showToast('Error updating sale.', 'error');
    }
  };

  const handleDeleteSale = async (saleId: string, saleData: Sale) => {
    const reason = prompt('Reason for deleting this sale? (required for audit)');
    if (!reason || !reason.trim()) {
      showToast('Delete reason is required', 'warning');
      return;
    }
    if (!confirm(`Are you sure you want to delete this sale?`)) {
      return;
    }

    try {
      const success = await deleteSale(saleId);
      if (!success) {
        showToast('Failed to delete sale', 'error');
        return;
      }
      setLastDeletedSale(saleData);
      addAuditEntry('delete_sale', saleId, reason.trim());
      await fetchDashboardData(true);
      if (showAllSales) {
        await fetchAllSales(allSalesPage);
      }
      showToast('Sale deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting sale:', error);
      showToast('Error deleting sale.', 'error');
    }
  };

  const handleUndoLastDelete = async () => {
    if (!lastDeletedSale) return;
    try {
      await createSale({
        product_id: lastDeletedSale.product_id,
        quantity: lastDeletedSale.quantity,
        unit_price: lastDeletedSale.unit_price,
        total_amount: lastDeletedSale.total_amount,
        profit: lastDeletedSale.profit,
        sale_date: lastDeletedSale.sale_date,
        notes: 'Restored from undo delete action'
      });
      addAuditEntry('undo_delete_sale', lastDeletedSale.id, 'Restored recently deleted sale');
      setLastDeletedSale(null);
      await fetchDashboardData(true);
      if (showAllSales) await fetchAllSales(allSalesPage);
      showToast('Last deleted sale restored', 'success');
    } catch (e) {
      console.error('Undo delete failed', e);
      showToast('Unable to restore deleted sale', 'error');
    }
  };

  const fetchAllSales = async (page: number = 1) => {
    try {
      setAllSalesLoading(true);
      const range = getFYRange(getFinancialYear());
      const effectiveStart = startDate || range.start;
      const effectiveEnd = endDate || range.end;

      console.log(`🔍 fetchAllSales: ${effectiveStart} to ${effectiveEnd}`);

      const data = await getSalesByDateRange(effectiveStart, effectiveEnd);
      console.log(`📍 fetchAllSales: Found ${data?.length || 0} items`);
      
      const sortedData = (data || []).sort((a, b) => {
        const dateCompare = b.sale_date.localeCompare(a.sale_date);
        if (dateCompare !== 0) return dateCompare;
        return (b.created_at || '').localeCompare(a.created_at || '');
      });

      setAllSalesTotal(sortedData.length);
      const from = (page - 1) * SALES_PER_PAGE;
      const paginatedData = sortedData.slice(from, from + SALES_PER_PAGE);

      setAllSales(paginatedData);
    } catch (error) {
      console.error('Error fetching sales:', error);
      setAllSales([]);
    } finally {
      setAllSalesLoading(false);
    }
  };

  const handleShowAllSales = async () => {
    if (!showAllSales) {
      setShowAllSales(true);
      setAllSalesPage(1);
      await fetchAllSales(1);
    } else {
      setShowAllSales(false);
    }
  };

  const handleFilterChange = async () => {
    setAllSalesPage(1);
    await fetchAllSales(1);
  };

  const handlePageChange = async (newPage: number) => {
    setAllSalesPage(newPage);
    await fetchAllSales(newPage);
  };

  if (loading && !showAllSales && analytics.totalProducts === 0 && analytics.totalSales === 0) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-500 font-medium">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-primary-50 min-h-screen pb-24">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome! Here's your business overview.</p>
        </div>
        <button
          onClick={handleSyncAndRefresh}
          disabled={syncing}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg ${
            syncing 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-white text-primary-600 hover:bg-primary-50 border-2 border-primary-200'
          }`}
        >
          <RefreshCw className={`h-5 w-5 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Refreshing...' : 'Sync & Refresh'}
        </button>
      </div>

      {/* Sync Health */}
      <div className="mb-6 bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase font-bold text-gray-500">Sync Health</p>
            <p className="text-sm font-semibold text-gray-900">
              Last Sync: {lastSyncTime ? new Date(lastSyncTime).toLocaleString() : 'Not synced yet'}
            </p>
          </div>
          <div className="text-sm text-gray-700">
            <span className="mr-4">Pending: {stats.isQueued ? 1 : 0}</span>
            <span className="mr-4">Failed: {stats.totalErrors}</span>
            <span>Status: {isSyncing ? 'Retrying / Syncing' : syncStatus}</span>
          </div>
        </div>
        {supabaseStatus === 'paused' && (
          <div className="mt-3 text-sm font-semibold text-orange-700 bg-orange-50 border border-orange-200 rounded-xl p-2">
            Sync is paused because Supabase project is paused. Resume project to save cloud updates.
          </div>
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Products</p>
              <p className="stat-value">{analytics.totalProducts}</p>
            </div>
            <div className="bg-primary-100 p-3 rounded-2xl">
              <Package className="h-8 w-8 text-primary-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Sales (FY)</p>
              <p className="stat-value">₹{Number(analytics.totalSales).toLocaleString()}</p>
            </div>
            <div className="bg-secondary-100 p-3 rounded-2xl">
              <DollarSign className="h-8 w-8 text-secondary-600" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Today's Sales</p>
              <p className="stat-value text-accent-600">₹{Number(analytics.todaySales).toLocaleString()}</p>
            </div>
            <div className="bg-accent-100 p-3 rounded-2xl">
              <TrendingUp className="h-8 w-8 text-accent-600" />
            </div>
          </div>
        </div>
      </div>
      {lastDeletedSale && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-xl p-3 flex items-center justify-between">
          <p className="text-sm text-yellow-800 font-medium">Sale deleted. You can undo this action.</p>
          <button onClick={handleUndoLastDelete} className="px-3 py-1.5 text-sm font-bold bg-yellow-200 hover:bg-yellow-300 rounded-lg">Undo Last Sale Delete</button>
        </div>
      )}

      {/* Low Stock Alerts */}
      {lowStockItems.length > 0 && (
        <div className="card bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
              <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
              <span className="bg-orange-600 text-white text-xs px-2 py-1 rounded-full font-bold">{lowStockItems.length}</span>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="text-sm font-bold text-orange-700 bg-white px-4 py-2 rounded-lg border border-orange-200 hover:bg-orange-100 transition-colors"
            >
              Manage Stock
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {lowStockItems.map(product => (
              <div
                key={product.id}
                className="bg-white rounded-xl p-3 border-2 border-orange-200 shadow-sm hover:shadow-md transition-all cursor-pointer"
                onClick={() => onNavigate('products')}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate">{product.name}</p>
                    <p className="text-xs text-gray-500 font-medium">Min: {product.min_stock_level}</p>
                  </div>
                  <div className="text-right ml-2">
                    <p className="font-black text-red-600 text-lg leading-none">{product.stock_quantity}</p>
                    <p className="text-[10px] uppercase font-bold text-gray-400">units</p>
                  </div>
                </div>
                <div className="mt-2 bg-orange-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-red-500 h-full transition-all"
                    style={{ width: `${Math.max(5, Math.min(100, (product.stock_quantity / product.min_stock_level) * 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Sales Section */}
      <div className="card shadow-xl border-t-4 border-t-primary-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-primary-600" />
              <h3 className="text-xl font-bold text-gray-900">Recent Sales</h3>
            </div>
            <button
              onClick={handleShowAllSales}
              className={`px-6 py-2 rounded-xl font-bold transition-all ${
                showAllSales 
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' 
                  : 'bg-primary-600 text-white hover:bg-primary-700 shadow-md'
              }`}
            >
              {showAllSales ? 'Hide History' : 'Show All Sales'}
            </button>
          </div>

          {showAllSales && (
            <div className="space-y-6">
              {/* Date Filters */}
              <div className="bg-gray-50 p-4 rounded-2xl flex flex-wrap items-end gap-4 border border-gray-100">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">From Date</label>
                  <input
                    type="text"
                    value={startDateDisplay}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d{0,2}\/?\d{0,2}\/?\d{0,4}$/.test(value)) {
                        setStartDateDisplay(value);
                        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                          const isoDate = parseDDMMYYYYToISO(value);
                          if (isoDate) setStartDate(isoDate);
                        }
                      }
                    }}
                    onBlur={() => {
                      if (startDateDisplay && !/^\d{2}\/\d{2}\/\d{4}$/.test(startDateDisplay)) {
                        setStartDateDisplay(startDate ? formatDateToDDMMYYYY(startDate) : '');
                      }
                    }}
                    placeholder="dd/mm/yyyy"
                    className="input-field text-sm w-40 text-gray-900 bg-white"
                    maxLength={10}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-bold text-gray-500 uppercase ml-1">To Date</label>
                  <input
                    type="text"
                    value={endDateDisplay}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^\d{0,2}\/?\d{0,2}\/?\d{0,4}$/.test(value)) {
                        setEndDateDisplay(value);
                        if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                          const isoDate = parseDDMMYYYYToISO(value);
                          if (isoDate) setEndDate(isoDate);
                        }
                      }
                    }}
                    onBlur={() => {
                      if (endDateDisplay && !/^\d{2}\/\d{2}\/\d{4}$/.test(endDateDisplay)) {
                        setEndDateDisplay(formatDateToDDMMYYYY(endDate));
                      }
                    }}
                    placeholder="dd/mm/yyyy"
                    className="input-field text-sm w-40 text-gray-900 bg-white"
                    maxLength={10}
                  />
                </div>
                <button
                  onClick={handleFilterChange}
                  className="bg-primary-600 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-primary-700 transition-all shadow-md active:scale-95"
                >
                  Apply Filter
                </button>
              </div>

              {/* Sales List - Grouped by Date */}
              <div className="space-y-4">
                {allSalesLoading ? (
                  <div className="text-center py-12">
                    <div className="animate-spin h-8 w-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-gray-500 font-medium">Fetching sales records...</p>
                  </div>
                ) : allSales.length === 0 ? (
                  <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                    <p className="text-gray-400 font-medium italic">No sales found for this period.</p>
                    <p className="text-xs text-gray-400 mt-1">Try changing the dates or clicking "Sync & Refresh".</p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-[500px] overflow-y-auto pr-2 space-y-6 custom-scrollbar">
                      {(() => {
                        const salesByDate: Record<string, Sale[]> = allSales.reduce((groups: Record<string, Sale[]>, sale) => {
                          // Safe date parsing
                          const d = new Date(sale.sale_date);
                          const date = isNaN(d.getTime()) 
                            ? sale.sale_date 
                            : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                          
                          if (!groups[date]) groups[date] = [];
                          groups[date].push(sale);
                          return groups;
                        }, {});

                        const sortedDates = Object.keys(salesByDate).sort((a, b) => {
                          const dateA = new Date(salesByDate[a][0].sale_date).getTime();
                          const dateB = new Date(salesByDate[b][0].sale_date).getTime();
                          return dateB - dateA;
                        });

                        return sortedDates.map(date => {
                          const dateSales = salesByDate[date];
                          const dateTotal = dateSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
                          const dateProfit = dateSales.reduce((sum, sale) => sum + Number(sale.profit || 0), 0);

                          return (
                            <div key={date} className="border-2 border-gray-100 rounded-3xl overflow-hidden shadow-sm bg-white">
                              <div className="bg-primary-50 border-b border-primary-100 px-5 py-4">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-black text-gray-900 text-lg">{date}</p>
                                    <p className="text-xs text-primary-600 font-bold uppercase tracking-wider">{dateSales.length} Transactions</p>
                                  </div>
                                  <div className="text-right">
                                    <p className="font-black text-secondary-600 text-xl leading-none">₹{dateTotal.toFixed(2)}</p>
                                    <p className="text-[10px] font-bold text-accent-600 uppercase mt-1">Profit: ₹{dateProfit.toFixed(2)}</p>
                                  </div>
                                </div>
                              </div>

                              <div className="divide-y divide-gray-50">
                                {dateSales.map(sale => (
                                  <div key={sale.id} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors group">
                                    <div className="flex-1">
                                      <p className="font-bold text-gray-900">{(sale as any).product_name || (sale as any).products?.name || 'Unknown Product'}</p>
                                      <p className="text-xs text-gray-500 font-medium">
                                        Qty: <span className="text-gray-900 font-bold">{sale.quantity}</span> • 
                                        Rate: <span className="text-gray-900 font-bold">₹{sale.unit_price}</span>
                                      </p>
                                    </div>
                                    <div className="text-right mr-4">
                                      <p className="font-black text-gray-900">₹{Number(sale.total_amount).toFixed(2)}</p>
                                      <p className="text-[10px] font-black text-secondary-600 uppercase">+₹{Number(sale.profit).toFixed(2)}</p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={() => handleEditSale(sale)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                                        title="Edit"
                                      >
                                        <Edit className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteSale(sale.id, sale)}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                        title="Delete"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {allSalesTotal > SALES_PER_PAGE && (
                      <div className="flex justify-center gap-3 mt-8">
                        <button
                          onClick={() => handlePageChange(Math.max(1, allSalesPage - 1))}
                          disabled={allSalesPage === 1}
                          className="bg-white border-2 border-gray-200 text-gray-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          Previous
                        </button>
                        <div className="flex items-center bg-primary-100 px-4 py-2 rounded-xl font-black text-primary-700">
                          Page {allSalesPage} / {Math.ceil(allSalesTotal / SALES_PER_PAGE)}
                        </div>
                        <button
                          onClick={() => handlePageChange(allSalesPage + 1)}
                          disabled={allSalesPage * SALES_PER_PAGE >= allSalesTotal}
                          className="bg-white border-2 border-gray-200 text-gray-600 px-6 py-2 rounded-xl font-bold hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                          Next
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

      {/* Quick Actions */}
      <div className="fixed bottom-24 right-8 flex flex-col gap-4 z-40">
        <button
          onClick={() => onNavigate('quick-sale')}
          className="group bg-primary-600 hover:bg-primary-700 text-white rounded-2xl p-5 shadow-2xl hover:shadow-primary-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
          title="Quick Sale"
        >
          <ShoppingCart className="h-7 w-7" />
        </button>
        <button
          onClick={() => onNavigate('products')}
          className="group bg-secondary-600 hover:bg-secondary-700 text-white rounded-2xl p-5 shadow-2xl hover:shadow-secondary-500/50 transition-all duration-300 hover:scale-110 active:scale-95"
          title="Go to Products"
        >
          <Plus className="h-7 w-7" />
        </button>
      </div>

      {/* Edit Sale Modal */}
      {editingSale && (
        <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl border border-gray-100 animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-black text-gray-900">Edit Transaction</h3>
              <button
                onClick={() => setEditingSale(null)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-gray-400" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Product Item
                </label>
                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100">
                  <p className="text-lg font-black text-gray-900">
                    {(editingSale as any).product_name || (editingSale as any).products?.name || 'Unknown Product'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editSaleData.quantity}
                    onChange={(e) => setEditSaleData({ ...editSaleData, quantity: parseInt(e.target.value) || 0 })}
                    className="input-field w-full font-bold text-lg"
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                    Rate (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={editSaleData.unit_price}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEditSaleData({ ...editSaleData, unit_price: value === '' ? 0 : parseFloat(value) });
                    }}
                    className="input-field w-full font-bold text-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Sale Date
                </label>
                  <input
                    type="text"
                    value={editSaleDateDisplay}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d{0,2}\/?\d{0,2}\/?\d{0,4}$/.test(value)) {
                      setEditSaleDateDisplay(value);
                      if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
                        const isoDate = parseDDMMYYYYToISO(value);
                        if (isoDate) setEditSaleData({ ...editSaleData, sale_date: isoDate });
                      }
                    }
                  }}
                  onBlur={() => setEditSaleDateDisplay(formatDateToDDMMYYYY(editSaleData.sale_date))}
                  placeholder="dd/mm/yyyy"
                  className="input-field w-full font-bold"
                  maxLength={10}
                  />
              </div>
              <div>
                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-1.5 ml-1">
                  Edit Reason (for audit)
                </label>
                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="e.g. Wrong quantity entered"
                  className="input-field w-full font-bold"
                />
              </div>

              <div className="bg-primary-50 p-5 rounded-[24px] border border-primary-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-primary-500 uppercase tracking-widest mb-1">New Total Amount</p>
                  <p className="text-3xl font-black text-gray-900">
                    ₹{(editSaleData.quantity * editSaleData.unit_price).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-secondary-500 uppercase tracking-widest mb-1">Profit</p>
                  <p className="text-lg font-black text-secondary-600">
                    +₹{((editSaleData.quantity * editSaleData.unit_price) - (editSaleData.quantity * (editingSale.products?.purchase_price || 0))).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex gap-4 pt-2">
                <button
                  onClick={() => setEditingSale(null)}
                  className="flex-1 bg-gray-50 text-gray-600 py-4 rounded-[20px] font-black hover:bg-gray-100 transition-all border border-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateSale}
                  disabled={!actionReason.trim()}
                  className="flex-1 bg-primary-600 text-white py-4 rounded-[20px] font-black hover:bg-primary-700 transition-all shadow-lg active:scale-95"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {auditEntries.length > 0 && (
        <div className="mt-8 bg-white border border-gray-100 rounded-2xl p-4 shadow-sm">
          <p className="text-sm font-bold text-gray-900 mb-2">Recent audit trail</p>
          <div className="space-y-1">
            {auditEntries.slice(0, 5).map((entry) => (
              <p key={entry.id} className="text-xs text-gray-600">
                {new Date(entry.at).toLocaleString()} • {entry.action} • {entry.reason}
              </p>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
