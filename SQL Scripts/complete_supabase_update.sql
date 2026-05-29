-- =============================================
-- COMPLETE SUPABASE DATABASE UPDATE SCRIPT
-- Stationery & Games Inventory Management System
-- Generated from Deep Codebase Analysis
-- =============================================
--
-- This script contains EVERYTHING needed for your Supabase database
-- Run this in your Supabase SQL Editor to ensure complete setup
--
-- Features:
-- ✓ All tables (categories, products, customers, sales, party_purchases)
-- ✓ All indexes for performance
-- ✓ All triggers for automation
-- ✓ Stock management system
-- ✓ Analytics views
-- ✓ RLS disabled for single-user access
-- ✓ Sample data for testing
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
-- 5. PARTY PURCHASES TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS party_purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    party_name TEXT NOT NULL,
    item_name TEXT NOT NULL,
    barcode TEXT,
    purchase_price DECIMAL(10,2) NOT NULL CHECK (purchase_price >= 0),
    selling_price DECIMAL(10,2) NOT NULL CHECK (selling_price >= 0),
    purchased_quantity INTEGER NOT NULL CHECK (purchased_quantity > 0),
    remaining_quantity INTEGER NOT NULL CHECK (remaining_quantity >= 0),
    purchase_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- =============================================
-- 6. DISABLE RLS (Row Level Security)
-- Since we're using single-user setup without authentication
-- =============================================
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;
ALTER TABLE party_purchases DISABLE ROW LEVEL SECURITY;

-- Drop any existing policies (cleanup)
DROP POLICY IF EXISTS "Allow all operations for all users" ON party_purchases;
DROP POLICY IF EXISTS "Anyone can view categories" ON categories;
DROP POLICY IF EXISTS "Anyone can view products" ON products;
DROP POLICY IF EXISTS "Authenticated users can view sales" ON sales;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON customers;

-- =============================================
-- 7. INDEXES FOR PERFORMANCE
-- =============================================

-- Products indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_stock ON products(stock_quantity);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at);
CREATE INDEX IF NOT EXISTS idx_products_low_stock ON products(stock_quantity, min_stock_level) WHERE stock_quantity <= min_stock_level;

-- Sales indexes
CREATE INDEX IF NOT EXISTS idx_sales_product_id ON sales(product_id);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_sales_date_desc ON sales(sale_date DESC);

-- Categories indexes
CREATE INDEX IF NOT EXISTS idx_categories_name ON categories(name);

-- Party purchases indexes
CREATE INDEX IF NOT EXISTS idx_party_purchases_party_name ON party_purchases(party_name);
CREATE INDEX IF NOT EXISTS idx_party_purchases_item_name ON party_purchases(item_name);
CREATE INDEX IF NOT EXISTS idx_party_purchases_barcode ON party_purchases(barcode);
CREATE INDEX IF NOT EXISTS idx_party_purchases_purchase_date ON party_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_party_purchases_remaining ON party_purchases(remaining_quantity) WHERE remaining_quantity > 0;

-- =============================================
-- 8. FUNCTIONS
-- =============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
        RAISE EXCEPTION 'Insufficient stock for product ID: %. Available stock: %',
            NEW.product_id,
            (SELECT stock_quantity + NEW.quantity FROM products WHERE id = NEW.product_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- =============================================
-- 9. TRIGGERS
-- =============================================

-- Trigger for products table (updated_at)
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for sales table (updated_at)
DROP TRIGGER IF EXISTS update_sales_updated_at ON sales;
CREATE TRIGGER update_sales_updated_at
    BEFORE UPDATE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for party_purchases table (updated_at)
DROP TRIGGER IF EXISTS update_party_purchases_updated_at ON party_purchases;
CREATE TRIGGER update_party_purchases_updated_at
    BEFORE UPDATE ON party_purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to update stock after sale
DROP TRIGGER IF EXISTS trigger_update_stock_after_sale ON sales;
CREATE TRIGGER trigger_update_stock_after_sale
    AFTER INSERT ON sales
    FOR EACH ROW
    EXECUTE FUNCTION update_product_stock_after_sale();

-- Trigger to restore stock after sale deletion
DROP TRIGGER IF EXISTS trigger_restore_stock_after_sale_delete ON sales;
CREATE TRIGGER trigger_restore_stock_after_sale_delete
    AFTER DELETE ON sales
    FOR EACH ROW
    EXECUTE FUNCTION restore_product_stock_after_sale_delete();

-- =============================================
-- 10. ANALYTICS VIEWS
-- =============================================

-- Product Analytics View
CREATE OR REPLACE VIEW product_analytics AS
SELECT
    p.id,
    p.name,
    p.category_id,
    c.name as category_name,
    p.barcode,
    p.stock_quantity,
    p.min_stock_level,
    p.purchase_price,
    p.selling_price,
    (p.selling_price - p.purchase_price) as profit_per_unit,
    ROUND(((p.selling_price - p.purchase_price) / NULLIF(p.purchase_price, 0)) * 100, 2) as profit_margin_percent,
    COALESCE(s.total_sold, 0) as total_sold,
    COALESCE(s.total_revenue, 0) as total_revenue,
    COALESCE(s.total_profit, 0) as total_profit,
    CASE
        WHEN p.stock_quantity <= 0 THEN 'OUT_OF_STOCK'
        WHEN p.stock_quantity <= p.min_stock_level THEN 'LOW'
        WHEN p.stock_quantity <= p.min_stock_level * 2 THEN 'MEDIUM'
        ELSE 'HIGH'
    END as stock_status,
    p.created_at,
    p.updated_at
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

-- Daily Sales Summary View
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT
    sale_date,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_items_sold,
    SUM(total_amount) as total_revenue,
    SUM(profit) as total_profit,
    AVG(total_amount) as average_transaction,
    MIN(total_amount) as min_transaction,
    MAX(total_amount) as max_transaction
FROM sales
GROUP BY sale_date
ORDER BY sale_date DESC;

-- Category Performance View
CREATE OR REPLACE VIEW category_performance AS
SELECT
    c.id,
    c.name as category_name,
    c.description,
    COUNT(DISTINCT p.id) as total_products,
    SUM(p.stock_quantity) as total_stock,
    SUM(p.stock_quantity * p.purchase_price) as inventory_value,
    COALESCE(s.total_sold, 0) as total_sold,
    COALESCE(s.total_revenue, 0) as total_revenue,
    COALESCE(s.total_profit, 0) as total_profit,
    COALESCE(s.avg_profit_margin, 0) as avg_profit_margin,
    c.created_at
FROM categories c
LEFT JOIN products p ON c.id = p.category_id
LEFT JOIN (
    SELECT
        p.category_id,
        SUM(s.quantity) as total_sold,
        SUM(s.total_amount) as total_revenue,
        SUM(s.profit) as total_profit,
        AVG((s.unit_price - p.purchase_price) / NULLIF(p.purchase_price, 0) * 100) as avg_profit_margin
    FROM sales s
    JOIN products p ON s.product_id = p.id
    GROUP BY p.category_id
) s ON c.id = s.category_id
GROUP BY c.id, c.name, c.description, c.created_at, s.total_sold, s.total_revenue, s.total_profit, s.avg_profit_margin
ORDER BY total_revenue DESC NULLS LAST;

-- Low Stock Products View
CREATE OR REPLACE VIEW low_stock_products AS
SELECT
    p.id,
    p.name,
    c.name as category_name,
    p.barcode,
    p.stock_quantity,
    p.min_stock_level,
    p.purchase_price,
    p.selling_price,
    (p.min_stock_level - p.stock_quantity) as stock_deficit,
    p.updated_at as last_updated
FROM products p
LEFT JOIN categories c ON p.category_id = c.id
WHERE p.stock_quantity <= p.min_stock_level
ORDER BY (p.min_stock_level - p.stock_quantity) DESC, p.stock_quantity ASC;

-- Monthly Sales Trends View
CREATE OR REPLACE VIEW monthly_sales_trends AS
SELECT
    DATE_TRUNC('month', sale_date) as month,
    COUNT(*) as transaction_count,
    SUM(quantity) as total_items_sold,
    SUM(total_amount) as total_revenue,
    SUM(profit) as total_profit,
    AVG(total_amount) as avg_transaction_value,
    COUNT(DISTINCT product_id) as unique_products_sold
FROM sales
GROUP BY DATE_TRUNC('month', sale_date)
ORDER BY month DESC;

-- Party Purchases Summary View
CREATE OR REPLACE VIEW party_purchases_summary AS
SELECT
    party_name,
    COUNT(*) as total_purchases,
    SUM(purchased_quantity) as total_items_purchased,
    SUM(remaining_quantity) as total_items_remaining,
    SUM(purchased_quantity - remaining_quantity) as total_items_transferred,
    SUM(purchase_price * purchased_quantity) as total_purchase_value,
    SUM(selling_price * remaining_quantity) as remaining_inventory_value,
    MIN(purchase_date) as first_purchase_date,
    MAX(purchase_date) as last_purchase_date
FROM party_purchases
GROUP BY party_name
ORDER BY total_purchase_value DESC;

-- =============================================
-- 11. SAMPLE DATA (Optional - Comment out if not needed)
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
('David Brown', '+91-9876543214', 'david.brown@email.com', '654 Elm Avenue, Bareilly')
ON CONFLICT DO NOTHING;

-- =============================================
-- 12. HELPER FUNCTIONS (Utility queries)
-- =============================================

-- Function to get dashboard analytics
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS TABLE(
    total_products BIGINT,
    total_sales NUMERIC,
    today_sales NUMERIC,
    low_stock_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales) as total_sales,
        (SELECT COALESCE(SUM(total_amount), 0) FROM sales WHERE sale_date = CURRENT_DATE) as today_sales,
        (SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock_level) as low_stock_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check product availability before sale
CREATE OR REPLACE FUNCTION check_product_availability(
    p_product_id UUID,
    p_quantity INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
    v_stock INTEGER;
BEGIN
    SELECT stock_quantity INTO v_stock
    FROM products
    WHERE id = p_product_id;

    IF v_stock IS NULL THEN
        RAISE EXCEPTION 'Product not found';
    END IF;

    RETURN v_stock >= p_quantity;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 13. COMPLETION SUMMARY
-- =============================================
DO $$
DECLARE
    v_categories_count INTEGER;
    v_products_count INTEGER;
    v_customers_count INTEGER;
    v_sales_count INTEGER;
    v_party_purchases_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_categories_count FROM categories;
    SELECT COUNT(*) INTO v_products_count FROM products;
    SELECT COUNT(*) INTO v_customers_count FROM customers;
    SELECT COUNT(*) INTO v_sales_count FROM sales;
    SELECT COUNT(*) INTO v_party_purchases_count FROM party_purchases;

    RAISE NOTICE '========================================';
    RAISE NOTICE 'SUPABASE DATABASE UPDATE COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Tables Created/Updated:';
    RAISE NOTICE '  ✓ categories';
    RAISE NOTICE '  ✓ products';
    RAISE NOTICE '  ✓ customers';
    RAISE NOTICE '  ✓ sales';
    RAISE NOTICE '  ✓ party_purchases';
    RAISE NOTICE '';
    RAISE NOTICE 'Features Enabled:';
    RAISE NOTICE '  ✓ Automatic stock management';
    RAISE NOTICE '  ✓ Stock restoration on sale delete';
    RAISE NOTICE '  ✓ Timestamp auto-updates';
    RAISE NOTICE '  ✓ Performance indexes';
    RAISE NOTICE '  ✓ Analytics views (6 views)';
    RAISE NOTICE '  ✓ RLS disabled (single-user mode)';
    RAISE NOTICE '';
    RAISE NOTICE 'Current Database State:';
    RAISE NOTICE '  • Categories: %', v_categories_count;
    RAISE NOTICE '  • Products: %', v_products_count;
    RAISE NOTICE '  • Customers: %', v_customers_count;
    RAISE NOTICE '  • Sales: %', v_sales_count;
    RAISE NOTICE '  • Party Purchases: %', v_party_purchases_count;
    RAISE NOTICE '';
    RAISE NOTICE 'Analytics Views Available:';
    RAISE NOTICE '  • product_analytics';
    RAISE NOTICE '  • daily_sales_summary';
    RAISE NOTICE '  • category_performance';
    RAISE NOTICE '  • low_stock_products';
    RAISE NOTICE '  • monthly_sales_trends';
    RAISE NOTICE '  • party_purchases_summary';
    RAISE NOTICE '';
    RAISE NOTICE 'Helper Functions Available:';
    RAISE NOTICE '  • get_dashboard_stats()';
    RAISE NOTICE '  • check_product_availability(product_id, quantity)';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '  1. Verify in Supabase Dashboard > Table Editor';
    RAISE NOTICE '  2. Test with: SELECT * FROM get_dashboard_stats();';
    RAISE NOTICE '  3. View analytics: SELECT * FROM product_analytics;';
    RAISE NOTICE '  4. Run your app: npm run dev';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
END $$;
