import React, { useState, useEffect, useRef } from 'react';
import {
  ShoppingCart,
  Package,
  TrendingUp,
  AlertTriangle,
  Plus,
  Search,
  BarChart3,
  DollarSign,
  Edit,
  Trash2,
  X,
  Check,
  Users,
  Upload,
  Menu,
  ArrowLeft,
  Home
} from 'lucide-react';

// Import Supabase functions
import {
  getProducts,
  getSales,
  createProduct,
  createSale,
  updateProduct,
  deleteProduct,
  deleteSale,
  getSalesByDate,
  getSalesByDateRange,
  getAnalytics,
  getPartyPurchases,
  createPartyPurchase,
  updatePartyPurchase,
  deletePartyPurchase,
  type Product,
  type Sale,
  type PartyPurchase,
  type PartyPurchaseInsert
} from '../../supabase_client';

// No more mock data - using real Supabase data throughout the application

// Dashboard Component
function Dashboard({ onNavigate }) {
  const [analytics, setAnalytics] = useState({
    totalProducts: 0,
    totalSales: 0,
    totalProfit: 0,
    todaySales: 0,
    todayProfit: 0,
    lowStockProducts: 0
  });

  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allSales, setAllSales] = useState([]);
  const [showAllSales, setShowAllSales] = useState(false);
  const [allSalesLoading, setAllSalesLoading] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [allSalesPage, setAllSalesPage] = useState(1);
  const SALES_PER_PAGE = 20;

  // Fetch dashboard data on component mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        console.log('[DEBUG] Dashboard: About to fetch dashboard data');

        const [analyticsData, salesData, productsData] = await Promise.all([
          getAnalytics(),
          getSales(5), // Get recent 5 sales
          getProducts()
        ]);

        console.log('[DEBUG] Dashboard: analyticsData received:', analyticsData);
        console.log('[DEBUG] Dashboard: salesData received:', salesData);
        console.log('[DEBUG] Dashboard: salesData count:', salesData?.length || 0);
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

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set empty states on error
        setLowStockItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const handleDeleteSale = async (saleId: string, saleData: any) => {
    if (!confirm(`Are you sure you want to delete this sale of ${saleData.products?.name || 'Unknown Product'}? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteSale(saleId);

      // Note: Recent sales removed from dashboard

      // Refresh dashboard data to update analytics
      const [analyticsData] = await Promise.all([
        getAnalytics()
      ]);

      setAnalytics(analyticsData || {
        totalProducts: 0,
        totalSales: 0,
        totalProfit: 0,
        todaySales: 0,
        todayProfit: 0,
        lowStockProducts: 0
      });

      // Refresh All Sales if open
      if (showAllSales) {
        await fetchAllSales(allSalesPage);
      }

      alert('Sale deleted successfully!');
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Error deleting sale: ' + error.message);
    }
  };

  // Fetch All Sales with filtering and pagination
  const fetchAllSales = async (page: number = 1) => {
    try {
      setAllSalesLoading(true);
      console.log(`[DEBUG] fetchAllSales: Fetching page ${page}, startDate: ${startDate}, endDate: ${endDate}`);

      const { supabase } = await import('../../supabase_client');
      let query = supabase
        .from('sales')
        .select(`
          *,
          products (
            id,
            name
          )
        `, { count: 'exact' });

      // Apply date filtering
      if (startDate) {
        query = query.gte('sale_date', startDate);
      }
      if (endDate) {
        query = query.lte('sale_date', endDate);
      }

      // Apply pagination
      const from = (page - 1) * SALES_PER_PAGE;
      const to = from + SALES_PER_PAGE - 1;

      query = query
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      console.log(`[DEBUG] fetchAllSales: Retrieved ${data?.length || 0} sales for page ${page}`);
      console.log(`[DEBUG] fetchAllSales: Total sales available: ${count || 0}`);

      setAllSales(data || []);

    } catch (error) {
      console.error('[DEBUG] fetchAllSales: Error fetching all sales:', error);
      setAllSales([]);
    } finally {
      setAllSalesLoading(false);
    }
  };

  // Handle showing all sales section
  const handleShowAllSales = async () => {
    if (!showAllSales) {
      setShowAllSales(true);
      await fetchAllSales(1);
    } else {
      setShowAllSales(false);
    }
  };

  // Handle filter changes
  const handleFilterChange = async () => {
    setAllSalesPage(1);
    await fetchAllSales(1);
  };

  // Handle pagination
  const handlePageChange = async (newPage: number) => {
    setAllSalesPage(newPage);
    await fetchAllSales(newPage);
  };

  return (
    <div className="p-6 bg-primary-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome! Here's your business overview.</p>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Products</p>
              <p className="stat-value">{analytics.totalProducts}</p>
            </div>
            <Package className="h-8 w-8 text-primary-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Total Sales</p>
              <p className="stat-value">₹{analytics.totalSales.toLocaleString()}</p>
            </div>
            <DollarSign className="h-8 w-8 text-secondary-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Today's Sales</p>
              <p className="stat-value">₹{analytics.todaySales}</p>
            </div>
            <TrendingUp className="h-8 w-8 text-accent-600" />
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-label">Low Stock Alert</p>
              <p className="stat-value text-danger-600">{analytics.lowStockProducts}</p>
            </div>
            <AlertTriangle className="h-8 w-8 text-danger-600" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Low Stock Alerts */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Low Stock Alerts</h3>
            <button 
              onClick={() => onNavigate('products')}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Manage Stock
            </button>
          </div>
          <div className="space-y-4">
            {lowStockItems.map(product => (
              <div key={product.id} className="flex items-center justify-between p-4 bg-danger-50 rounded-lg border border-danger-200">
                <div>
                  <p className="font-medium text-gray-900">{product.name}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-danger-600">{product.stock_quantity} left</p>
                  <p className="text-sm text-gray-500">Min: {product.min_stock_level}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* All Sales Section */}
        <div className="lg:col-span-2 card mt-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">All Sales</h3>
            <button
              onClick={handleShowAllSales}
              className="btn-outline text-sm"
              title={showAllSales ? "Hide All Sales" : "Show All Sales"}
            >
              {showAllSales ? 'Hide' : 'Show'} All Sales
            </button>
          </div>

          {showAllSales && (
            <div className="space-y-4">
              {/* Date Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">From:</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field text-sm w-36"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700">To:</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-field text-sm w-36"
                  />
                </div>
                <button
                  onClick={handleFilterChange}
                  className="btn-primary text-sm"
                >
                  Apply Filter
                </button>
              </div>

              {/* Sales List */}
              <div className="space-y-3">
                {allSalesLoading ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">Loading sales...</p>
                  </div>
                ) : allSales.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No sales found for the selected date range</p>
                  </div>
                ) : (
                  <>
                    <div className="max-h-96 overflow-y-auto">
                      {allSales.map(sale => (
                        <div key={sale.id} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{sale.products?.name || 'Unknown Product'}</p>
                            <p className="text-sm text-gray-500">Qty: {sale.quantity} • ₹{sale.unit_price}</p>
                            <p className="text-xs text-gray-400">Date: {new Date(sale.sale_date).toLocaleDateString()}</p>
                          </div>
                          <div className="text-right mr-3">
                            <p className="font-medium text-gray-900">₹{sale.total_amount}</p>
                            <p className="text-sm text-secondary-600">Profit: ₹{sale.profit}</p>
                          </div>
                          <button
                            onClick={() => handleDeleteSale(sale.id, sale)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Sale"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Pagination */}
                    {allSales.length >= SALES_PER_PAGE && (
                      <div className="flex justify-center gap-2 mt-4">
                        <button
                          onClick={() => handlePageChange(Math.max(1, allSalesPage - 1))}
                          disabled={allSalesPage === 1}
                          className="btn-outline px-3 py-2 disabled:opacity-50"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-2 text-sm text-gray-700">Page {allSalesPage}</span>
                        <button
                          onClick={() => handlePageChange(allSalesPage + 1)}
                          disabled={allSales.length < SALES_PER_PAGE}
                          className="btn-outline px-3 py-2 disabled:opacity-50"
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
      </div>

      {/* Quick Actions */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-3">
        <button
          onClick={() => onNavigate('quick-sale')}
          className="btn-primary rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow"
          title="Quick Sale"
        >
          <ShoppingCart className="h-6 w-6" />
        </button>
        <button
          onClick={() => onNavigate('add-product')}
          className="btn-secondary rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow"
          title="Add Product"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>

    </div>
  );
}

// Product Management Component
function ProductManagement({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch products on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const productsData = await getProducts();
        setProducts(productsData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteProduct(productId);
      setProducts(products.filter(p => p.id !== productId));
      alert('Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Error deleting product: ' + error.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      {/* Header - Hidden on mobile since it's in nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 hidden md:flex">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-2">Manage your inventory items</p>
        </div>
        <button 
          onClick={() => setShowAddForm(true)}
          className="btn-primary mt-4 sm:mt-0"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton-card mb-4"></div>
              <div className="skeleton-title mb-2"></div>
              <div className="skeleton-text mb-2 w-3/4"></div>
              <div className="skeleton-text mb-4 w-1/2"></div>
              <div className="flex justify-between items-center">
                <div className="skeleton-text w-1/3"></div>
                <div className="skeleton-text w-1/4"></div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredProducts.map(product => (
          <div key={product.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-end mb-4">
              <div className="flex gap-2">
                <button className="p-1 text-gray-400 hover:text-primary-600">
                  <Edit className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => handleDeleteProduct(product.id)}
                  className="p-1 text-gray-400 hover:text-danger-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="font-semibold text-gray-900">{product.name}</h3>
              <p className="text-sm text-gray-500">Code: {product.barcode}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Purchase:</span>
                <span className="font-medium">₹{product.purchase_price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Selling:</span>
                <span className="font-medium text-secondary-600">₹{product.selling_price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Stock:</span>
                <span className={`font-medium ${product.stock_quantity <= product.min_stock_level ? 'text-danger-600' : 'text-gray-900'}`}>
                  {product.stock_quantity} units
                </span>
              </div>
            </div>

            {product.stock_quantity <= product.min_stock_level && (
              <div className="mt-3 p-2 bg-danger-50 border border-danger-200 rounded-lg">
                <p className="text-xs text-danger-700 font-medium">Low Stock Alert!</p>
              </div>
            )}
          </div>
        ))}
        </div>
      )}

      {/* Floating Add Button - Mobile Only */}
      <div className="md:hidden fixed bottom-6 right-6 z-50">
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Add product button clicked');
            setShowAddForm(true);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="btn-primary rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow touch-target active:scale-95"
          title="Add Product"
          style={{ 
            minHeight: '56px', 
            minWidth: '56px',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <Plus className="h-6 w-6 pointer-events-none" />
        </button>
      </div>

      {/* Add Product Modal */}
      {showAddForm && (
        <AddProductModal 
          onClose={() => setShowAddForm(false)}
          onProductAdded={(newProduct) => {
            setProducts([newProduct, ...products]);
            setShowAddForm(false);
          }}
        />
      )}
    </div>
  );
}

// Add Product Modal Component  
function AddProductModal({ onClose, onProductAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    purchase_price: '',
    selling_price: '',
    stock_quantity: '',
    min_stock_level: '5',
    description: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Convert form data to proper types
      const productData = {
        name: formData.name,
        category_id: null,
        barcode: formData.barcode || null,
        purchase_price: parseFloat(formData.purchase_price),
        selling_price: parseFloat(formData.selling_price),
        stock_quantity: parseInt(formData.stock_quantity),
        min_stock_level: parseInt(formData.min_stock_level) || 5,
        description: formData.description || null
      };

      // Create product in Supabase
      const newProduct = await createProduct(productData);
      
      onProductAdded(newProduct);
      alert('Product added successfully!');
      
    } catch (error) {
      console.error('Error adding product:', error);
      alert('Error adding product: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto mx-4">
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="form-group">
              <label className="form-label">Product Name *</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({...formData, name: e.target.value})}
                className="input-field"
                placeholder="Enter product name"
              />
            </div>


            <div className="form-group">
              <label className="form-label">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                className="input-field"
                placeholder="Scan or enter barcode"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Purchase Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.selling_price}
                  onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Stock Quantity *</label>
                <input
                  type="number"
                  required
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                  className="input-field"
                  placeholder="0"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Min Stock Level</label>
                <input
                  type="number"
                  value={formData.min_stock_level}
                  onChange={(e) => setFormData({...formData, min_stock_level: e.target.value})}
                  className="input-field"
                  placeholder="5"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="input-field"
                rows={3}
                placeholder="Product description (optional)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-outline flex-1">
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1">
                Add Product
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Quick Sale Component
function QuickSale({ onNavigate }) {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [salePrice, setSalePrice] = useState(0);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateSales, setDateSales] = useState([]);
  const [dateSummary, setDateSummary] = useState({ totalQuantity: 0, totalAmount: 0, totalProfit: 0 });

  // Fetch products on component mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const productsData = await getProducts();
        setProducts(productsData || []);
      } catch (error) {
        console.error('Error fetching products:', error);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Fetch sales for selected date
  useEffect(() => {
    const fetchDateSales = async () => {
      try {
        const salesData = await getSalesByDate(saleDate);
        setDateSales(salesData || []);
        
        // Calculate summary
        const summary = (salesData || []).reduce((acc, sale) => {
          acc.totalQuantity += sale.quantity;
          acc.totalAmount += sale.total_amount;
          acc.totalProfit += sale.profit;
          return acc;
        }, { totalQuantity: 0, totalAmount: 0, totalProfit: 0 });
        
        setDateSummary(summary);
      } catch (error) {
        console.error('Error fetching date sales:', error);
        setDateSales([]);
        setDateSummary({ totalQuantity: 0, totalAmount: 0, totalProfit: 0 });
      }
    };

    fetchDateSales();
  }, [saleDate]);

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.barcode?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSale = async () => {
    if (!selectedProduct) {
      alert('Please select a product');
      return;
    }

    if (quantity > selectedProduct.stock_quantity) {
      alert('Insufficient stock!');
      return;
    }

    try {
      const actualSalePrice = salePrice || selectedProduct.selling_price;
      const totalAmount = actualSalePrice * quantity;
      const profit = (actualSalePrice - selectedProduct.purchase_price) * quantity;

      // Create sale record
      const saleData = {
        product_id: selectedProduct.id,
        quantity: parseInt(quantity.toString()),
        unit_price: parseFloat(actualSalePrice),
        total_amount: totalAmount,
        profit: profit,
        customer_info: null,
        sale_date: saleDate,
        notes: null
      };

      await createSale(saleData);

      // Update product stock
      const newStockQuantity = selectedProduct.stock_quantity - quantity;
      await updateProduct(selectedProduct.id, {
        stock_quantity: newStockQuantity
      });

      // Update local product state
      setProducts(prevProducts => 
        prevProducts.map(p => 
          p.id === selectedProduct.id 
            ? { ...p, stock_quantity: newStockQuantity }
            : p
        )
      );

      // Refresh date sales to show updated data
      const updatedSalesData = await getSalesByDate(saleDate);
      setDateSales(updatedSalesData || []);
      
      // Update date summary
      const newSummary = (updatedSalesData || []).reduce((acc, sale) => {
        acc.totalQuantity += sale.quantity;
        acc.totalAmount += sale.total_amount;
        acc.totalProfit += sale.profit;
        return acc;
      }, { totalQuantity: 0, totalAmount: 0, totalProfit: 0 });
      setDateSummary(newSummary);

      alert(`Sale completed! Total: ₹${totalAmount.toFixed(2)}`);
      
      // Reset form (keep the same date)
      setSelectedProduct(null);
      setQuantity(1);
      setSalePrice(0);
      setSearchTerm('');

    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error processing sale: ' + error.message);
    }
  };

  return (
    <div className="p-6 bg-primary-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Quick Sale</h1>
        <p className="text-gray-600 mt-2">Process sales quickly and efficiently</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Product Selection */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Product</h3>
          
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products or scan barcode..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field pl-10"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-96 overflow-y-auto">
            {filteredProducts.map(product => (
              <div
                key={product.id}
                onClick={() => {
                  setSelectedProduct(product);
                  setSalePrice(product.selling_price);
                }}
                className={`p-3 sm:p-4 border rounded-lg cursor-pointer transition-colors touch-target ${
                  selectedProduct?.id === product.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-gray-900 text-sm sm:text-base truncate">{product.name}</h4>
                    <p className="text-xs sm:text-sm text-gray-500 truncate">{product.barcode}</p>
                    <p className="text-sm font-medium text-secondary-600">₹{product.selling_price}</p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-2">
                    <p className={`text-xs sm:text-sm ${product.stock_quantity <= product.min_stock_level ? 'text-danger-600' : 'text-gray-600'}`}>
                      {product.stock_quantity} in stock
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sale Details */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sale Details</h3>
          
          {selectedProduct ? (
            <div className="space-y-6">
              {/* Selected Product */}
              <div className="p-4 bg-primary-50 border border-primary-200 rounded-lg">
                <h4 className="font-medium text-gray-900">{selectedProduct.name}</h4>
                <p className="text-sm text-gray-500">{selectedProduct.categories?.name || 'No Category'}</p>
                <p className="text-lg font-semibold text-primary-600">₹{selectedProduct.selling_price}</p>
              </div>

              {/* Quantity */}
              <div className="form-group">
                <label className="form-label">Quantity</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="btn-outline px-3 py-2"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct.stock_quantity}
                    value={quantity}
                    onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                    className="input-field text-center w-20"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity(Math.min(selectedProduct.stock_quantity, quantity + 1))}
                    className="btn-outline px-3 py-2"
                  >
                    +
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Available: {selectedProduct.stock_quantity} units
                </p>
              </div>

              {/* Sale Price */}
              <div className="form-group">
                <label className="form-label">Sale Price</label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={salePrice}
                    onChange={(e) => setSalePrice(parseFloat(e.target.value) || 0)}
                    className="input-field flex-1"
                    placeholder={`Default: ₹${selectedProduct?.selling_price || 0}`}
                  />
                  <button
                    type="button"
                    onClick={() => setSalePrice(selectedProduct.selling_price)}
                    className="btn-outline text-xs px-2 py-1"
                    title="Reset to default price"
                  >
                    Reset
                  </button>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Default price: ₹{selectedProduct?.selling_price}
                </p>
              </div>

              {/* Sale Date */}
              <div className="form-group">
                <label className="form-label">Sale Date</label>
                <input
                  type="date"
                  value={saleDate}
                  onChange={(e) => setSaleDate(e.target.value)}
                  className="input-field"
                  max={new Date().toISOString().split('T')[0]}
                />
              </div>

              {/* Sale Summary */}
              <div className="p-4 bg-primary-50 rounded-lg">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Unit Price:</span>
                    <span>₹{salePrice || selectedProduct.selling_price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span>{quantity}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>₹{((salePrice || selectedProduct.selling_price) * quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-secondary-600">
                    <span>Profit:</span>
                    <span>₹{(((salePrice || selectedProduct.selling_price) - selectedProduct.purchase_price) * quantity).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setSelectedProduct(null);
                    setQuantity(1);
                    setSaleDate(new Date().toISOString().split('T')[0]);
                  }}
                  className="btn-outline flex-1"
                >
                  Clear
                </button>
                <button
                  onClick={handleSale}
                  className="btn-success flex-1"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Complete Sale
                </button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingCart className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">Select a product to start a sale</p>
            </div>
          )}
        </div>

        {/* Date Sales Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Sales for {new Date(saleDate).toLocaleDateString()}
          </h3>
          
          {/* Summary Stats */}
          <div className="grid grid-cols-1 gap-4 mb-6">
            <div className="bg-primary-50 p-4 rounded-lg">
              <p className="text-sm text-primary-600 font-medium">Total Items Sold</p>
              <p className="text-2xl font-bold text-primary-700">{dateSummary.totalQuantity}</p>
            </div>
            <div className="bg-secondary-50 p-4 rounded-lg">
              <p className="text-sm text-secondary-600 font-medium">Total Revenue</p>
              <p className="text-2xl font-bold text-secondary-700">₹{dateSummary.totalAmount.toFixed(2)}</p>
            </div>
            <div className="bg-accent-50 p-4 rounded-lg">
              <p className="text-sm text-accent-600 font-medium">Total Profit</p>
              <p className="text-2xl font-bold text-accent-700">₹{dateSummary.totalProfit.toFixed(2)}</p>
            </div>
          </div>

          {/* Sales List */}
          <div className="space-y-3 max-h-96 overflow-y-auto">
            <h4 className="font-medium text-gray-900">Sales Details</h4>
            {dateSales.length === 0 ? (
              <div className="text-center py-8">
                <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500 text-sm">No sales recorded for this date</p>
              </div>
            ) : (
              dateSales.map(sale => (
                <div key={sale.id} className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900 text-sm">{sale.products?.name || 'Unknown Product'}</p>
                    <p className="text-xs text-gray-500">Qty: {sale.quantity} • Unit: ₹{sale.unit_price}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-gray-900 text-sm">₹{sale.total_amount}</p>
                    <p className="text-xs text-secondary-600">+₹{sale.profit}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Party Management Component
function PartyManagement({ onNavigate }) {
  const [partyPurchases, setPartyPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch party purchases on component mount
  useEffect(() => {
    console.log('[DEBUG] PartyManagement: useEffect triggered, about to fetch party purchases');

    const fetchData = async () => {
      try {
        console.log('[DEBUG] PartyManagement: Setting loading to true');
        setLoading(true);

        console.log('[DEBUG] PartyManagement: Calling getPartyPurchases()');
        const purchasesData = await getPartyPurchases();
        console.log('[DEBUG] PartyManagement: getPartyPurchases() returned:', purchasesData);

        const safeData = purchasesData || [];
        console.log('[DEBUG] PartyManagement: Setting partyPurchases state to:', safeData);
        setPartyPurchases(safeData);

        console.log('[DEBUG] PartyManagement: Total party purchases loaded:', safeData.length);
      } catch (error) {
        console.error('[DEBUG] PartyManagement: Error fetching party purchases:', error);
        console.error('[DEBUG] PartyManagement: Error details:', {
          message: error.message,
          stack: error.stack,
          code: error.code
        });
        setPartyPurchases([]);
      } finally {
        console.log('[DEBUG] PartyManagement: Setting loading to false');
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredPurchases = partyPurchases.filter(purchase => {
    const matchesSearch = purchase.item_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         purchase.party_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         purchase.barcode?.toLowerCase().includes(searchTerm.toLowerCase());

    return matchesSearch;
  });

  // Debug logging for search and filtering
  console.log('[DEBUG] PartyManagement: Search term:', searchTerm);
  console.log('[DEBUG] PartyManagement: Total purchases before filter:', partyPurchases.length);
  console.log('[DEBUG] PartyManagement: Filtered purchases count:', filteredPurchases.length);

  const handleDeletePurchase = async (purchaseId: string) => {
    if (!confirm('Are you sure you want to delete this purchase record?')) {
      return;
    }

    try {
      await deletePartyPurchase(purchaseId);
      setPartyPurchases(partyPurchases.filter(p => p.id !== purchaseId));
      alert('Purchase record deleted successfully!');
    } catch (error) {
      console.error('Error deleting purchase:', error);
      alert('Error deleting purchase: ' + error.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 bg-primary-50 min-h-screen">
      {/* Header - Hidden on mobile since it's in nav */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 hidden md:flex">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Party Purchases</h1>
          <p className="text-gray-600 mt-2">Manage your purchased inventory from suppliers</p>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button 
            onClick={() => setShowAddForm(true)}
            className="btn-primary"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Purchase
          </button>
          <button 
            onClick={() => setShowUploadModal(true)}
            className="btn-outline"
          >
            <Upload className="h-5 w-5 mr-2" />
            Upload File
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="card mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search purchases..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Purchases Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton-title mb-2"></div>
              <div className="skeleton-text mb-2 w-3/4"></div>
              <div className="skeleton-text mb-4 w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredPurchases.map(purchase => (
            <div key={purchase.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <span className="badge-info">{purchase.party_name}</span>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      setSelectedPurchase(purchase);
                      setShowTransferModal(true);
                    }}
                    className="p-1 text-gray-400 hover:text-primary-600"
                    title="Transfer to Products"
                  >
                    <Package className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDeletePurchase(purchase.id)}
                    className="p-1 text-gray-400 hover:text-danger-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="font-semibold text-gray-900">{purchase.item_name}</h3>
                <p className="text-sm text-gray-500">
                  {purchase.barcode && `Code: ${purchase.barcode}`}
                </p>
                <p className="text-xs text-gray-400">
                  Purchase Date: {new Date(purchase.purchase_date).toLocaleDateString()}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Purchase:</span>
                  <span className="font-medium">₹{purchase.purchase_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Selling:</span>
                  <span className="font-medium text-secondary-600">₹{purchase.selling_price}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Purchased:</span>
                  <span className="font-medium text-gray-900">{purchase.purchased_quantity} units</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500">Remaining:</span>
                  <span className={`font-medium ${purchase.remaining_quantity <= 0 ? 'text-danger-600' : 'text-accent-600'}`}>
                    {purchase.remaining_quantity} units
                  </span>
                </div>
              </div>

              {purchase.notes && (
                <div className="mt-3 p-2 bg-primary-50 rounded-lg">
                  <p className="text-xs text-gray-600">{purchase.notes}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Purchase Modal */}
      {showAddForm && (
        <AddPurchaseModal 
          onClose={() => setShowAddForm(false)}
          onPurchaseAdded={(newPurchase) => {
            setPartyPurchases([newPurchase, ...partyPurchases]);
            setShowAddForm(false);
          }}
        />
      )}

      {/* Transfer to Products Modal */}
      {showTransferModal && selectedPurchase && (
        <TransferModal 
          purchase={selectedPurchase}
          onClose={() => {
            setShowTransferModal(false);
            setSelectedPurchase(null);
          }}
          onTransferComplete={(updatedPurchase) => {
            setPartyPurchases(partyPurchases.map(p => 
              p.id === updatedPurchase.id ? updatedPurchase : p
            ));
            setShowTransferModal(false);
            setSelectedPurchase(null);
          }}
        />
      )}

      {/* Floating Action Buttons - Mobile Only */}
      <div className="md:hidden fixed bottom-6 right-6 flex flex-col gap-3 z-50">
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Upload button clicked');
            setShowUploadModal(true);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="btn-outline rounded-full p-3 shadow-lg hover:shadow-xl transition-shadow touch-target bg-white active:scale-95"
          title="Upload File"
          style={{ 
            minHeight: '48px', 
            minWidth: '48px',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <Upload className="h-5 w-5 pointer-events-none" />
        </button>
        <button 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Add purchase button clicked');
            setShowAddForm(true);
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          className="btn-primary rounded-full p-4 shadow-lg hover:shadow-xl transition-shadow touch-target active:scale-95"
          title="Add Purchase"
          style={{ 
            minHeight: '56px', 
            minWidth: '56px',
            touchAction: 'manipulation',
            WebkitTapHighlightColor: 'transparent'
          }}
        >
          <Plus className="h-6 w-6 pointer-events-none" />
        </button>
      </div>

      {/* File Upload Modal */}
      {showUploadModal && (
        <FileUploadModal 
          onClose={() => setShowUploadModal(false)}
          onFileProcessed={(newPurchases) => {
            setPartyPurchases([...newPurchases, ...partyPurchases]);
            setShowUploadModal(false);
          }}
        />
      )}
    </div>
  );
}

// Add Purchase Modal Component
function AddPurchaseModal({ onClose, onPurchaseAdded }) {
  const [formData, setFormData] = useState({
    party_name: '',
    item_name: '',
    barcode: '',
    purchase_price: '',
    selling_price: '',
    purchased_quantity: '',
    purchase_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const purchaseData: PartyPurchaseInsert = {
        party_name: formData.party_name,
        item_name: formData.item_name,
        barcode: formData.barcode || undefined,
        purchase_price: parseFloat(formData.purchase_price),
        selling_price: parseFloat(formData.selling_price),
        purchased_quantity: parseInt(formData.purchased_quantity),
        remaining_quantity: parseInt(formData.purchased_quantity),
        purchase_date: formData.purchase_date,
        notes: formData.notes || undefined
      };

      const newPurchase = await createPartyPurchase(purchaseData);
      onPurchaseAdded(newPurchase);
      alert('Purchase record added successfully!');
    } catch (error) {
      console.error('Error adding purchase:', error);
      alert('Error adding purchase: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Add Purchase Record</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Party Name *</label>
                <input
                  type="text"
                  required
                  value={formData.party_name}
                  onChange={(e) => setFormData({...formData, party_name: e.target.value})}
                  className="input-field"
                  placeholder="Supplier name"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Purchase Date *</label>
                <input
                  type="date"
                  required
                  value={formData.purchase_date}
                  onChange={(e) => setFormData({...formData, purchase_date: e.target.value})}
                  className="input-field"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Item Name *</label>
              <input
                type="text"
                required
                value={formData.item_name}
                onChange={(e) => setFormData({...formData, item_name: e.target.value})}
                className="input-field"
                placeholder="Product name"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Barcode</label>
              <input
                type="text"
                value={formData.barcode}
                onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                className="input-field"
                placeholder="Product code"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="form-group">
                <label className="form-label">Purchase Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({...formData, purchase_price: e.target.value})}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.selling_price}
                  onChange={(e) => setFormData({...formData, selling_price: e.target.value})}
                  className="input-field"
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Purchased Quantity *</label>
              <input
                type="number"
                required
                value={formData.purchased_quantity}
                onChange={(e) => setFormData({...formData, purchased_quantity: e.target.value})}
                className="input-field"
                placeholder="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                className="input-field"
                rows={3}
                placeholder="Additional notes (optional)"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={onClose} className="btn-outline flex-1">
                Cancel
              </button>
              <button type="submit" className="btn-primary flex-1">
                Add Purchase
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Transfer Modal Component
function TransferModal({ purchase, onClose, onTransferComplete }) {
  const [transferQuantity, setTransferQuantity] = useState(1);

  const handleTransfer = async () => {
    if (transferQuantity > purchase.remaining_quantity) {
      alert('Transfer quantity cannot exceed remaining quantity!');
      return;
    }

    try {
      // Create product in main inventory
      const productData = {
        name: purchase.item_name,
        category_id: null,
        barcode: purchase.barcode || null,
        purchase_price: purchase.purchase_price,
        selling_price: purchase.selling_price,
        stock_quantity: transferQuantity,
        min_stock_level: 5,
        description: `Transferred from ${purchase.party_name} purchase`
      };

      await createProduct(productData);

      // Update remaining quantity in party purchase
      const newRemainingQuantity = purchase.remaining_quantity - transferQuantity;
      const updatedPurchase = await updatePartyPurchase(purchase.id, {
        remaining_quantity: newRemainingQuantity
      });

      onTransferComplete(updatedPurchase);
      alert(`Successfully transferred ${transferQuantity} units to Products inventory!`);
    } catch (error) {
      console.error('Error transferring to products:', error);
      alert('Error transferring to products: ' + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-md w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Transfer to Products</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-primary-50 rounded-lg">
              <h3 className="font-medium text-gray-900">{purchase.item_name}</h3>
              <p className="text-sm text-gray-500">From: {purchase.party_name}</p>
              <p className="text-sm text-gray-500">Available: {purchase.remaining_quantity} units</p>
            </div>


            <div className="form-group">
              <label className="form-label">Transfer Quantity</label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setTransferQuantity(Math.max(1, transferQuantity - 1))}
                  className="btn-outline px-3 py-2"
                >
                  -
                </button>
                <input
                  type="number"
                  min="1"
                  max={purchase.remaining_quantity}
                  value={transferQuantity}
                  onChange={(e) => setTransferQuantity(parseInt(e.target.value) || 1)}
                  className="input-field text-center w-20"
                />
                <button
                  type="button"
                  onClick={() => setTransferQuantity(Math.min(purchase.remaining_quantity, transferQuantity + 1))}
                  className="btn-outline px-3 py-2"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={onClose} className="btn-outline flex-1">
                Cancel
              </button>
              <button
                onClick={handleTransfer}
                className="btn-success flex-1"
                disabled={transferQuantity <= 0 || transferQuantity > purchase.remaining_quantity}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Enhanced PDF Text Parsing Function with better pattern recognition
function parsePDFText(text) {
  console.log('[DEBUG] PDF Text Parsing: Starting PDF text analysis');
  console.log('[DEBUG] PDF Text Length:', text.length);
  
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const parsedData = [];
  
  // Enhanced patterns with more variations and better matching
  const patterns = {
    // Supplier/Party patterns
    party: /(?:(?:from|supplier|vendor|party|sold\s*by|dealer|distributor|company)\s*:?\s*([A-Za-z0-9\s&\.,-]+))(?:\n|\r|$)/i,
    
    // Item/Product patterns with better context recognition
    item: /(?:(?:item|product|description|name|article|goods?)\s*:?\s*([A-Za-z0-9\s\.,\-\/()&]+))(?:\n|\r|$|\s{2,})/i,
    
    // Enhanced price patterns with currency support
    purchasePrice: /(?:(?:purchase|cost|buy|wholesale|cp|rate)\s*(?:price)?\s*:?\s*(?:[₹$]?\s*)?([0-9,]+(?:\.[0-9]{1,2})?))/i,
    sellingPrice: /(?:(?:sell|sale|retail|selling|mrp|sp|rate)\s*(?:price)?\s*:?\s*(?:[₹$]?\s*)?([0-9,]+(?:\.[0-9]{1,2})?))/i,
    
    // Quantity patterns
    quantity: /(?:(?:quantity|qty|amount|units?|nos?|pieces?|pcs?)\s*:?\s*([0-9,]+))/i,
    
    // Barcode/SKU patterns
    barcode: /(?:(?:barcode|code|sku|item\s*code|product\s*id|id)\s*:?\s*([A-Za-z0-9\-_\/]+))/i,
    
    // Date patterns with multiple formats
    date: /(?:(?:date|purchased|bought|invoice\s*date|bill\s*date)\s*:?\s*([0-9]{1,2}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{2,4}|[0-9]{4}[\/\-\.][0-9]{1,2}[\/\-\.][0-9]{1,2}))/i,
    
    // Notes/Description patterns
    notes: /(?:(?:notes?|remarks?|description|details?)\s*:?\s*([^\n\r]+))/i
  };
  
  // Table detection patterns
  const tableHeaders = /(?:item|product|description|name|qty|quantity|rate|price|amount|total|code|barcode)/i;
  
  let currentRecord = {};
  let isInTable = false;
  let headers = [];
  let tableRows = [];
  
  console.log('[DEBUG] PDF Text Parsing: Processing', lines.length, 'lines');
  
  // First pass: Detect table structure
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip headers, footers, and irrelevant lines
    if (!line || line.match(/^(page\s*\d*|total|subtotal|grand\s*total|invoice|receipt|bill|thank\s*you)/i)) {
      continue;
    }
    
    // Check for potential table headers
    if (line.match(tableHeaders) && line.split(/\s{2,}|\t|\|/).length > 2) {
      const potentialHeaders = line.split(/\s{2,}|\t|\|/).map(h => h.trim().toLowerCase());
      if (potentialHeaders.some(h => h.match(/item|product|qty|price|amount/))) {
        headers = potentialHeaders;
        isInTable = true;
        console.log('[DEBUG] PDF Table detected with headers:', headers);
        continue;
      }
    }
    
    // If in table, collect rows
    if (isInTable && headers.length > 0) {
      const values = line.split(/\s{2,}|\t|\|/).map(v => v.trim());
      if (values.length >= Math.max(2, headers.length - 2)) {
        tableRows.push(values);
        continue;
      } else if (values.length === 1 && values[0].length < 10) {
        // Likely end of table
        isInTable = false;
        break;
      }
    }
  }
  
  // Process table data
  if (tableRows.length > 0 && headers.length > 0) {
    console.log('[DEBUG] Processing', tableRows.length, 'table rows');
    
    tableRows.forEach((values, rowIndex) => {
      const record = {};
      
      // Map headers to values
      headers.forEach((header, colIndex) => {
        if (colIndex < values.length && values[colIndex]) {
          const value = values[colIndex].trim();
          
          if (header.match(/party|supplier|vendor/)) record.party_name = value;
          else if (header.match(/item|product|description|name/)) record.item_name = value;
          else if (header.match(/purchase|cost|wholesale|cp/)) record.purchase_price = parseFloat(value.replace(/[^\d.]/g, '')) || 0;
          else if (header.match(/sell|sale|retail|mrp|sp|rate|price/) && !header.match(/purchase|cost/)) record.selling_price = parseFloat(value.replace(/[^\d.]/g, '')) || 0;
          else if (header.match(/qty|quantity|units?|nos?|pieces?/)) record.quantity = parseInt(value.replace(/[^\d]/g, '')) || 1;
          else if (header.match(/code|barcode|sku/)) record.barcode = value;
          else if (header.match(/date/)) record.date = value;
        }
      });
      
      // If no explicit purchase/selling price columns, try to infer from price columns
      if (!record.purchase_price && !record.selling_price) {
        headers.forEach((header, colIndex) => {
          if (header.match(/price|rate|amount/) && colIndex < values.length) {
            const price = parseFloat(values[colIndex].replace(/[^\d.]/g, '')) || 0;
            if (price > 0) {
              if (!record.selling_price) record.selling_price = price;
              else if (!record.purchase_price) record.purchase_price = price * 0.8; // Estimate 20% margin
            }
          }
        });
      }
      
      console.log('[DEBUG] Processed table row', rowIndex + 1, ':', record);
      
      // Validate and add record
      if (record.item_name && (record.purchase_price > 0 || record.selling_price > 0)) {
        parsedData.push({
          party_name: record.party_name || 'Table Import',
          item_name: record.item_name,
          barcode: record.barcode || '',
          purchase_price: record.purchase_price || 0,
          selling_price: record.selling_price || 0,
          quantity: record.quantity || 1,
          date: record.date || '',
          notes: 'Imported from PDF table'
        });
      }
    });
  }
  
  // If no table data found, try pattern matching
  if (parsedData.length === 0) {
    console.log('[DEBUG] No table found, trying pattern matching');
    
    let globalPartyName = '';
    let currentRecord = {};
    
    // Extract global party name first
    const partyMatch = text.match(/(?:from|supplier|vendor|sold\s*by|dealer)\s*:?\s*([A-Za-z0-9\s&\.,\-]+)(?:\n|address|phone|email|\d{6})/i);
    if (partyMatch) {
      globalPartyName = partyMatch[1].trim().split(/\n|address|phone|email/)[0].trim();
      console.log('[DEBUG] Global party name found:', globalPartyName);
    }
    
    // Pattern matching approach
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line || line.length < 3) continue;
      
      // Try each pattern
      for (const [key, pattern] of Object.entries(patterns)) {
        const match = line.match(pattern);
        if (match && match[1]) {
          const value = match[1].trim();
          
          switch (key) {
            case 'party':
              if (!globalPartyName) globalPartyName = value;
              break;
            case 'item':
              if (currentRecord.item_name && Object.keys(currentRecord).length >= 2) {
                // Save previous record and start new one
                if (currentRecord.item_name && (currentRecord.purchase_price > 0 || currentRecord.selling_price > 0)) {
                  parsedData.push({
                    party_name: globalPartyName || currentRecord.party_name || 'PDF Import',
                    ...currentRecord,
                    quantity: currentRecord.quantity || 1,
                    notes: 'Extracted from PDF patterns'
                  });
                }
                currentRecord = {};
              }
              currentRecord.item_name = value;
              break;
            case 'purchasePrice':
              currentRecord.purchase_price = parseFloat(value.replace(/,/g, '')) || 0;
              break;
            case 'sellingPrice':
              currentRecord.selling_price = parseFloat(value.replace(/,/g, '')) || 0;
              break;
            case 'quantity':
              currentRecord.quantity = parseInt(value.replace(/,/g, '')) || 1;
              break;
            case 'barcode':
              currentRecord.barcode = value;
              break;
            case 'date':
              currentRecord.date = value;
              break;
            case 'notes':
              currentRecord.notes = value;
              break;
          }
        }
      }
    }
    
    // Add the last record
    if (currentRecord.item_name && (currentRecord.purchase_price > 0 || currentRecord.selling_price > 0)) {
      parsedData.push({
        party_name: globalPartyName || currentRecord.party_name || 'PDF Import',
        ...currentRecord,
        quantity: currentRecord.quantity || 1,
        notes: 'Extracted from PDF patterns'
      });
    }
  }
  
  // Fallback: Extract any price information
  if (parsedData.length === 0) {
    console.log('[DEBUG] No structured data found, trying fallback extraction');
    
    const priceMatches = text.match(/[₹$]?\s*[0-9,]+(?:\.[0-9]{1,2})?/g);
    const itemMatches = text.match(/[A-Za-z][A-Za-z0-9\s]{3,30}(?=\s*[₹$]?[0-9])/g);
    
    if (priceMatches && priceMatches.length >= 2 && itemMatches && itemMatches.length > 0) {
      const cleanPrices = priceMatches.map(p => parseFloat(p.replace(/[^\d.]/g, ''))).filter(p => p > 0);
      
      itemMatches.slice(0, Math.min(3, cleanPrices.length)).forEach((item, index) => {
        if (cleanPrices[index * 2] || cleanPrices[index * 2 + 1]) {
          parsedData.push({
            party_name: 'PDF Extraction',
            item_name: item.trim(),
            purchase_price: cleanPrices[index * 2] || 0,
            selling_price: cleanPrices[index * 2 + 1] || cleanPrices[index * 2] || 0,
            quantity: 1,
            notes: 'Auto-extracted from PDF - please verify details'
          });
        }
      });
    }
  }
  
  console.log('[DEBUG] PDF Text Parsing: Extracted', parsedData.length, 'records');
  parsedData.forEach((record, index) => {
    console.log(`[DEBUG] Record ${index + 1}:`, record);
  });
  
  return parsedData;
}

// File Upload Modal Component
function FileUploadModal({ onClose, onFileProcessed }) {
  const [uploading, setUploading] = useState(false);
  const [uploadingStatus, setUploadingStatus] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const fileInputRef = useRef(null);
  
  // Reset states when modal opens
  useEffect(() => {
    setUploadingStatus('');
    setProcessingProgress(0);
  }, []);

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Check file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(fileExtension)) {
      alert('Please upload an Excel (.xlsx, .xls), CSV (.csv), or PDF (.pdf) file');
      return;
    }

    setUploading(true);
    setUploadingStatus('Starting file processing...');
    setProcessingProgress(10);
    
    try {
      let parsedData = [];

      if (fileExtension === 'csv') {
        // Parse CSV file
        setUploadingStatus('Reading CSV file...');
        setProcessingProgress(30);
        
        const text = await file.text();
        const Papa = await import('papaparse');
        
        setUploadingStatus('Parsing CSV data...');
        setProcessingProgress(50);
        
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        parsedData = result.data;
        
        console.log('[DEBUG] CSV parsing completed, found', parsedData.length, 'rows');
      } else if (fileExtension === 'pdf') {
        // PDF processing is being enhanced - temporarily show helpful message
        alert(`PDF Processing Available! 📄\n\nWe're working on enhanced PDF processing. Currently supported:\n\n✅ CSV files (.csv) - Full support\n✅ Excel files (.xlsx, .xls) - Full support\n\n🔄 PDF files - Enhanced processing coming soon!\n\nFor now, please:\n1. Convert your PDF to CSV/Excel format\n2. Or manually enter the data\n\nThe system will soon support:\n• Smart table detection\n• Invoice parsing\n• Multi-page processing\n• Pattern recognition`);
        return;
      } else {
        // Unsupported file type
        alert('Unsupported file type. Please use CSV files for bulk import or enter data manually.');
        return;
      }

      // Process parsed data
      setUploadingStatus('Processing extracted data...');
      setProcessingProgress(70);
      
      const processedPurchases = [];
      const currentDate = new Date().toISOString().split('T')[0];

      parsedData.forEach((row, index) => {
        try {
          let purchase;
          
          if (fileExtension === 'pdf') {
            // For PDF data, the structure is already parsed
            purchase = {
              party_name: row.party_name || 'PDF Import',
              item_name: row.item_name || `Item ${index + 1}`,
              barcode: row.barcode || '',
              purchase_price: row.purchase_price || 0,
              selling_price: row.selling_price || 0,
              purchased_quantity: row.quantity || 1,
              remaining_quantity: row.quantity || 1,
              purchase_date: row.date || currentDate,
              notes: row.notes || 'Imported from PDF'
            };
          } else {
            // Debug raw row data
            console.log(`[DEBUG] Processing row ${index + 1}:`, row);
            console.log(`[DEBUG] Row keys:`, Object.keys(row));

            // Map common column names for Excel/CSV (flexible mapping)
            const itemName = row['Item Name'] || row['item_name'] || row['Product'] || row['product'] || row['Product Name'];
            const partyName = row['Party Name'] || row['party_name'] || row['Supplier'] || row['supplier'];
            const purchasePrice = row['Purchase Price'] || row['purchase_price'] || row['Cost Price'] || row['cost_price'];
            const sellingPrice = row['Selling Price'] || row['selling_price'] || row['Sale Price'] || row['sale_price'];
            const quantity = row['Quantity'] || row['quantity'] || row['Purchased Quantity'] || row['purchased_quantity'];
            const barcode = row['Barcode'] || row['barcode'] || row['Code'] || row['code'];

            purchase = {
              party_name: partyName || 'Unknown Party',
              item_name: itemName || `Item ${index + 1}`,
              barcode: barcode || '',
              purchase_price: purchasePrice ? parseFloat(String(purchasePrice).replace(/[^\d.]/g, '')) || 0 : 0,
              selling_price: sellingPrice ? parseFloat(String(sellingPrice).replace(/[^\d.]/g, '')) || 0 : 0,
              purchased_quantity: quantity ? parseInt(String(quantity)) || 1 : 1,
              remaining_quantity: quantity ? parseInt(String(quantity)) || 1 : 1,
              purchase_date: row['Purchase Date'] || row['purchase_date'] || row['Date'] || row['date'] || currentDate,
              notes: row['Notes'] || row['notes'] || row['Description'] || row['description'] || ''
            };
          }

          console.log(`[DEBUG] Processed purchase ${index + 1}:`, purchase);

          // Validate required fields
          if (purchase.item_name && (purchase.purchase_price > 0 || purchase.selling_price > 0) && purchase.purchased_quantity > 0) {
            processedPurchases.push(purchase);
          }
        } catch (error) {
          console.warn(`Skipping row ${index + 1} due to error:`, error);
        }
      });

      if (processedPurchases.length === 0) {
        alert('No valid data found in the file. Please check the format and try again.');
        return;
      }

      // Save to database
      setUploadingStatus('Saving to database...');
      setProcessingProgress(90);
      
      const savedPurchases = [];
      for (let i = 0; i < processedPurchases.length; i++) {
        const purchase = processedPurchases[i];
        try {
          const savedPurchase = await createPartyPurchase(purchase);
          savedPurchases.push(savedPurchase);
          
          // Update progress
          const progress = 90 + (10 * (i + 1) / processedPurchases.length);
          setProcessingProgress(Math.round(progress));
        } catch (error) {
          console.error('Error saving purchase:', error);
        }
      }

      onFileProcessed(savedPurchases);
      alert(`Successfully imported ${savedPurchases.length} purchases from file!`);

    } catch (error) {
      console.error('Error processing file:', error);
      alert('Error processing file. Please check the format and try again.');
    } finally {
      setUploading(false);
      setUploadingStatus('');
      setProcessingProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[9999]">
      <div className="bg-white rounded-xl max-w-lg w-full">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Upload Purchase File</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center ${
              dragOver ? 'border-primary-500 bg-primary-50' : 'border-gray-300'
            } ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              onChange={(e) => handleFileUpload(e.target.files[0])}
              className="hidden"
            />
            
            <Upload className={`h-12 w-12 mx-auto mb-4 ${dragOver ? 'text-primary-500' : 'text-gray-400'}`} />
            
            {uploading ? (
              <div>
                <div className="mb-4">
                  <div className="loading-spinner mx-auto mb-4"></div>
                </div>
                <p className="text-lg font-medium text-gray-900 mb-2">Processing file...</p>
                <p className="text-sm text-gray-500 mb-3">{uploadingStatus || 'Please wait while we import your purchases'}</p>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                  <div 
                    className="bg-primary-600 h-2 rounded-full transition-all duration-300 ease-out" 
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
                <p className="text-xs text-gray-500 text-center">{processingProgress}%</p>
              </div>
            ) : (
              <div>
                <p className="text-lg font-medium text-gray-900 mb-2">Drop your file here or click to browse</p>
                <p className="text-sm text-gray-500 mb-4">Supports Excel (.xlsx, .xls), CSV (.csv), and PDF (.pdf) files</p>
                <button className="btn-primary">
                  Choose File
                </button>
              </div>
            )}
          </div>

          {/* Expected Format Info */}
          <div className="mt-6 p-4 bg-primary-50 rounded-lg">
            <h3 className="font-medium text-gray-900 mb-2">Expected File Format:</h3>
            <p className="text-sm text-gray-600 mb-2">Your file should contain columns/data with these fields (flexible):</p>
            <ul className="text-sm text-gray-600 space-y-1 mb-3">
              <li>• <strong>Party Name/Supplier:</strong> Supplier name</li>
              <li>• <strong>Item Name/Product:</strong> Product name</li>
              <li>• <strong>Purchase Price/Cost Price:</strong> Purchase cost</li>
              <li>• <strong>Selling Price/Sale Price:</strong> Selling price</li>
              <li>• <strong>Quantity:</strong> Purchased quantity</li>
              <li>• <strong>Barcode/Code:</strong> Product code (optional)</li>
              <li>• <strong>Purchase Date/Date:</strong> Purchase date (optional)</li>
              <li>• <strong>Notes/Description:</strong> Additional notes (optional)</li>
            </ul>
            <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded mb-2">
              <strong>📄 Enhanced PDF Support:</strong> 
              <ul className="mt-1 space-y-1">
                <li>• Automatic text extraction from PDF documents</li>
                <li>• Smart table detection and parsing</li>
                <li>• Pattern recognition for invoices and purchase orders</li>
                <li>• Fallback extraction for unstructured PDFs</li>
                <li>• Works best with text-based PDFs (not scanned images)</li>
              </ul>
            </div>
            <div className="text-xs text-gray-500 bg-amber-50 p-2 rounded">
              <strong>💡 Tip:</strong> For scanned PDFs or image-based documents, convert to text first or use CSV/Excel format for better results.
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button onClick={onClose} className="btn-outline flex-1">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main App Component
function InventoryApp() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewHistory, setViewHistory] = useState(['dashboard']);

  const handleNavigate = (view) => {
    // Prevent duplicate entries in history
    if (view !== currentView) {
      setViewHistory(prev => [...prev, view]);
      setCurrentView(view);
      setMobileMenuOpen(false);
    }
  };

  const handleBack = () => {
    if (viewHistory.length > 1) {
      const newHistory = [...viewHistory];
      newHistory.pop(); // Remove current view
      const previousView = newHistory[newHistory.length - 1];
      setViewHistory(newHistory);
      setCurrentView(previousView);
    } else {
      // If no history, go to dashboard
      setCurrentView('dashboard');
      setViewHistory(['dashboard']);
    }
  };

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (event) => {
      event.preventDefault();
      handleBack();
    };

    // Add browser history entry
    if (typeof window !== 'undefined') {
      window.history.pushState({ view: currentView }, '', `#${currentView}`);
      window.addEventListener('popstate', handlePopState);
    }

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', handlePopState);
      }
    };
  }, [currentView]);

  const getViewTitle = (view) => {
    switch (view) {
      case 'dashboard': return 'Dashboard';
      case 'products': return 'Products';
      case 'quick-sale': return 'Quick Sale';
      case 'party': return 'Party Purchases';
      default: return 'Dashboard';
    }
  };

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} />;
      case 'products':
        return <ProductManagement onNavigate={handleNavigate} />;
      case 'quick-sale':
        return <QuickSale onNavigate={handleNavigate} />;
      case 'party':
        return <PartyManagement onNavigate={handleNavigate} />;
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-primary-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              {/* Mobile Back Button */}
              <div className="flex md:hidden mr-3">
                {currentView !== 'dashboard' ? (
                  <button
                    onClick={handleBack}
                    className="p-2 rounded-md text-gray-600 hover:text-primary-600 hover:bg-primary-50 touch-target"
                    aria-label="Go back"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                ) : null}
              </div>
              
              <div className="flex-shrink-0">
                <button
                  onClick={() => handleNavigate('dashboard')}
                  className="text-xl font-bold text-primary-600 hover:text-primary-700"
                >
                  Inventory Pro
                </button>
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <button
                    onClick={() => handleNavigate('dashboard')}
                    className={`nav-link ${currentView === 'dashboard' ? 'nav-link-active' : ''}`}
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Dashboard
                  </button>
                  <button
                    onClick={() => handleNavigate('products')}
                    className={`nav-link ${currentView === 'products' ? 'nav-link-active' : ''}`}
                  >
                    <Package className="h-4 w-4 mr-2" />
                    Products
                  </button>
                  <button
                    onClick={() => handleNavigate('quick-sale')}
                    className={`nav-link ${currentView === 'quick-sale' ? 'nav-link-active' : ''}`}
                  >
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Quick Sale
                  </button>
                  <button
                    onClick={() => handleNavigate('party')}
                    className={`nav-link ${currentView === 'party' ? 'nav-link-active' : ''}`}
                  >
                    <Users className="h-4 w-4 mr-2" />
                    Party
                  </button>
                </div>
              </div>
            </div>
            
            {/* Mobile Menu Button */}
            <div className="flex md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-md text-gray-600 hover:text-primary-600 hover:bg-primary-50 touch-target"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-gray-200 shadow-lg">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <button
                onClick={() => handleNavigate('dashboard')}
                className={`mobile-nav-link ${currentView === 'dashboard' ? 'mobile-nav-link-active' : ''}`}
              >
                <Home className="h-5 w-5 mr-3" />
                Dashboard
              </button>
              <button
                onClick={() => handleNavigate('products')}
                className={`mobile-nav-link ${currentView === 'products' ? 'mobile-nav-link-active' : ''}`}
              >
                <Package className="h-5 w-5 mr-3" />
                Products
              </button>
              <button
                onClick={() => handleNavigate('quick-sale')}
                className={`mobile-nav-link ${currentView === 'quick-sale' ? 'mobile-nav-link-active' : ''}`}
              >
                <ShoppingCart className="h-5 w-5 mr-3" />
                Quick Sale
              </button>
              <button
                onClick={() => handleNavigate('party')}
                className={`mobile-nav-link ${currentView === 'party' ? 'mobile-nav-link-active' : ''}`}
              >
                <Users className="h-5 w-5 mr-3" />
                Party Purchases
              </button>
            </div>
          </div>
        )}
      </nav>
      
      {/* Mobile Page Title */}
      <div className="md:hidden bg-white border-b border-gray-200 px-4 py-3">
        <h1 className="text-lg font-semibold text-gray-900">{getViewTitle(currentView)}</h1>
      </div>

      {/* Main Content */}
      <main>
        {renderCurrentView()}
      </main>
    </div>
  );
}

export default InventoryApp;