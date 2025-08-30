-- =============================================
-- FIXED: Complete Database Cleanup
-- Handles dependencies properly
-- =============================================

-- Drop all views first
DROP VIEW IF EXISTS product_analytics CASCADE;
DROP VIEW IF EXISTS daily_sales_summary CASCADE;
DROP VIEW IF EXISTS category_performance CASCADE;

-- Drop all triggers (before functions)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS trigger_update_stock_after_sale ON sales;
DROP TRIGGER IF EXISTS trigger_restore_stock_after_sale_delete ON sales;

-- Drop all tables in correct order (CASCADE handles dependencies)
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Drop all functions after tables
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS update_product_stock_after_sale() CASCADE;
DROP FUNCTION IF EXISTS restore_product_stock_after_sale_delete() CASCADE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Database cleanup completed successfully!';
    RAISE NOTICE 'All dependencies handled with CASCADE.';
    RAISE NOTICE '========================================';
END $$;