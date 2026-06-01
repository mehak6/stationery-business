-- Verification for 20260601164500_atomic_sales_inventory_ledger.sql
-- Run after the migration. It returns one row per check.

SELECT 'sales.updated_at column exists' AS check_name,
       EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'sales'
           AND column_name = 'updated_at'
       ) AS passed;

SELECT 'inventory_transactions table exists' AS check_name,
       EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'inventory_transactions'
       ) AS passed;

SELECT 'inventory transaction RLS enabled' AS check_name,
       COALESCE((
         SELECT relrowsecurity
         FROM pg_class
         WHERE oid = 'public.inventory_transactions'::regclass
       ), false) AS passed;

SELECT 'create sale RPC exists' AS check_name,
       EXISTS (
         SELECT 1
         FROM pg_proc
         WHERE proname = 'create_sale_with_stock_check'
       ) AS passed;

SELECT 'update sale RPC exists' AS check_name,
       EXISTS (
         SELECT 1
         FROM pg_proc
         WHERE proname = 'update_sale_with_stock_check'
       ) AS passed;

SELECT 'delete sale RPC exists' AS check_name,
       EXISTS (
         SELECT 1
         FROM pg_proc
         WHERE proname = 'delete_sale_with_stock_check'
       ) AS passed;

SELECT 'sale stock triggers installed' AS check_name,
       COUNT(*) = 3 AS passed
FROM pg_trigger
WHERE tgrelid = 'public.sales'::regclass
  AND NOT tgisinternal
  AND tgname IN (
    'trigger_apply_stock_for_sale_insert',
    'trigger_apply_stock_for_sale_update',
    'trigger_apply_stock_for_sale_delete'
  );
