-- =============================================
-- Simplified Stationery & Games Inventory Management System
-- NO USER AUTHENTICATION - Single User Setup
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. CATEGORIES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 2. PRODUCTS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    barcode TEXT UNIQUE,
    purchase_price DECIMAL(10,2) NOT NULL CHECK (purchase_price >= 0),
    selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
    stock_quantity INTEGER DEFAULT 0 CHECK (stock_quantity >= 0),
    min_stock_level INTEGER DEFAULT 5 CHECK (min_stock_level >= 0),
    supplier_info JSONB,
    image_url TEXT,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 3. CUSTOMERS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS customers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    total_purchases DECIMAL(10,2) DEFAULT 0 CHECK (total_purchases >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 4. SALES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS sales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_amount DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    profit DECIMAL(10,2) NOT NULL,
    customer_info JSONB,
    sale_date DATE DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =============================================
-- 5. DISABLE RLS (Row Level Security)
-- Since we don't need authentication
-- =============================================
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;

-- =============================================
-- 6. INDEXES for Better Performance
-- =============================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);

-- Sales indexes
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- =============================================
-- 7. FUNCTIONS AND TRIGGERS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for products table
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at 
    BEFORE UPDATE ON products 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update product stock after sale
CREATE OR REPLACE FUNCTION update_product_stock_after_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Update product stock quantity
    UPDATE products 
    SET stock_quantity = stock_quantity - NEW.quantity,
        updated_at = NOW()
    WHERE id = NEW.product_id;
    
    -- Check if stock went below zero (shouldn't happen with proper validation)
    IF (SELECT stock_quantity FROM products WHERE id = NEW.product_id) < 0 THEN
        RAISE EXCEPTION 'Insufficient stock for product %', NEW.product_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update stock after sale
DROP TRIGGER IF EXISTS trigger_update_stock_after_sale ON sales;
CREATE TRIGGER trigger_update_stock_after_sale
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock_after_sale();

-- Function to restore stock when sale is deleted
CREATE OR REPLACE FUNCTION restore_product_stock_after_sale_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Restore product stock quantity
    UPDATE products 
    SET stock_quantity = stock_quantity + OLD.quantity,
        updated_at = NOW()
    WHERE id = OLD.product_id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to restore stock after sale deletion
DROP TRIGGER IF EXISTS trigger_restore_stock_after_sale_delete ON sales;
CREATE TRIGGER trigger_restore_stock_after_sale_delete
    AFTER DELETE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION restore_product_stock_after_sale_delete();

-- =============================================
-- 8. SAMPLE DATA
-- =============================================

-- Insert sample categories
INSERT INTO categories (name, description) VALUES
('Stationery', 'Office and school supplies'),
('Games', 'Board games, card games, and puzzles'),
('Art Supplies', 'Drawing, painting, and craft materials'),
('Electronics', 'Calculators, batteries, and electronic accessories'),
('Books', 'Notebooks, journals, and reference books')
ON CONFLICT (name) DO NOTHING;

-- Insert sample products
INSERT INTO products (name, category_id, barcode, purchase_price, selling_price, stock_quantity, min_stock_level, description) 
SELECT 
    'Blue Pen', 
    c.id, 
    'ST001', 
    5.00, 
    8.00, 
    50, 
    10,
    'High-quality blue ballpoint pen'
FROM categories c WHERE c.name = 'Stationery'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO products (name, category_id, barcode, purchase_price, selling_price, stock_quantity, min_stock_level, description) 
SELECT 
    'Red Pen', 
    c.id, 
    'ST002', 
    5.00, 
    8.00, 
    45, 
    10,
    'High-quality red ballpoint pen'
FROM categories c WHERE c.name = 'Stationery'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO products (name, category_id, barcode, purchase_price, selling_price, stock_quantity, min_stock_level, description) 
SELECT 
    'Notebook A4', 
    c.id, 
    'ST003', 
    12.00, 
    18.00, 
    30, 
    15,
    '200-page ruled notebook'
FROM categories c WHERE c.name = 'Stationery'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO products (name, category_id, barcode, purchase_price, selling_price, stock_quantity, min_stock_level, description) 
SELECT 
    'Chess Set', 
    c.id, 
    'GM001', 
    25.00, 
    40.00, 
    8, 
    5,
    'Standard wooden chess set with board'
FROM categories c WHERE c.name = 'Games'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO products (name, category_id, barcode, purchase_price, selling_price, stock_quantity, min_stock_level, description) 
SELECT 
    'Playing Cards', 
    c.id, 
    'GM002', 
    3.00, 
    6.00, 
    25, 
    10,
    'Standard 52-card deck'
FROM categories c WHERE c.name = 'Games'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO products (name, category_id, barcode, purchase_price, selling_price, stock_quantity, min_stock_level, description) 
SELECT 
    'Colored Pencils Set', 
    c.id, 
    'ART001', 
    15.00, 
    25.00, 
    20, 
    8,
    '24-color pencil set'
FROM categories c WHERE c.name = 'Art Supplies'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO products (name, category_id, barcode, purchase_price, selling_price, stock_quantity, min_stock_level, description) 
SELECT 
    'Scientific Calculator', 
    c.id, 
    'ELC001', 
    45.00, 
    70.00, 
    12, 
    5,
    'Advanced scientific calculator'
FROM categories c WHERE c.name = 'Electronics'
ON CONFLICT (barcode) DO NOTHING;

INSERT INTO products (name, category_id, barcode, purchase_price, selling_price, stock_quantity, min_stock_level, description) 
SELECT 
    'Diary 2024', 
    c.id, 
    'BK001', 
    20.00, 
    35.00, 
    15, 
    8,
    'Personal diary with date pages'
FROM categories c WHERE c.name = 'Books'
ON CONFLICT (barcode) DO NOTHING;

-- Insert sample customers
INSERT INTO customers (name, phone, email, address) VALUES
('John Doe', '+91-9876543210', 'john.doe@email.com', '123 Main Street, Bareilly'),
('Jane Smith', '+91-9876543211', 'jane.smith@email.com', '456 Park Avenue, Bareilly'),
('Mike Johnson', '+91-9876543212', 'mike.johnson@email.com', '789 Oak Road, Bareilly'),
('Sarah Williams', '+91-9876543213', 'sarah.williams@email.com', '321 Pine Street, Bareilly'),
('David Brown', '+91-9876543214', 'david.brown@email.com', '654 Elm Avenue, Bareilly');

-- =============================================
-- 9. ANALYTICS VIEWS
-- =============================================

-- Create view for product analytics
CREATE OR REPLACE VIEW product_analytics AS
SELECT 
    p.id,
    p.name,
    p.category_id,
    c.name as category_name,
    p.stock_quantity,
    p.min_stock_level,
    p.purchase_price,
    p.selling_price,
    (p.selling_price - p.purchase_price) as profit_per_unit,
    COALESCE(s.total_sold, 0) as total_sold,
    COALESCE(s.total_revenue, 0) as total_revenue,
    COALESCE(s.total_profit, 0) as total_profit,
    CASE 
        WHEN p.stock_quantity <= p.min_stock_level THEN 'LOW'
        WHEN p.stock_quantity <= p.min_stock_level * 2 THEN 'MEDIUM'
        ELSE 'HIGH'
    END as stock_status
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
LEFT JOIN (
    SELECT 
        product_id,
        SUM(quantity) as total_sold,
        SUM(total_amount) as total_revenue,
        SUM(profit) as total_profit
    FROM sales
    GROUP BY product_id
) s ON p.id = s.product_id;

-- Create view for daily sales summary
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT 
    sale_date,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_items_sold,
    SUM(total_amount) as total_revenue,
    SUM(profit) as total_profit,
    AVG(total_amount) as average_transaction
FROM sales
GROUP BY sale_date
ORDER BY sale_date DESC;

-- Create view for category performance
CREATE OR REPLACE VIEW category_performance AS
SELECT 
    c.id,
    c.name as category_name,
    COUNT(p.id) as total_products,
    SUM(p.stock_quantity) as total_stock,
    COALESCE(s.total_sold, 0) as total_sold,
    COALESCE(s.total_revenue, 0) as total_revenue,
    COALESCE(s.total_profit, 0) as total_profit
FROM categories c
LEFT JOIN products p ON c.id = p.category_id
LEFT JOIN (
    SELECT 
        p.category_id,
        SUM(s.quantity) as total_sold,
        SUM(s.total_amount) as total_revenue,
        SUM(s.profit) as total_profit
    FROM sales s
    JOIN products p ON s.product_id = p.id
    GROUP BY p.category_id
) s ON c.id = s.category_id
GROUP BY c.id, c.name, s.total_sold, s.total_revenue, s.total_profit
ORDER BY total_revenue DESC;

-- =============================================
-- SETUP COMPLETION MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SIMPLIFIED Inventory Management Setup';
    RAISE NOTICE 'Database setup completed successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '✓ No user authentication required';
    RAISE NOTICE '✓ Automatic stock management';
    RAISE NOTICE '✓ Sample data inserted';
    RAISE NOTICE '✓ Analytics views created';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Sample data inserted:';
    RAISE NOTICE '- Categories: %', (SELECT COUNT(*) FROM categories);
    RAISE NOTICE '- Products: %', (SELECT COUNT(*) FROM products);
    RAISE NOTICE '- Customers: %', (SELECT COUNT(*) FROM customers);
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Update your code to remove authentication';
    RAISE NOTICE '2. Run: npm run dev';
    RAISE NOTICE '3. Start managing your inventory!';
    RAISE NOTICE '========================================';
END $$;