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
  Upload
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';

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

  const [recentSales, setRecentSales] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);

  // Fetch dashboard data on component mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        const [analyticsData, salesData, productsData] = await Promise.all([
          getAnalytics(),
          getSales(5), // Get recent 5 sales
          getProducts()
        ]);
        
        setAnalytics(analyticsData || {
          totalProducts: 0,
          totalSales: 0,
          totalProfit: 0,
          todaySales: 0,
          todayProfit: 0,
          lowStockProducts: 0
        });
        
        setRecentSales(salesData || []);
        
        // Filter low stock items
        const lowStock = (productsData || []).filter(p => p.stock_quantity <= p.min_stock_level);
        setLowStockItems(lowStock);

        // Prepare chart data (last 7 days sales)
        const last7Days = [];
        for (let i = 6; i >= 0; i--) {
          const date = new Date();
          date.setDate(date.getDate() - i);
          const dateStr = date.toISOString().split('T')[0];
          
          const daySales = (salesData || []).filter(sale => 
            sale.sale_date === dateStr
          );
          
          const dayRevenue = daySales.reduce((sum, sale) => sum + (sale.total_amount || 0), 0);
          const dayProfit = daySales.reduce((sum, sale) => sum + (sale.profit || 0), 0);
          
          last7Days.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            sales: daySales.length,
            revenue: dayRevenue,
            profit: dayProfit
          });
        }
        setChartData(last7Days);

        // Simplified product count for pie chart
        const totalProducts = (productsData || []).length;
        setCategoryData([{ name: 'All Products', value: totalProducts }]);
        
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
        // Set empty states on error
        setRecentSales([]);
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
      
      // Update recent sales by removing the deleted sale
      setRecentSales(prevSales => prevSales.filter(sale => sale.id !== saleId));
      
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
      
      alert('Sale deleted successfully!');
    } catch (error) {
      console.error('Error deleting sale:', error);
      alert('Error deleting sale: ' + error.message);
    }
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
        {/* Recent Sales */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Sales</h3>
            <button 
              onClick={() => onNavigate('quick-sale')}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              Make Sale
            </button>
          </div>
          <div className="space-y-4">
            {recentSales.length === 0 && (
              <div className="text-center py-8">
                <p className="text-gray-500">No recent sales</p>
                <button 
                  onClick={() => onNavigate('quick-sale')}
                  className="mt-2 btn-primary"
                >
                  Make Your First Sale
                </button>
              </div>
            )}
            {recentSales.map(sale => (
              <div key={sale.id} className="flex items-center justify-between p-4 bg-primary-50 rounded-lg">
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
        </div>

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

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
        {/* Sales Trend Chart */}
        <div className="lg:col-span-2 card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend (Last 7 Days)</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke="#3b82f6" 
                  fill="#3b82f6" 
                  fillOpacity={0.2}
                  name="Revenue (₹)"
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#10b981" 
                  fill="#10b981" 
                  fillOpacity={0.2}
                  name="Profit (₹)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Distribution */}
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory by Category</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'][index % 5]}
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
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
    <div className="p-6 bg-primary-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
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
      const totalAmount = selectedProduct.selling_price * quantity;
      const profit = (selectedProduct.selling_price - selectedProduct.purchase_price) * quantity;

      // Create sale record
      const saleData = {
        product_id: selectedProduct.id,
        quantity: parseInt(quantity.toString()),
        unit_price: parseFloat(selectedProduct.selling_price),
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
                onClick={() => setSelectedProduct(product)}
                className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                  selectedProduct?.id === product.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-primary-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{product.name}</h4>
                    <p className="text-sm text-gray-500">{product.barcode}</p>
                    <p className="text-sm font-medium text-secondary-600">₹{product.selling_price}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm ${product.stock_quantity <= product.min_stock_level ? 'text-danger-600' : 'text-gray-600'}`}>
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
                    <span>₹{selectedProduct.selling_price}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Quantity:</span>
                    <span>{quantity}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-lg border-t pt-2">
                    <span>Total:</span>
                    <span>₹{(selectedProduct.selling_price * quantity).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-secondary-600">
                    <span>Profit:</span>
                    <span>₹{((selectedProduct.selling_price - selectedProduct.purchase_price) * quantity).toFixed(2)}</span>
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
    <div className="p-6 bg-primary-50 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Party Purchases</h1>
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="card">
              <div className="skeleton-title mb-2"></div>
              <div className="skeleton-text mb-2 w-3/4"></div>
              <div className="skeleton-text mb-4 w-1/2"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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

// PDF Text Parsing Function
function parsePDFText(text) {
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  const parsedData = [];
  
  // Try to identify table-like structures or key-value pairs
  let currentRecord = {};
  let isInTable = false;
  let headers = [];
  
  // Common patterns to look for
  const patterns = {
    party: /(?:party|supplier|vendor|from)[\s:]+([^\n\r]+)/i,
    item: /(?:item|product|description|name)[\s:]+([^\n\r]+)/i,
    purchasePrice: /(?:purchase|cost|buy)[\s\$₹]*price[\s:]*[\$₹]*([0-9,\.]+)/i,
    sellingPrice: /(?:sell|sale|retail)[\s\$₹]*price[\s:]*[\$₹]*([0-9,\.]+)/i,
    quantity: /(?:quantity|qty|amount|units?)[\s:]*([0-9,\.]+)/i,
    barcode: /(?:barcode|code|sku|id)[\s:]+([A-Za-z0-9\-_]+)/i,
    date: /(?:date|purchased|bought)[\s:]*([0-9]{1,2}[\/\-][0-9]{1,2}[\/\-][0-9]{2,4})/i,
    notes: /(?:notes?|remarks?|description)[\s:]+([^\n\r]+)/i
  };
  
  // Try to extract structured data from text
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and headers
    if (!line || line.match(/^(page|total|subtotal|invoice|receipt)/i)) continue;
    
    // Check for table headers
    if (line.match(/party|supplier|item|product|price|quantity|qty/i) && 
        line.split(/\s{2,}|\t/).length > 2) {
      headers = line.split(/\s{2,}|\t/).map(h => h.trim().toLowerCase());
      isInTable = true;
      continue;
    }
    
    // If we're in a table and have headers, try to parse as table row
    if (isInTable && headers.length > 0) {
      const values = line.split(/\s{2,}|\t/).map(v => v.trim());
      if (values.length >= headers.length - 1) {
        const record = {};
        headers.forEach((header, index) => {
          if (values[index]) {
            if (header.includes('party') || header.includes('supplier')) record.party_name = values[index];
            else if (header.includes('item') || header.includes('product')) record.item_name = values[index];
            else if (header.includes('purchase') || header.includes('cost')) record.purchase_price = parseFloat(values[index].replace(/[^\d.]/g, '')) || 0;
            else if (header.includes('sell') || header.includes('sale')) record.selling_price = parseFloat(values[index].replace(/[^\d.]/g, '')) || 0;
            else if (header.includes('qty') || header.includes('quantity')) record.quantity = parseInt(values[index]) || 0;
            else if (header.includes('code') || header.includes('barcode')) record.barcode = values[index];
            else if (header.includes('date')) record.date = values[index];
          }
        });
        
        if (record.item_name && (record.purchase_price > 0 || record.selling_price > 0)) {
          parsedData.push(record);
        }
        continue;
      } else {
        isInTable = false; // End of table
      }
    }
    
    // Try pattern matching for key-value pairs
    let foundMatch = false;
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = line.match(pattern);
      if (match) {
        foundMatch = true;
        switch (key) {
          case 'party':
            currentRecord.party_name = match[1].trim();
            break;
          case 'item':
            currentRecord.item_name = match[1].trim();
            break;
          case 'purchasePrice':
            currentRecord.purchase_price = parseFloat(match[1].replace(/,/g, '')) || 0;
            break;
          case 'sellingPrice':
            currentRecord.selling_price = parseFloat(match[1].replace(/,/g, '')) || 0;
            break;
          case 'quantity':
            currentRecord.quantity = parseInt(match[1]) || 0;
            break;
          case 'barcode':
            currentRecord.barcode = match[1].trim();
            break;
          case 'date':
            currentRecord.date = match[1].trim();
            break;
          case 'notes':
            currentRecord.notes = match[1].trim();
            break;
        }
      }
    }
    
    // If we found a complete record (has item and at least one price), save it
    if (currentRecord.item_name && (currentRecord.purchase_price > 0 || currentRecord.selling_price > 0)) {
      // If we just completed a record, save it and start a new one
      if (foundMatch && Object.keys(currentRecord).length >= 3) {
        parsedData.push({ ...currentRecord });
        currentRecord = {};
      }
    }
  }
  
  // Add the last record if it's valid
  if (currentRecord.item_name && (currentRecord.purchase_price > 0 || currentRecord.selling_price > 0)) {
    parsedData.push(currentRecord);
  }
  
  // If no structured data found, try to create a generic record from any price information
  if (parsedData.length === 0) {
    const priceMatches = text.match(/[\$₹]?[0-9,]+\.?[0-9]*/g);
    if (priceMatches && priceMatches.length >= 2) {
      parsedData.push({
        party_name: 'PDF Import',
        item_name: 'Extracted Item',
        purchase_price: parseFloat(priceMatches[0].replace(/[^\d.]/g, '')) || 0,
        selling_price: parseFloat(priceMatches[1].replace(/[^\d.]/g, '')) || 0,
        quantity: 1,
        notes: 'Extracted from PDF - please verify details'
      });
    }
  }
  
  return parsedData;
}

// File Upload Modal Component
function FileUploadModal({ onClose, onFileProcessed }) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (file) => {
    if (!file) return;

    // Check file type
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'pdf'].includes(fileExtension)) {
      alert('Please upload an Excel (.xlsx, .xls), CSV (.csv), or PDF (.pdf) file');
      return;
    }

    setUploading(true);
    
    try {
      let parsedData = [];

      if (fileExtension === 'csv') {
        // Parse CSV file
        const text = await file.text();
        const Papa = await import('papaparse');
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        parsedData = result.data;
      } else if (fileExtension === 'pdf') {
        // PDF processing temporarily disabled due to compatibility issues
        alert('PDF processing is temporarily disabled. Please use CSV or Excel files for bulk import, or enter data manually.');
        parsedData = [];
        return;
      } else {
        // Unsupported file type
        alert('Unsupported file type. Please use CSV files for bulk import or enter data manually.');
        return;
      }

      // Process parsed data
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
      const savedPurchases = [];
      for (const purchase of processedPurchases) {
        try {
          const savedPurchase = await createPartyPurchase(purchase);
          savedPurchases.push(savedPurchase);
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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
                <p className="text-lg font-medium text-gray-900 mb-2">Processing file...</p>
                <p className="text-sm text-gray-500">Please wait while we import your purchases</p>
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
            <div className="text-xs text-gray-500 bg-blue-50 p-2 rounded">
              <strong>PDF Support:</strong> For PDF files, the system will automatically extract text and try to identify product information using pattern recognition. Best results with structured documents like invoices or purchase orders.
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

  const handleNavigate = (view) => {
    setCurrentView(view);
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
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-xl font-bold text-primary-600">Inventory Pro</h1>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <button
                    onClick={() => setCurrentView('dashboard')}
                    className={`nav-link ${currentView === 'dashboard' ? 'nav-link-active' : ''}`}
                  >
                    Dashboard
                  </button>
                  <button
                    onClick={() => setCurrentView('products')}
                    className={`nav-link ${currentView === 'products' ? 'nav-link-active' : ''}`}
                  >
                    Products
                  </button>
                  <button
                    onClick={() => setCurrentView('quick-sale')}
                    className={`nav-link ${currentView === 'quick-sale' ? 'nav-link-active' : ''}`}
                  >
                    Quick Sale
                  </button>
                  <button
                    onClick={() => setCurrentView('party')}
                    className={`nav-link ${currentView === 'party' ? 'nav-link-active' : ''}`}
                  >
                    Party
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main>
        {renderCurrentView()}
      </main>
    </div>
  );
}

export default InventoryApp;