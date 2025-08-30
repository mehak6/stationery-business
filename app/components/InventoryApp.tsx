import React, { useState, useEffect } from 'react';
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
  FileImage,
  X,
  Check
} from 'lucide-react';

// Import Supabase functions
import {
  getProducts,
  getSales,
  getCategories,
  createProduct,
  createSale,
  updateProduct,
  getAnalytics,
  type Product,
  type Sale,
  type Category
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

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
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
              onClick={() => onNavigate('sales')}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentSales.map(sale => (
              <div key={sale.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{sale.products?.name || 'Unknown Product'}</p>
                  <p className="text-sm text-gray-500">Qty: {sale.quantity} • ₹{sale.unit_price}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">₹{sale.total_amount}</p>
                  <p className="text-sm text-secondary-600">Profit: ₹{sale.profit}</p>
                </div>
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
                  <p className="text-sm text-gray-500">{product.categories?.name || 'No Category'}</p>
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
    </div>
  );
}

// Product Management Component
function ProductManagement({ onNavigate }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch products and categories on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsData, categoriesData] = await Promise.all([
          getProducts(),
          getCategories()
        ]);
        setProducts(productsData || []);
        setCategories(categoriesData || []);
      } catch (error) {
        console.error('Error fetching data:', error);
        // Set empty arrays on error
        setProducts([]);
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         product.barcode?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || (product.categories?.name === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  const handleDeleteProduct = (productId) => {
    if (confirm('Are you sure you want to delete this product?')) {
      setProducts(products.filter(p => p.id !== productId));
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
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

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
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
          <div className="sm:w-48">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="input-field"
            >
              <option value="">All Categories</option>
              {categories.map(category => (
                <option key={category.id} value={category.name}>{category.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex justify-center items-center py-12">
          <div className="loading-spinner"></div>
          <span className="ml-3 text-gray-600">Loading products...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map(product => (
          <div key={product.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <span className="badge-info">{product.categories?.name || 'No Category'}</span>
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
              <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center mb-3">
                <FileImage className="h-12 w-12 text-gray-400" />
              </div>
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
          categories={categories}
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
function AddProductModal({ categories, onClose, onProductAdded }) {
  const [formData, setFormData] = useState({
    name: '',
    category_id: '',
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
        category_id: formData.category_id || null,
        barcode: formData.barcode || null,
        purchase_price: parseFloat(formData.purchase_price),
        selling_price: parseFloat(formData.selling_price),
        stock_quantity: parseInt(formData.stock_quantity),
        min_stock_level: parseInt(formData.min_stock_level) || 5,
        description: formData.description || null
      };

      // Create product in Supabase
      const newProduct = await createProduct(productData);
      
      // Add the category information for display
      const category = categories.find(cat => cat.id === productData.category_id);
      const productWithCategory = {
        ...newProduct,
        categories: category
      };

      onProductAdded(productWithCategory);
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
              <label className="form-label">Category *</label>
              <select
                required
                value={formData.category_id}
                onChange={(e) => setFormData({...formData, category_id: e.target.value})}
                className="input-field"
              >
                <option value="">Select category</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
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
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    phone: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

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
        quantity: parseInt(quantity),
        unit_price: parseFloat(selectedProduct.selling_price),
        total_amount: totalAmount,
        profit: profit,
        customer_info: customerInfo.name || customerInfo.phone ? {
          name: customerInfo.name || null,
          phone: customerInfo.phone || null
        } : null,
        sale_date: new Date().toISOString().split('T')[0], // Today's date
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

      alert(`Sale completed! Total: ₹${totalAmount.toFixed(2)}`);
      
      // Reset form
      setSelectedProduct(null);
      setQuantity(1);
      setCustomerInfo({ name: '', phone: '' });
      setSearchTerm('');

    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Error processing sale: ' + error.message);
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Quick Sale</h1>
        <p className="text-gray-600 mt-2">Process sales quickly and efficiently</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
                    <p className="text-sm text-gray-500">{product.categories?.name || 'No Category'} • {product.barcode}</p>
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

              {/* Customer Info */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900">Customer Information (Optional)</h4>
                <div className="form-group">
                  <input
                    type="text"
                    placeholder="Customer name"
                    value={customerInfo.name}
                    onChange={(e) => setCustomerInfo({...customerInfo, name: e.target.value})}
                    className="input-field"
                  />
                </div>
                <div className="form-group">
                  <input
                    type="tel"
                    placeholder="Phone number"
                    value={customerInfo.phone}
                    onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
                    className="input-field"
                  />
                </div>
              </div>

              {/* Sale Summary */}
              <div className="p-4 bg-gray-50 rounded-lg">
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
                    setCustomerInfo({ name: '', phone: '' });
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
      default:
        return <Dashboard onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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