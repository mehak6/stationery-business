'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Plus,
  Search,
  BarChart3,
  Edit,
  Trash2,
  X,
  Check,
  History,
  Calendar,
  AlertCircle,
  TrendingUp,
  ShoppingCart
} from 'lucide-react';
import {
  getProducts,
  updateProduct,
  deleteProduct,
  createProduct,
  resetAllProductsStock,
  getClosingStockForYear,
  getSalesByProduct,
  getPartyPurchases,
  adjustProductStock,
  type StockAdjustmentMode
} from 'lib/offline-adapter';
import { addProductHistory, getProductHistory, removeHistoryEntry } from 'lib/product-history';
import { formatDateToDisplay, parseDisplayDate } from 'lib/date-utils';
import type { Product, ProductInsert, PartyPurchase } from 'supabase_client';
import { useToast } from 'app/context/ToastContext';

interface ProductManagementProps {
  onNavigate: (view: string) => void;
}

export default function ProductManagement({ onNavigate }: ProductManagementProps) {
  const { showToast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkEntry, setShowBulkEntry] = useState(false);
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
  const [showHistory, setShowHistory] = useState(false);
  const [showAddStock, setShowAddStock] = useState(false);
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<Product | null>(null);
  const [selectedProductForAddStock, setSelectedProductForAddStock] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<string | null>(null);
  const [tempValue, setTempValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [financialYear, setFinancialYear] = useState('2026-27');
  const [historicalStock, setHistoricalStock] = useState<Record<string, number>>({});
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const isCurrentYear = financialYear === '2026-27';
  const currentMonth = new Date().getMonth(); // 0-indexed
  const isMarch = currentMonth === 2;
  const resetStorageKey = `stock_reset_${financialYear}`;

  const [undoData, setUndoData] = useState<{
    productId: string;
    fieldName: string;
    oldValue: any;
    newValue: any;
    productName: string;
  } | null>(null);
  const [showUndo, setShowUndo] = useState(false);

  // Fetch products and historical stock
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const productsData = await getProducts();
        setProducts(productsData || []);

        if (!isCurrentYear) {
          const closingData = await getClosingStockForYear(financialYear);
          setHistoricalStock(closingData || {});
        } else {
          setHistoricalStock({});
        }
      } catch (error) {
        console.error('Error fetching data:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [financialYear, isCurrentYear]);

  const handleResetStock = async () => {
    setIsResetting(true);
    try {
      const success = await resetAllProductsStock(financialYear);
      if (success) {
        // Save current products as closing stock for 2025-26 locally for immediate UI update
        const closingData: Record<string, number> = {};
        products.forEach(p => closingData[p.id] = p.stock_quantity);
        
        const updatedProducts = products.map(p => ({ ...p, stock_quantity: 0 }));
        setProducts(updatedProducts);
        showToast(`All stock reset to 0 for ${financialYear}. 2025-26 data preserved.`, 'success');
        localStorage.setItem(resetStorageKey, 'true');
        setShowResetConfirm(false);
      } else {
        showToast('Failed to reset stock. Please try again.', 'error');
      }
    } catch (error) {
      console.error('Error resetting stock:', error);
      showToast('Error resetting stock', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const filteredProducts = products
    .filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    })
    .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

  const handleDeleteProduct = async (productId: string) => {
    if (!isCurrentYear) {
      showToast('Deletions are not allowed in historical records.', 'error');
      return;
    }
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteProduct(productId);
      setProducts(products.filter(p => p.id !== productId));
      showToast('Product deleted successfully', 'success');
    } catch (error) {
      console.error('Error deleting product:', error);
      showToast('Error deleting product', 'error');
    }
  };

  const startEditing = (productId: string, fieldName: string, currentValue: any) => {
    if (!isCurrentYear) {
      showToast('Editing is not allowed in historical records.', 'error');
      return;
    }
    if (fieldName === 'stock_quantity') {
      const product = products.find(p => p.id === productId);
      if (product) {
        setSelectedProductForAddStock(product);
        setShowAddStock(true);
      }
      return;
    }
    setEditingProduct(productId);
    setEditingField(fieldName);
    setTempValue(currentValue?.toString() || '');
  };

  const cancelEditing = () => {
    setEditingProduct(null);
    setEditingField(null);
    setTempValue('');
  };

  const saveEdit = async (productId: string, fieldName: string, newValue: string) => {
    if (!newValue.trim() || newValue === '') {
      cancelEditing();
      return;
    }

    setSaving(true);
    try {
      let processedValue: any = newValue;
      if (fieldName === 'purchase_price' || fieldName === 'selling_price') {
        processedValue = parseFloat(newValue);
        if (isNaN(processedValue) || processedValue < 0) {
          setSaving(false);
          return;
        }
      } else if (fieldName === 'stock_quantity' || fieldName === 'min_stock_level') {
        processedValue = parseInt(newValue);
        if (isNaN(processedValue) || processedValue < 0) {
          setSaving(false);
          return;
        }
      } else if (fieldName === 'name') {
        processedValue = newValue.trim().toUpperCase();
        if (processedValue.length < 2) {
          setSaving(false);
          return;
        }
      }

      const currentProduct = products.find(p => p.id === productId);
      if (!currentProduct) return;

      const updates: Partial<ProductInsert> = {
        [fieldName]: processedValue
      };

      await updateProduct(productId, updates);

      if (fieldName === 'stock_quantity') {
        const stockBefore = currentProduct.stock_quantity;
        const stockAfter = processedValue;
        const change = stockAfter - stockBefore;

        if (change !== 0) {
          await addProductHistory({
            product_id: productId,
            product_name: currentProduct.name,
            action: change > 0 ? 'stock_added' : 'stock_updated',
            quantity_change: change,
            stock_before: stockBefore,
            stock_after: stockAfter,
            notes: change > 0
              ? `Added ${change} units to stock`
              : `Reduced stock by ${Math.abs(change)} units`
          });
        }
      }

      setProducts(products.map(p =>
        p.id === productId ? { ...p, [fieldName]: processedValue } : p
      ));

      setUndoData({
        productId: productId,
        fieldName: fieldName,
        oldValue: (currentProduct as any)[fieldName],
        newValue: processedValue,
        productName: currentProduct.name
      });

      setShowUndo(true);
      setTimeout(() => {
        setShowUndo(false);
        setUndoData(null);
      }, 5000);

      cancelEditing();
    } catch (error) {
      console.error('Error updating product:', error);
      showToast('Error updating product. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleUndo = async () => {
    if (!undoData) return;

    try {
      const { productId, fieldName, oldValue, productName } = undoData;
      await updateProduct(productId, { [fieldName]: oldValue });
      setProducts(products.map(p =>
        p.id === productId ? { ...p, [fieldName]: oldValue } : p
      ));
      setShowUndo(false);
      setUndoData(null);
      showToast(`Undone: ${productName} - ${fieldName} reverted to previous value`, 'success');
    } catch (error) {
      console.error('Error undoing change:', error);
      showToast('Error undoing change. Please try again.', 'error');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, productId: string, fieldName: string) => {
    if (e.key === 'Enter') {
      saveEdit(productId, fieldName, tempValue);
    } else if (e.key === 'Escape') {
      cancelEditing();
    }
  };

  const getDisplayStock = (product: Product) => {
    if (isCurrentYear) return product.stock_quantity;
    return historicalStock[product.id] ?? 0;
  };

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Products</h1>
            <p className="text-gray-600 mt-2">Manage your inventory items</p>
          </div>
          <div className="bg-white border-2 border-primary-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm">
            <Calendar className="h-5 w-5 text-primary-600" />
            <div className="flex flex-col">
              <span className="text-[10px] uppercase font-bold text-gray-400 leading-none mb-1">Financial Year</span>
              <select 
                value={financialYear}
                onChange={(e) => setFinancialYear(e.target.value)}
                className="bg-transparent text-sm font-bold text-primary-900 focus:outline-none cursor-pointer"
              >
                <option value="2025-26">2025-26 (Legacy)</option>
                <option value="2026-27">2026-27 (Current)</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={() => setShowBulkEntry(true)}
            disabled={!isCurrentYear}
            className={`btn-outline flex items-center ${!isCurrentYear ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Package className="h-5 w-5 mr-2" />
            Bulk Entry
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            disabled={!isCurrentYear}
            className={`bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg flex items-center ${!isCurrentYear ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Product
          </button>
        </div>
      </div>

      {!isCurrentYear && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl flex items-center gap-3 text-orange-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p className="text-sm">You are viewing <strong>Historical Data</strong> for FY {financialYear}. Records are read-only. Switch to 2026-27 to make changes.</p>
        </div>
      )}

      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('card')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                viewMode === 'card'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="Card View"
            >
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Card</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-lg flex items-center gap-2 ${
                viewMode === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              title="List View"
            >
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>
        </div>

        {isCurrentYear && isMarch && typeof window !== 'undefined' && !localStorage.getItem(resetStorageKey) && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-full">
                <Calendar className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900">New Financial Year Detected</h4>
                <p className="text-sm text-blue-700">Select this option to clear all current stock levels and start fresh for 2026-27. <strong>All 2025-26 stock will be preserved as historical closing data.</strong></p>
              </div>
            </div>
            <button 
              onClick={() => setShowResetConfirm(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all shadow-md whitespace-nowrap"
            >
              Reset Stock Now
            </button>
          </div>
        )}
      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-[10000] backdrop-blur-sm">
          <div className="bg-white rounded-2xl max-md w-full p-6 shadow-2xl border border-red-100">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <div className="bg-red-100 p-2 rounded-full">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-bold">Confirm Stock Reset</h3>
            </div>
            <p className="text-gray-600 mb-6 leading-relaxed">
              Are you sure you want to reset all stock to <span className="font-bold text-gray-900">EMPTY (0)</span> for the financial year <span className="font-bold text-gray-900">{financialYear}</span>? 
              <br /><br />
              Current stock levels will be saved as <strong>Closing Stock for 2025-26</strong>. Prices will not be changed.
            </p>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowResetConfirm(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleResetStock}
                disabled={isResetting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors shadow-lg disabled:opacity-50"
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset All Stock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className={viewMode === 'card' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6' : 'space-y-3'}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card h-48 animate-pulse bg-gray-100"></div>
          ))}
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          <div className="card bg-gray-50 border-b-2 border-gray-200 hidden sm:block">
            <div className="flex items-center justify-between">
              <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                <div className="col-span-2">
                  <h3 className="font-semibold text-gray-700 text-sm">Product Name</h3>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm">Purchase Price</h3>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm">Selling Price</h3>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-700 text-sm">Stock</h3>
                </div>
              </div>
              <div className="w-24 text-center">
                <h3 className="font-semibold text-gray-700 text-sm">Actions</h3>
              </div>
            </div>
          </div>

          {filteredProducts.map(product => {
            const stock = getDisplayStock(product);
            return (
              <div key={product.id} className={`card hover:shadow-md transition-shadow ${!isCurrentYear ? 'bg-gray-50 opacity-90' : ''}`}>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 items-center">
                    <div className="sm:col-span-2">
                      {editingProduct === product.id && editingField === 'name' ? (
                        <input
                          type="text"
                          value={tempValue}
                          onChange={(e) => setTempValue(e.target.value.toUpperCase())}
                          onKeyDown={(e) => handleKeyPress(e, product.id, 'name')}
                          className="w-full px-2 py-1 border border-blue-300 rounded font-semibold uppercase text-sm focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <div>
                          <h3
                            className={`font-semibold text-gray-900 ${isCurrentYear ? 'cursor-pointer hover:bg-blue-50 px-2 py-1 rounded inline-block hover:text-blue-700 transition-colors' : ''} text-sm sm:text-base`}
                            onClick={() => startEditing(product.id, 'name', product.name)}
                          >
                            {product.name}
                          </h3>
                          <p className="text-xs text-gray-500">Code: {product.barcode || 'N/A'}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 sm:hidden">Purchase: </span>
                      <span className="text-gray-500">₹</span>
                      {editingProduct === product.id && editingField === 'purchase_price' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={tempValue}
                          onChange={(e) => setTempValue(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, product.id, 'purchase_price')}
                          className="w-20 px-2 py-1 border border-primary-300 rounded text-sm"
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`font-medium ${isCurrentYear ? 'cursor-pointer hover:bg-primary-50 px-2 py-1 rounded' : ''} text-primary-700`}
                          onClick={() => startEditing(product.id, 'purchase_price', product.purchase_price)}
                        >
                          {product.purchase_price}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500 sm:hidden">Selling: </span>
                      <span className="text-gray-500">₹</span>
                      {editingProduct === product.id && editingField === 'selling_price' ? (
                        <input
                          type="number"
                          step="0.01"
                          value={tempValue}
                          onChange={(e) => setTempValue(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, product.id, 'selling_price')}
                          className="w-20 px-2 py-1 border border-secondary-300 rounded text-sm"
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`font-medium ${isCurrentYear ? 'cursor-pointer hover:bg-secondary-50 px-2 py-1 rounded' : ''} text-secondary-700`}
                          onClick={() => startEditing(product.id, 'selling_price', product.selling_price)}
                        >
                          {product.selling_price}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-500 sm:hidden">Stock: </span>
                      {editingProduct === product.id && editingField === 'stock_quantity' ? (
                        <input
                          type="number"
                          value={tempValue}
                          onChange={(e) => setTempValue(e.target.value)}
                          onKeyDown={(e) => handleKeyPress(e, product.id, 'stock_quantity')}
                          className="w-16 px-2 py-1 border border-accent-300 rounded text-sm"
                          autoFocus
                        />
                      ) : (
                        <span
                          className={`font-medium ${isCurrentYear ? 'cursor-pointer hover:bg-accent-50 px-2 py-1 rounded' : ''} ${
                            stock <= product.min_stock_level ? 'text-red-600' : 'text-accent-700'
                          }`}
                          onClick={() => startEditing(product.id, 'stock_quantity', product.stock_quantity)}
                        >
                          {stock}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    {editingProduct === product.id && (
                      <>
                        <button
                          onClick={() => saveEdit(editingProduct!, editingField!, tempValue)}
                          disabled={saving}
                          className="p-1 text-green-600 hover:text-green-800"
                        >
                          <Check className="h-5 w-5" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={saving}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        console.log('📜 Opening history for:', product.name);
                        setSelectedProductForHistory(product);
                        setShowHistory(true);
                      }}
                      className="p-1 text-gray-400 hover:text-primary-600"
                      title="View History"
                    >
                      <History className="h-5 w-5" />
                    </button>
                    {isCurrentYear && (
                      <button
                        onClick={() => {
                          setSelectedProductForAddStock(product);
                          setShowAddStock(true);
                        }}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Adjust Stock"
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    )}
                    {isCurrentYear && (
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete Product"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map(product => {
            const stock = getDisplayStock(product);
            return (
              <div key={product.id} className={`card hover:shadow-md transition-shadow ${!isCurrentYear ? 'bg-gray-50' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs text-gray-500">
                    {!isCurrentYear ? 'Read-only history' : (editingProduct === product.id ? 'Editing...' : 'Click values to edit')}
                  </div>
                  <div className="flex gap-2">
                    {editingProduct === product.id && (
                      <>
                        <button 
                          onClick={() => saveEdit(editingProduct!, editingField!, tempValue)}
                          disabled={saving}
                          className="p-1 text-green-600 hover:text-green-800"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={cancelEditing}
                          disabled={saving}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => {
                        console.log('📜 [Card View] Opening history for:', product.name);
                        setSelectedProductForHistory(product);
                        setShowHistory(true);
                      }}
                      className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-full transition-all"
                      title="View History"
                    >
                      <History className="h-5 w-5" />
                    </button>
                    {isCurrentYear && (
                      <button
                        onClick={() => {
                          setSelectedProductForAddStock(product);
                          setShowAddStock(true);
                        }}
                        className="p-1 text-gray-400 hover:text-green-600"
                        title="Adjust Stock"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    )}
                    {isCurrentYear && (
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete Product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  {editingProduct === product.id && editingField === 'name' ? (
                    <input
                      type="text"
                      value={tempValue}
                      onChange={(e) => setTempValue(e.target.value.toUpperCase())}
                      onKeyDown={(e) => handleKeyPress(e, product.id, 'name')}
                      className="w-full px-2 py-1 border border-blue-300 rounded font-semibold uppercase"
                      autoFocus
                    />
                  ) : (
                    <h3
                      className={`font-semibold text-gray-900 ${isCurrentYear ? 'cursor-pointer hover:bg-blue-50 px-2 py-1 rounded inline-block' : ''}`}
                      onClick={() => startEditing(product.id, 'name', product.name)}
                    >
                      {product.name}
                    </h3>
                  )}
                  <p className="text-sm text-gray-500">Code: {product.barcode || 'N/A'}</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Purchase:</span>
                    {editingProduct === product.id && editingField === 'purchase_price' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, product.id, 'purchase_price')}
                        className="w-20 px-2 py-1 border border-primary-300 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span 
                        className={`font-medium ${isCurrentYear ? 'cursor-pointer hover:bg-primary-50 px-2 py-1 rounded' : ''} text-primary-700`}
                        onClick={() => startEditing(product.id, 'purchase_price', product.purchase_price)}
                      >
                        ₹{product.purchase_price}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Selling:</span>
                    {editingProduct === product.id && editingField === 'selling_price' ? (
                      <input
                        type="number"
                        step="0.01"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, product.id, 'selling_price')}
                        className="w-20 px-2 py-1 border border-secondary-300 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span 
                        className={`font-medium text-secondary-600 ${isCurrentYear ? 'cursor-pointer hover:bg-secondary-50 px-2 py-1 rounded' : ''}`}
                        onClick={() => startEditing(product.id, 'selling_price', product.selling_price)}
                      >
                        ₹{product.selling_price}
                      </span>
                    )}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Stock:</span>
                    {editingProduct === product.id && editingField === 'stock_quantity' ? (
                      <input
                        type="number"
                        value={tempValue}
                        onChange={(e) => setTempValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, product.id, 'stock_quantity')}
                        className="w-16 px-2 py-1 border border-accent-300 rounded text-sm"
                        autoFocus
                      />
                    ) : (
                      <span 
                        className={`font-medium ${isCurrentYear ? 'cursor-pointer px-2 py-1 rounded' : ''} ${
                          stock <= product.min_stock_level ? 'text-red-600' : 'text-gray-900'
                        }`}
                        onClick={() => startEditing(product.id, 'stock_quantity', product.stock_quantity)}
                      >
                        {stock} units
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showHistory && selectedProductForHistory && (
        <ProductHistoryModal
          product={selectedProductForHistory}
          onClose={() => {
            setShowHistory(false);
            setSelectedProductForHistory(null);
          }}
        />
      )}

      {showAddForm && (
        <AddProductModal
          onClose={() => setShowAddForm(false)}
          onProductAdded={(newProduct) => {
            setProducts([newProduct, ...products]);
            setShowAddForm(false);
          }}
        />
      )}

      {showBulkEntry && (
        <BulkProductEntryModal
          onClose={() => setShowBulkEntry(false)}
          onProductsAdded={(newProducts) => {
            setProducts([...newProducts, ...products]);
            setShowBulkEntry(false);
          }}
        />
      )}

      {showAddStock && selectedProductForAddStock && (
        <AddStockModal
          product={selectedProductForAddStock}
          onClose={() => {
            setShowAddStock(false);
            setSelectedProductForAddStock(null);
          }}
          onStockUpdated={(updatedProduct) => {
            setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
            setShowAddStock(false);
            setSelectedProductForAddStock(null);
          }}
        />
      )}

      {/* Undo Toast */}
      {showUndo && undoData && (
        <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-50">
          <div className="bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
            <span>Updated {undoData.productName}</span>
            <button
              onClick={handleUndo}
              className="text-primary-400 font-bold hover:text-primary-300"
            >
              UNDO
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Internal Modal Components
function ProductHistoryModal({ product, onClose }: { product: Product; onClose: () => void }) {
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();

  const fetchHistory = async () => {
    try {
      setLoading(true);
      console.log(`🔍 Fetching unified history for: ${product.name} (${product.id})`);
      
      const [historyData, salesData] = await Promise.all([
        getProductHistory(product.id).catch(err => {
          console.error('History fetch failed:', err);
          return [];
        }),
        getSalesByProduct(product.id).catch(err => {
          console.error('Sales fetch failed:', err);
          return [];
        })
      ]);

      // Map sales to history entry format
      const mappedSales = (salesData || []).map(sale => ({
        id: sale.id || `sale_${Math.random()}`,
        product_id: sale.product_id,
        product_name: product.name,
        action: 'sale',
        quantity_change: -(Number(sale.quantity) || 0),
        stock_before: 0,
        stock_after: 0,
        date: sale.sale_date || sale.created_at,
        notes: `Sold ${sale.quantity} units for ₹${Number(sale.total_amount).toFixed(2)}${sale.customer_info ? ` to ${sale.customer_info}` : ''}`,
        is_sale_record: true
      }));

      const unifiedHistory = [...(historyData || []), ...mappedSales].sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });

      setHistory(unifiedHistory);
    } catch (error) {
      console.error('Error in fetchHistory:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [product.id, product.name]);

  const handleDeleteEntry = async (entryId: string, isSale: boolean) => {
    if (isSale) {
      showToast('Sale records must be deleted from the Reports/Sales tab.', 'warning');
      return;
    }

    if (!confirm('Are you sure you want to delete this history entry? This will not affect current stock.')) {
      return;
    }

    try {
      await removeHistoryEntry(entryId);
      showToast('History entry deleted', 'success');
      fetchHistory(); // Refresh
    } catch (error) {
      showToast('Error deleting entry', 'error');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
      <div className="bg-white rounded-[32px] max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-8 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black text-gray-900">History & Transactions</h2>
              <p className="text-sm font-bold text-primary-600 mt-1 uppercase tracking-wider">{product.name}</p>
            </div>
            <button 
              onClick={onClose} 
              className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="h-6 w-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/50">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin h-10 w-10 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-500 font-bold">Assembling timeline...</p>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-[24px] border-2 border-dashed border-gray-200">
              <Package className="h-16 w-16 mx-auto text-gray-200 mb-4" />
              <p className="text-gray-400 font-bold italic text-lg">No activity recorded for this product.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((entry) => {
                const actionStr = String(entry.action || 'update');
                const isSale = !!entry.is_sale_record;
                const actionLabel = actionStr.replace(/_/g, ' ');
                
                return (
                  <div 
                    key={entry.id} 
                    className={`border-l-8 ${isSale ? 'border-secondary-500 bg-white' : 'border-primary-500 bg-white'} p-5 rounded-2xl shadow-sm hover:shadow-md transition-all border border-gray-100 group relative`}
                  >
                    {!isSale && (
                      <button 
                        onClick={() => handleDeleteEntry(entry.id, false)}
                        className="absolute right-4 top-4 p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all bg-red-50 rounded-lg"
                        title="Delete this entry"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md tracking-widest ${isSale ? 'bg-secondary-100 text-secondary-700' : 'bg-primary-100 text-primary-700'}`}>
                            {actionLabel}
                          </span>
                          <span className="text-xs font-bold text-gray-400">
                            {(() => {
                              try {
                                const d = new Date(entry.date || Date.now());
                                return isNaN(d.getTime()) ? 'Invalid Date' : d.toLocaleString('en-IN', {
                                  day: '2-digit', month: 'short', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                });
                              } catch (e) {
                                return 'Invalid Date';
                              }
                            })()}
                          </span>
                        </div>
                        <div className="text-base text-gray-800 font-black">
                          {isSale ? (
                            <span className="text-gray-900">
                              {Math.abs(entry.quantity_change)} Items Sold
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>Stock: {entry.stock_before}</span>
                              <TrendingUp className="h-3 w-3 text-gray-400" />
                              <span>{entry.stock_after}</span>
                              <span className={`ml-2 px-2 py-0.5 rounded-lg text-xs ${Number(entry.quantity_change) >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {Number(entry.quantity_change) >= 0 ? '+' : ''}{entry.quantity_change}
                              </span>
                            </div>
                          )}
                        </div>
                        {entry.notes && (
                          <p className={`text-sm mt-2 p-2 rounded-xl ${isSale ? 'bg-secondary-50 text-secondary-800 font-medium' : 'bg-gray-50 text-gray-500 italic'}`}>
                            {entry.notes}
                          </p>
                        )}
                      </div>
                      {isSale && (
                        <div className="bg-secondary-50 p-3 rounded-2xl border border-secondary-100">
                          <ShoppingCart className="h-6 w-6 text-secondary-600" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="p-8 border-t border-gray-100 bg-white text-center">
          <button 
            onClick={onClose}
            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-black hover:bg-gray-800 transition-all shadow-lg"
          >
            Close History
          </button>
        </div>
      </div>
    </div>
  );
}

function AddProductModal({ onClose, onProductAdded }: { onClose: () => void; onProductAdded: (p: Product) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    purchase_price: '',
    selling_price: '',
    stock_quantity: '',
    min_stock_level: '5',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [displayDate, setDisplayDate] = useState(formatDateToDisplay(formData.date));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const productData: ProductInsert = {
        name: formData.name.toUpperCase(),
        barcode: formData.barcode || null,
        purchase_price: parseFloat(formData.purchase_price),
        selling_price: parseFloat(formData.selling_price),
        stock_quantity: parseInt(formData.stock_quantity),
        min_stock_level: parseInt(formData.min_stock_level) || 5,
        description: formData.description || null,
        category_id: null
      };

      const newProduct = await createProduct(productData);
      
      await addProductHistory({
        product_id: newProduct.id,
        product_name: newProduct.name,
        action: 'created',
        quantity_change: newProduct.stock_quantity,
        stock_before: 0,
        stock_after: newProduct.stock_quantity,
        date: formData.date,
        notes: `Product created with initial stock of ${newProduct.stock_quantity}`
      });

      onProductAdded(newProduct);
    } catch (error) {
      console.error('Error adding product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input
                  ref={nameInputRef}
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})}
                  className="input-field uppercase"
                  placeholder="Enter product name"
                />
              </div>
              <div className="col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Date (dd/mm/yyyy) *</label>
                <input
                  type="text"
                  required
                  value={displayDate}
                  onChange={(e) => {
                    setDisplayDate(e.target.value);
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) {
                      setFormData({...formData, date: parseDisplayDate(e.target.value)});
                    }
                  }}
                  className="input-field"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                className="input-field"
                placeholder="Scan or enter barcode"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.selling_price}
                  onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  className="input-field"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Initial Stock *</label>
                <input
                  type="number"
                  required
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Min Stock Level</label>
                <input
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})}
                  className="input-field"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-outline flex-1">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                {isSubmitting ? 'Adding...' : 'Add Product'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function BulkProductEntryModal({ onClose, onProductsAdded }: { onClose: () => void; onProductsAdded: (p: Product[]) => void }) {
  const [entries, setEntries] = useState([
    { id: 1, name: '', barcode: '', purchase_price: '', selling_price: '', stock_quantity: '', min_stock_level: '5' }
  ]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [displayDate, setDisplayDate] = useState(formatDateToDisplay(entryDate));
  const [saving, setSaving] = useState(false);

  const addNewRow = () => {
    const newId = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : 1;
    setEntries([...entries, { id: newId, name: '', barcode: '', purchase_price: '', selling_price: '', stock_quantity: '', min_stock_level: '5' }]);
  };

  const removeRow = (id: number) => {
    if (entries.length > 1) {
      setEntries(entries.filter(e => e.id !== id));
    }
  };

  const updateEntry = (id: number, field: string, value: string) => {
    setEntries(entries.map(e =>
      e.id === id ? { ...e, [field]: field === 'name' ? value.toUpperCase() : value } : e
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validEntries = entries.filter(entry => entry.name.trim() && entry.purchase_price && entry.selling_price && entry.stock_quantity);
    if (validEntries.length === 0) return;

    setSaving(true);
    try {
      const createdProducts = [];
      const historyEntries = [];
      for (const entry of validEntries) {
        const productData: ProductInsert = {
          name: entry.name.trim().toUpperCase(),
          barcode: entry.barcode || null,
          purchase_price: parseFloat(entry.purchase_price),
          selling_price: parseFloat(entry.selling_price),
          stock_quantity: parseInt(entry.stock_quantity),
          min_stock_level: parseInt(entry.min_stock_level) || 5,
          category_id: null
        };

        const newProduct = await createProduct(productData);
        createdProducts.push(newProduct);

        historyEntries.push({
          product_id: newProduct.id,
          product_name: newProduct.name,
          action: 'created' as any,
          quantity_change: newProduct.stock_quantity,
          stock_before: 0,
          stock_after: newProduct.stock_quantity,
          date: entryDate,
          notes: `Product created via bulk entry`
        });
      }

      const { addProductHistoryBulk } = await import('lib/product-history');
      await addProductHistoryBulk(historyEntries);

      onProductsAdded(createdProducts);
    } catch (error) {
      console.error('Error in bulk entry:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
            <h2 className="text-xl font-bold text-gray-900">Bulk Product Entry</h2>
            <div className="flex items-center gap-3 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-gray-400 leading-none mb-1">Entry Date</span>
                <input
                  type="text"
                  required
                  value={displayDate}
                  onChange={(e) => {
                    setDisplayDate(e.target.value);
                    if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) {
                      setEntryDate(parseDisplayDate(e.target.value));
                    }
                  }}
                  className="bg-transparent text-sm font-bold text-gray-900 focus:outline-none w-28"
                />
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
          </div>
          <form onSubmit={handleSubmit}>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2 text-sm">Product Name *</th>
                    <th className="text-left py-2 px-2 text-sm">Barcode</th>
                    <th className="text-left py-2 px-2 text-sm">Purchase ₹ *</th>
                    <th className="text-left py-2 px-2 text-sm">Selling ₹ *</th>
                    <th className="text-left py-2 px-2 text-sm">Stock *</th>
                    <th className="text-left py-2 px-2 text-sm">Min Stock</th>
                    <th className="text-center py-2 px-2 text-sm">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id} className="border-b">
                      <td className="py-2 px-2">
                        <input type="text" value={entry.name} onChange={(e) => updateEntry(entry.id, 'name', e.target.value)} className="input-field text-sm uppercase" required />
                      </td>
                      <td className="py-2 px-2">
                        <input type="text" value={entry.barcode} onChange={(e) => updateEntry(entry.id, 'barcode', e.target.value)} className="input-field text-sm" />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" value={entry.purchase_price} onChange={(e) => updateEntry(entry.id, 'purchase_price', e.target.value)} className="input-field text-sm" required />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" value={entry.selling_price} onChange={(e) => updateEntry(entry.id, 'selling_price', e.target.value)} className="input-field text-sm" required />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" value={entry.stock_quantity} onChange={(e) => updateEntry(entry.id, 'stock_quantity', e.target.value)} className="input-field text-sm" required />
                      </td>
                      <td className="py-2 px-2">
                        <input type="number" value={entry.min_stock_level} onChange={(e) => updateEntry(entry.id, 'min_stock_level', e.target.value)} className="input-field text-sm" />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <button type="button" onClick={() => removeRow(entry.id)} className="p-1 text-gray-400 hover:text-red-600" disabled={entries.length === 1}><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-between">
              <button type="button" onClick={addNewRow} className="btn-outline flex items-center text-sm"><Plus className="h-4 w-4 mr-1" /> Add Row</button>
              <div className="flex gap-3">
                <button type="button" onClick={onClose} className="btn-outline">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Saving...' : `Save ${entries.filter(e => e.name.trim()).length} Products`}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function AddStockModal({ product, onClose, onStockUpdated }: { product: Product; onClose: () => void; onStockUpdated: (p: Product) => void }) {
  const [mode, setMode] = useState<StockAdjustmentMode>('add');
  const [quantity, setQuantity] = useState(1);
  const [targetStock, setTargetStock] = useState(product.stock_quantity);
  const [reason, setReason] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [displayDate, setDisplayDate] = useState(formatDateToDisplay(date));
  const [loading, setLoading] = useState(false);
  const [partyPurchases, setPartyPurchases] = useState<PartyPurchase[]>([]);
  const [selectedPartyPurchase, setSelectedPartyPurchase] = useState<PartyPurchase | null>(null);
  const { showToast } = useToast();

  const modeOptions: Array<{ value: StockAdjustmentMode; label: string; description: string }> = [
    { value: 'add', label: 'Add', description: 'Increase stock manually' },
    { value: 'reduce', label: 'Reduce', description: 'Reduce stock manually' },
    { value: 'damaged', label: 'Damaged', description: 'Remove damaged stock' },
    { value: 'correction', label: 'Correction', description: 'Set exact stock' },
    { value: 'party_transfer', label: 'Transfer', description: 'Move from party purchase' }
  ];

  useEffect(() => {
    const fetchPartyStock = async () => {
      try {
        const allPurchases = await getPartyPurchases();
        const matches = allPurchases
          .filter(p => p.item_name.toUpperCase() === product.name.toUpperCase() && p.remaining_quantity > 0)
          .sort((a, b) => new Date(b.purchase_date).getTime() - new Date(a.purchase_date).getTime());

        setPartyPurchases(matches);
        if (matches.length > 0) {
          setSelectedPartyPurchase(matches[0]);
        }
      } catch (error) {
        console.error('Error fetching party stock:', error);
      }
    };
    fetchPartyStock();
  }, [product.name]);

  useEffect(() => {
    if (mode === 'party_transfer' && selectedPartyPurchase) {
      setQuantity(current => Math.min(Math.max(1, current), selectedPartyPurchase.remaining_quantity));
    }
    if (mode === 'correction') {
      setTargetStock(product.stock_quantity);
    }
  }, [mode, selectedPartyPurchase, product.stock_quantity]);

  const getPreviewStock = () => {
    if (mode === 'correction') return Math.max(0, targetStock || 0);
    if (mode === 'add' || mode === 'party_transfer') return product.stock_quantity + quantity;
    return product.stock_quantity - quantity;
  };

  const maxQuantity = mode === 'party_transfer'
    ? selectedPartyPurchase?.remaining_quantity || 0
    : product.stock_quantity;

  const handleAdjustStock = async () => {
    if (!reason.trim()) {
      showToast('Reason is required for stock adjustment', 'warning');
      return;
    }
    if (mode !== 'correction' && quantity <= 0) {
      showToast('Quantity must be greater than zero', 'warning');
      return;
    }
    if ((mode === 'reduce' || mode === 'damaged') && quantity > product.stock_quantity) {
      showToast(`Only ${product.stock_quantity} units are available`, 'error');
      return;
    }
    if (mode === 'party_transfer' && (!selectedPartyPurchase || quantity > selectedPartyPurchase.remaining_quantity)) {
      showToast('Select valid party stock for transfer', 'error');
      return;
    }

    setLoading(true);
    try {
      const updatedProduct = await adjustProductStock({
        product,
        mode,
        quantity,
        targetStock,
        reason,
        date,
        partyPurchase: selectedPartyPurchase
      });

      onStockUpdated(updatedProduct);
      showToast('Stock adjustment saved with ledger entry', 'success');
    } catch (error) {
      console.error('Error adjusting stock:', error);
      showToast(error instanceof Error ? error.message : 'Error adjusting stock', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999] backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-xl font-black text-gray-900">Adjust Stock</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="h-6 w-6" /></button>
        </div>
        <p className="text-sm font-bold text-primary-600 uppercase tracking-widest mb-4">{product.name}</p>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
            <p className="text-[10px] uppercase font-black text-gray-400">Current</p>
            <p className="text-2xl font-black text-gray-900">{product.stock_quantity}</p>
          </div>
          <div className="bg-primary-50 rounded-xl p-3 border border-primary-100">
            <p className="text-[10px] uppercase font-black text-primary-500">After</p>
            <p className={`text-2xl font-black ${getPreviewStock() < 0 ? 'text-red-600' : 'text-primary-700'}`}>
              {getPreviewStock()}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-5">
          {modeOptions.map(option => (
            <button
              key={option.value}
              type="button"
              onClick={() => setMode(option.value)}
              title={option.description}
              className={`py-2 px-3 rounded-xl text-xs font-black border transition-colors ${
                mode === option.value
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {mode === 'party_transfer' && (
          <div className="mb-5 p-4 rounded-xl border-2 bg-primary-50 border-primary-200">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-black uppercase text-primary-700 tracking-wider">Party Stock</span>
              <span className="text-[10px] font-black uppercase text-primary-500">{partyPurchases.length} source(s)</span>
            </div>

            {partyPurchases.length > 0 ? (
              <div className="space-y-3">
                <select
                  value={selectedPartyPurchase?.id || ''}
                  onChange={(e) => {
                    const found = partyPurchases.find(p => p.id === e.target.value);
                    setSelectedPartyPurchase(found || null);
                    if (found) setQuantity(Math.min(quantity, found.remaining_quantity));
                  }}
                  className="w-full bg-white border border-primary-100 rounded-lg p-2 text-sm font-bold text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {partyPurchases.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.party_name} ({p.remaining_quantity} units)
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-primary-600 font-bold">
                  Party stock will reduce and product stock will increase in the same adjustment.
                </p>
              </div>
            ) : (
              <p className="text-xs font-bold text-primary-700">No matching party stock is available for this product.</p>
            )}
          </div>
        )}

        <div className="space-y-4">
          {mode === 'correction' ? (
            <div>
              <label className="block text-[10px] uppercase font-black text-gray-400 mb-1 ml-1">Correct Stock To</label>
              <input
                type="number"
                min="0"
                value={targetStock}
                onChange={(e) => setTargetStock(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl text-center font-black text-xl focus:outline-none focus:border-primary-500"
              />
            </div>
          ) : (
            <div>
              <label className="block text-[10px] uppercase font-black text-gray-400 mb-1 ml-1">
                {mode === 'add' ? 'Quantity to Add' : mode === 'party_transfer' ? 'Quantity to Transfer' : 'Quantity to Remove'}
              </label>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-xl transition-colors"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    let val = parseInt(e.target.value) || 1;
                    if (mode !== 'add') {
                      val = Math.min(val, maxQuantity || val);
                    }
                    setQuantity(Math.max(1, val));
                  }}
                  className="flex-1 h-12 bg-gray-50 border-2 border-gray-100 rounded-xl text-center font-black text-xl focus:outline-none focus:border-primary-500"
                />
                <button
                  onClick={() => {
                    const nextVal = mode === 'add' ? quantity + 1 : Math.min(quantity + 1, maxQuantity || quantity + 1);
                    setQuantity(nextVal);
                  }}
                  className="w-12 h-12 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 font-black text-xl transition-colors"
                >
                  +
                </button>
              </div>
              {mode !== 'add' && (
                <p className="text-[10px] text-right mt-1 font-black text-primary-400 uppercase">Max: {maxQuantity} Units</p>
              )}
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase font-black text-gray-400 mb-1 ml-1">Date (dd/mm/yyyy)</label>
            <div className="relative">
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={displayDate}
                onChange={(e) => {
                  setDisplayDate(e.target.value);
                  if (/^\d{2}\/\d{2}\/\d{4}$/.test(e.target.value)) {
                    setDate(parseDisplayDate(e.target.value));
                  }
                }}
                className="w-full h-12 bg-gray-50 border-2 border-gray-100 rounded-xl pl-12 pr-4 font-bold text-gray-900 focus:outline-none focus:border-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase font-black text-gray-400 mb-1 ml-1">Reason Required</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Example: damaged pieces found, counted stock correction, new stock received"
              className="w-full min-h-[88px] bg-gray-50 border-2 border-gray-100 rounded-xl p-3 font-bold text-sm text-gray-900 focus:outline-none focus:border-primary-500"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdjustStock}
            disabled={loading || (mode === 'party_transfer' && partyPurchases.length === 0)}
            className="flex-1 py-3 px-4 rounded-xl text-white font-black shadow-lg transition-all transform active:scale-95 disabled:opacity-50 bg-gray-900 hover:bg-gray-800 shadow-gray-200"
          >
            {loading ? 'Saving...' : 'Save Adjustment'}
          </button>
        </div>
      </div>
    </div>
  );
}
