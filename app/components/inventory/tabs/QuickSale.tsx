'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Package,
  Search,
  Plus,
  X,
  BarChart3,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import {
  getProducts,
  getSalesByDate,
  createSale,
  adjustProductStock,
  markDamagedStock,
  createProduct,
  getClosingStockForYear,
  getAnalytics
} from 'lib/offline-adapter';
import { 
  getFinancialYear, 
  getFYRange, 
  getFYList,
  formatFYLabel,
  formatDateToDisplay,
  parseDisplayDate
} from 'lib/date-utils';
import { addProductHistory } from 'lib/product-history';
import { formatDateToDDMMYYYY, getCurrentDateISO } from '../utils/dateHelpers';
import type { Product, Sale, SaleInsert, ProductInsert } from 'supabase_client';
import { useToast } from 'app/context/ToastContext';

interface QuickSaleProps {
  onNavigate: (view: string) => void;
}

interface CartItem {
  product: Product;
  quantity: number;
  salePrice: number;
  saleDate: string;
}

const parsePriceSearch = (term: string) => {
  const normalized = term.trim().replace(/[₹,\s]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : null;
};

const pricesMatch = (productPrice: number, searchPrice: number) =>
  Math.round(Number(productPrice) * 100) === Math.round(searchPrice * 100);

const formatSearchPrice = (amount: number) =>
  Number.isInteger(amount) ? String(amount) : amount.toFixed(2);

export default function QuickSale({ onNavigate }: QuickSaleProps) {
  const { showToast } = useToast();
  const currentFY = getFinancialYear();
  const [financialYear, setFinancialYear] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('inventory_pro_fy');
      return saved || currentFY;
    }
    return currentFY;
  });
  
  const isCurrentYear = financialYear === currentFY;
  const [historicalStock, setHistoricalStock] = useState<Record<string, number>>({});

  const [cart, setCart] = useState<CartItem[]>([]);
  const [saleDate, setSaleDate] = useState(getCurrentDateISO());
  const [saleDateDisplay, setSaleDateDisplay] = useState(() => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const year = String(today.getFullYear());
    return `${day}/${month}/${year}`;
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateSales, setDateSales] = useState<Sale[]>([]);
  const [dateSummary, setDateSummary] = useState({ totalProducts: 0, totalAmount: 0, totalProfit: 0 });
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [addStockProduct, setAddStockProduct] = useState<Product | null>(null);
  const [addStockQuantity, setAddStockQuantity] = useState(0);
  const [addStockReason, setAddStockReason] = useState('Stock added during quick sale');
  const [showDamageModal, setShowDamageModal] = useState(false);
  const [damageProduct, setDamageProduct] = useState<Product | null>(null);
  const [damageQuantity, setDamageQuantity] = useState(1);
  const [damageReason, setDamageReason] = useState('Damaged during sale check');
  const [damageDate, setDamageDate] = useState(saleDate);
  const [processing, setProcessing] = useState(false);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddPrefillName, setQuickAddPrefillName] = useState('');

  // Sync FY to localStorage
  useEffect(() => {
    localStorage.setItem('inventory_pro_fy', financialYear);
  }, [financialYear]);

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

  const getDisplayStock = (product: Product) => {
    if (isCurrentYear) return product.stock_quantity;
    return historicalStock[product.id] ?? 0;
  };

  // Fetch sales for selected date
  useEffect(() => {
    const fetchDateSales = async () => {
      try {
        const salesData = await getSalesByDate(saleDate);
        setDateSales(salesData || []);
        
        const uniqueProducts = new Set((salesData || []).map(sale => sale.product_id));
        const summary = (salesData || []).reduce((acc, sale) => {
          acc.totalAmount += sale.total_amount;
          acc.totalProfit += sale.profit;
          return acc;
        }, { totalProducts: uniqueProducts.size, totalAmount: 0, totalProfit: 0 });
        
        setDateSummary(summary);
      } catch (error) {
        console.error('Error fetching date sales:', error);
        setDateSales([]);
        setDateSummary({ totalProducts: 0, totalAmount: 0, totalProfit: 0 });
      }
    };

    fetchDateSales();
  }, [saleDate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setSearchTerm('');
        searchInputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  const trimmedSearchTerm = searchTerm.trim();
  const normalizedSearchTerm = trimmedSearchTerm.toLowerCase();
  const priceSearchAmount = parsePriceSearch(trimmedSearchTerm);

  const priceMatchedProducts = priceSearchAmount === null
    ? []
    : products.filter(product => pricesMatch(product.selling_price, priceSearchAmount));

  const filteredProducts = products.filter(product => {
    if (!normalizedSearchTerm) return true;

    return (
      product.name.toLowerCase().includes(normalizedSearchTerm) ||
      product.barcode?.toLowerCase().includes(normalizedSearchTerm) ||
      (priceSearchAmount !== null && pricesMatch(product.selling_price, priceSearchAmount))
    );
  });

  const noResults = trimmedSearchTerm.length > 0 && filteredProducts.length === 0;
  const shouldShowAddProduct = isCurrentYear && noResults && priceSearchAmount === null;
  const quickAccessProducts = priceSearchAmount === null ? filteredProducts.slice(0, 10) : filteredProducts;

  const handleSaleDateChange = (displayValue: string) => {
    setSaleDateDisplay(displayValue);
    const parts = displayValue.split('/');
    if (parts.length === 3 && parts[0].length <= 2 && parts[1].length <= 2 && parts[2].length === 4) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = parts[2];
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        const isoDate = `${year}-${month}-${day}`;
        setSaleDate(isoDate);
        setCart(prevCart => prevCart.map(item => ({ ...item, saleDate: isoDate })));
      }
    }
  };

  const addToCart = (product: Product) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item =>
        item.product.id === product.id && item.salePrice === product.selling_price
      );
      if (existingItem) {
        return prevCart.map(item =>
          item.product.id === product.id && item.salePrice === product.selling_price
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevCart, {
          product: product,
          quantity: 1,
          salePrice: product.selling_price,
          saleDate: saleDate
        }];
      }
    });
    setSearchTerm('');
  };

  const updateCartItem = (index: number, field: string, value: any) => {
    setCart(prevCart =>
      prevCart.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  };

  const removeFromCart = (index: number) => {
    setCart(prevCart => prevCart.filter((_, i) => i !== index));
  };

  const handleAddNewProduct = (name: string) => {
    setQuickAddPrefillName(name);
    setShowQuickAddModal(true);
  };

  const handleQuickAddProductAdded = (newProduct: Product) => {
    setProducts(prev => [newProduct, ...prev]);
    addToCart(newProduct);
    setShowQuickAddModal(false);
    setTimeout(() => searchInputRef.current?.focus(), 100);
  };

  const handleCompleteSale = async () => {
    if (cart.length === 0 || processing) return;

    const insufficientStock = cart.find(item => item.quantity > item.product.stock_quantity);
    if (insufficientStock) {
      showToast(`Insufficient stock for ${insufficientStock.product.name}`, 'error');
      return;
    }

    try {
      setProcessing(true);
      for (const item of cart) {
        const totalAmount = item.salePrice * item.quantity;
        const profit = (item.salePrice - item.product.purchase_price) * item.quantity;

        const saleData: SaleInsert = {
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.salePrice,
          total_amount: totalAmount,
          profit: profit,
          sale_date: item.saleDate,
        };

        // This call now handles stock update atomically (via RPC/Trigger online or offline-db logic)
        await createSale(saleData);

        // Update local products state for immediate UI feedback
        const newStockQuantity = item.product.stock_quantity - item.quantity;
        setProducts(prev => prev.map(p => 
          p.id === item.product.id ? { ...p, stock_quantity: newStockQuantity } : p
        ));
      }

      const updatedSalesData = await getSalesByDate(saleDate);
      setDateSales(updatedSalesData || []);
      setCart([]);
      showToast('Sale completed successfully!', 'success');
    } catch (error) {
      console.error('Error processing sale:', error);
      showToast('Error processing sale', 'error');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddStock = async (customDate: string = saleDate) => {
    if (!addStockProduct || addStockQuantity <= 0) return;
    if (!addStockReason.trim()) {
      showToast('Reason is required for stock adjustment', 'warning');
      return;
    }
    try {
      const updatedProduct = await adjustProductStock({
        product: addStockProduct,
        mode: 'add',
        quantity: addStockQuantity,
        reason: addStockReason,
        date: customDate
      });

      setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
      setCart(prev => prev.map(item => item.product.id === updatedProduct.id ? { ...item, product: { ...item.product, stock_quantity: updatedProduct.stock_quantity } } : item));
      setShowAddStockModal(false);
      setAddStockReason('Stock added during quick sale');
      showToast('Stock added successfully', 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Error adding stock', 'error');
    }
  };

  const openDamageModal = (product: Product, quantity = 1) => {
    setDamageProduct(product);
    setDamageQuantity(Math.max(1, Math.min(quantity, product.stock_quantity)));
    setDamageReason('Damaged during sale check');
    setDamageDate(saleDate);
    setShowDamageModal(true);
  };

  const handleMarkDamaged = async () => {
    if (!damageProduct || damageQuantity <= 0) return;

    try {
      const updatedProduct = await markDamagedStock(
        damageProduct,
        damageQuantity,
        damageReason,
        damageDate
      );

      setProducts(prev => prev.map(p =>
        p.id === updatedProduct.id ? { ...p, stock_quantity: updatedProduct.stock_quantity } : p
      ));
      setCart(prev => prev.map(item =>
        item.product.id === updatedProduct.id
          ? { ...item, product: { ...item.product, stock_quantity: updatedProduct.stock_quantity } }
          : item
      ));
      setShowDamageModal(false);
      setDamageProduct(null);
      showToast(`Removed ${damageQuantity} damaged unit${damageQuantity === 1 ? '' : 's'} from stock`, 'success');
    } catch (error) {
      console.error('Error marking damaged stock:', error);
      showToast(error instanceof Error ? error.message : 'Error marking damaged stock', 'error');
    }
  };

  return (
    <div className="p-6 bg-primary-50 min-h-screen">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Quick Sale</h1>
          <p className="text-gray-600 mt-1">Process sales and manage daily transactions</p>
        </div>
        <div className="bg-white border-2 border-primary-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-sm mt-4 sm:mt-0">
          <Calendar className="h-5 w-5 text-primary-600" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold text-gray-400 leading-none mb-1">Financial Year</span>
            <select 
              value={financialYear}
              onChange={(e) => setFinancialYear(e.target.value)}
              className="bg-transparent text-sm font-bold text-primary-900 focus:outline-none cursor-pointer"
            >
              {getFYList().map(fy => (
                <option key={fy} value={fy}>{formatFYLabel(fy)}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {!isCurrentYear && (
          <div className="bg-amber-50 border-l-4 border-amber-400 p-4 rounded-r-lg animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-3">
              <Package className="h-5 w-5 text-amber-600" />
              <p className="text-amber-800 text-sm">
                You are viewing historical data for <strong>{financialYear}</strong>. 
                New sales and stock additions are only allowed in the <strong>Current Year ({currentFY})</strong>.
              </p>
            </div>
          </div>
        )}

        <div className="card bg-primary-600 text-white p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-shrink-0">
              <label className="block text-xs font-medium mb-1 opacity-80">Sale Date</label>
              <input
                type="text"
                value={saleDateDisplay}
                onChange={(e) => handleSaleDateChange(e.target.value)}
                className="input-field w-36 text-gray-900 font-semibold"
                placeholder="DD/MM/YYYY"
                disabled={!isCurrentYear}
              />
            </div>
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder={isCurrentYear ? "Search products, amount, or scan barcode..." : "View-only mode for historical records"}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10 w-full text-gray-900"
                disabled={!isCurrentYear}
              />
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            {isCurrentYear ? 'Quick Access' : `Historical Stock (${financialYear})`}
          </h3>
          {isCurrentYear && priceSearchAmount !== null && trimmedSearchTerm.length > 0 && (
            <div className={`mb-3 rounded-lg border px-3 py-2 text-sm font-medium ${
              priceMatchedProducts.length > 0
                ? 'border-primary-200 bg-primary-50 text-primary-800'
                : 'border-yellow-200 bg-yellow-50 text-yellow-800'
            }`}>
              {priceMatchedProducts.length > 0
                ? `${priceMatchedProducts.length} product${priceMatchedProducts.length === 1 ? '' : 's'} at ₹${formatSearchPrice(priceSearchAmount)}`
                : `No products found at ₹${formatSearchPrice(priceSearchAmount)}`}
            </div>
          )}
          <div className="flex gap-3 overflow-x-auto pb-3">
            {quickAccessProducts.map(product => {
              const displayStock = getDisplayStock(product);
              return (
                <div
                  key={product.id}
                  onClick={() => isCurrentYear && addToCart(product)}
                  className={`flex-shrink-0 w-40 p-3 border-2 border-gray-200 rounded-lg transition-all text-center ${isCurrentYear ? 'cursor-pointer hover:border-primary-500' : 'opacity-80 bg-gray-50'}`}
                >
                  <p className="font-bold text-sm text-gray-900 truncate">{product.name}</p>
                  <p className="text-lg font-bold text-primary-600">₹{product.selling_price}</p>
                  <p className={`text-xs ${displayStock <= product.min_stock_level ? 'text-red-600' : 'text-gray-500'}`}>
                    {displayStock} left
                  </p>
                  {isCurrentYear && displayStock > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDamageModal(product);
                      }}
                      className="mt-2 inline-flex items-center justify-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100"
                    >
                      <AlertTriangle className="h-3 w-3" />
                      Damaged
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {shouldShowAddProduct && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <button
                onClick={() => handleAddNewProduct(searchTerm)}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                <Plus className="h-5 w-5" /> Add "{searchTerm.toUpperCase()}"
              </button>
            </div>
          )}
        </div>

        <div className="card bg-gray-50">
          <h3 className="text-lg font-semibold mb-4">Current Sale</h3>
          {cart.length === 0 ? (
            <div className="text-center py-12 bg-white border-2 border-dashed rounded-lg">
              <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">Cart is empty</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cart.map((item, index) => (
                <div key={`${item.product.id}-${index}`} className="bg-white border-2 border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col md:flex-row justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-bold text-gray-900">{item.product.name}</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xs text-gray-500">Stock: {item.product.stock_quantity}</p>
                        {item.product.stock_quantity > 0 && (
                          <button
                            onClick={() => openDamageModal(item.product)}
                            className="inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700 hover:bg-red-100"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Damaged
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateCartItem(index, 'quantity', Math.max(1, item.quantity - 1))} className="w-8 h-8 border border-primary-500 rounded text-primary-600">-</button>
                      <input type="number" value={item.quantity} onChange={(e) => updateCartItem(index, 'quantity', parseInt(e.target.value) || 1)} className="w-12 text-center border rounded" />
                      <button onClick={() => updateCartItem(index, 'quantity', item.quantity + 1)} className="w-8 h-8 border border-primary-500 rounded text-primary-600">+</button>
                    </div>
                    <div className="w-24">
                      <input type="number" value={item.salePrice} onChange={(e) => updateCartItem(index, 'salePrice', parseFloat(e.target.value) || 0)} className="w-full border rounded px-2" />
                    </div>
                    <div className="text-right">
                      <p className="font-bold">₹{(item.salePrice * item.quantity).toFixed(2)}</p>
                      <button onClick={() => removeFromCart(index)} className="text-red-500"><X className="h-5 w-5" /></button>
                    </div>
                  </div>
                  {item.quantity > item.product.stock_quantity && (
                    <div className="mt-2 text-red-600 text-xs flex items-center gap-2">
                      <span>Insufficient stock!</span>
                      <button onClick={() => {setAddStockProduct(item.product); setAddStockQuantity(item.quantity - item.product.stock_quantity); setAddStockReason('Stock added during quick sale'); setShowAddStockModal(true);}} className="bg-primary-500 text-white px-2 py-0.5 rounded">Add Stock</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {cart.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card bg-secondary-600 text-white text-center p-6">
              <p className="text-sm opacity-80">TOTAL</p>
              <p className="text-4xl font-bold">₹{cart.reduce((s, i) => s + (i.salePrice * i.quantity), 0).toFixed(2)}</p>
            </div>
            <button 
              onClick={handleCompleteSale} 
              disabled={processing || !isCurrentYear} 
              className={`card bg-primary-600 text-white text-xl font-bold flex items-center justify-center gap-2 hover:bg-primary-700 ${!isCurrentYear ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {processing ? 'Processing...' : 'Complete Sale'}
            </button>
          </div>
        )}

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Summary for {formatDateToDDMMYYYY(saleDate)}</h3>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-primary-50 p-4 rounded text-center">
              <p className="text-xs text-primary-600">Sold</p>
              <p className="text-xl font-bold">{dateSummary.totalProducts}</p>
            </div>
            <div className="bg-secondary-50 p-4 rounded text-center">
              <p className="text-xs text-secondary-600">Revenue</p>
              <p className="text-xl font-bold">₹{dateSummary.totalAmount.toFixed(2)}</p>
            </div>
            <div className="bg-accent-50 p-4 rounded text-center">
              <p className="text-xs text-accent-600">Profit</p>
              <p className="text-xl font-bold">₹{dateSummary.totalProfit.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      {showAddStockModal && addStockProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-4">Add Stock: {addStockProduct.name}</h3>
            
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Entry Date (dd/mm/yyyy)</label>
              <input
                type="text"
                defaultValue={saleDateDisplay}
                onChange={(e) => {
                  const parts = e.target.value.split('/');
                  if (parts.length === 3 && parts[2].length === 4) {
                    const day = parts[0].padStart(2, '0');
                    const month = parts[1].padStart(2, '0');
                    const year = parts[2];
                    const iso = `${year}-${month}-${day}`;
                    (window as any)._tempAddStockDate = iso;
                  }
                }}
                className="input-field text-sm"
                placeholder="DD/MM/YYYY"
              />
            </div>

            <div className="flex items-center gap-4 mb-6">
              <button onClick={() => setAddStockQuantity(Math.max(1, addStockQuantity - 1))} className="btn-outline px-3">-</button>
              <input type="number" value={addStockQuantity} onChange={(e) => setAddStockQuantity(parseInt(e.target.value) || 1)} className="input-field text-center" />
              <button onClick={() => setAddStockQuantity(addStockQuantity + 1)} className="btn-outline px-3">+</button>
            </div>
            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason Required</label>
              <textarea
                value={addStockReason}
                onChange={(e) => setAddStockReason(e.target.value)}
                className="input-field text-sm min-h-[80px]"
                placeholder="Why is stock being added?"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => handleAddStock((window as any)._tempAddStockDate || saleDate)} className="btn-primary flex-1">Add Stock</button>
              <button onClick={() => setShowAddStockModal(false)} className="btn-outline flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showDamageModal && damageProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-bold">Damaged Stock: {damageProduct.name}</h3>
            </div>

            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-700">
              Current stock: {damageProduct.stock_quantity}. This reduces stock without creating a sale.
            </div>

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-500 mb-1">Damage Date</label>
              <input
                type="date"
                value={damageDate}
                onChange={(e) => setDamageDate(e.target.value || saleDate)}
                className="input-field text-sm"
              />
            </div>

            <div className="flex items-center gap-4 mb-4">
              <button onClick={() => setDamageQuantity(Math.max(1, damageQuantity - 1))} className="btn-outline px-3">-</button>
              <input
                type="number"
                min="1"
                max={damageProduct.stock_quantity}
                value={damageQuantity}
                onChange={(e) => setDamageQuantity(Math.max(1, Math.min(damageProduct.stock_quantity, parseInt(e.target.value) || 1)))}
                className="input-field text-center"
              />
              <button onClick={() => setDamageQuantity(Math.min(damageProduct.stock_quantity, damageQuantity + 1))} className="btn-outline px-3">+</button>
            </div>

            <div className="mb-6">
              <label className="block text-xs font-medium text-gray-500 mb-1">Reason</label>
              <input
                type="text"
                value={damageReason}
                onChange={(e) => setDamageReason(e.target.value)}
                className="input-field text-sm"
                placeholder="Damaged during sale check"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleMarkDamaged} className="bg-red-600 text-white rounded-lg flex-1 font-bold hover:bg-red-700">
                Remove Damaged
              </button>
              <button onClick={() => setShowDamageModal(false)} className="btn-outline flex-1">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {showQuickAddModal && (
        <QuickAddProductModal
          onClose={() => setShowQuickAddModal(false)}
          onProductAdded={handleQuickAddProductAdded}
          prefillName={quickAddPrefillName}
        />
      )}
    </div>
  );
}

function QuickAddProductModal({ onClose, onProductAdded, prefillName }: { onClose: () => void; onProductAdded: (p: Product) => void; prefillName: string }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: prefillName.toUpperCase(),
    barcode: '',
    purchase_price: '',
    selling_price: '',
    stock_quantity: '',
    date: new Date().toISOString().split('T')[0]
  });
  const [displayDate, setDisplayDate] = useState(formatDateToDisplay(formData.date));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    
    try {
      setLoading(true);
      const data: ProductInsert = {
        name: formData.name,
        barcode: formData.barcode || null,
        purchase_price: parseFloat(formData.purchase_price) || 0,
        selling_price: parseFloat(formData.selling_price) || 0,
        stock_quantity: parseInt(formData.stock_quantity) || 0,
        min_stock_level: 5,
        category_id: null
      };
      const newProduct = await createProduct(data);
      
      await addProductHistory({
        product_id: newProduct.id,
        product_name: newProduct.name,
        action: 'created',
        quantity_change: newProduct.stock_quantity,
        stock_before: 0,
        stock_after: newProduct.stock_quantity,
        date: formData.date,
        notes: `Product created via Quick Add during sale`
      });

      onProductAdded(newProduct as any);
    } catch (error) {
      console.error('Failed to quick-add product:', error);
      alert('Failed to add product. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <h2 className="text-xl font-bold mb-4">Quick Add Product</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <input type="text" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value.toUpperCase()})} className="input-field" placeholder="Name" required disabled={loading} />
            <div className="relative">
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
                placeholder="DD/MM/YYYY"
                disabled={loading}
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-gray-400 font-bold uppercase pointer-events-none">Date</span>
            </div>
          </div>
          <input type="text" value={formData.barcode} onChange={(e) => setFormData({...formData, barcode: e.target.value})} className="input-field" placeholder="Barcode" disabled={loading} />
          <div className="grid grid-cols-2 gap-4">
            <input type="number" value={formData.purchase_price} onChange={(e) => setFormData({...formData, purchase_price: e.target.value})} className="input-field" placeholder="Purchase Price" required disabled={loading} />
            <input type="number" value={formData.selling_price} onChange={(e) => setFormData({...formData, selling_price: e.target.value})} className="input-field" placeholder="Selling Price" required disabled={loading} />
          </div>
          <input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})} className="input-field" placeholder="Initial Stock" required disabled={loading} />
          <div className="flex gap-3">
            <button type="submit" disabled={loading} className="btn-primary flex-1 disabled:opacity-50">
              {loading ? 'Adding...' : 'Add & Continue'}
            </button>
            <button type="button" onClick={onClose} disabled={loading} className="btn-outline flex-1">Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}
