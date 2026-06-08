-- Verification for party purchase batch profit/loss migration.

SELECT 'product_stock_batches table exists' AS check_name,
       EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'product_stock_batches'
       ) AS passed;

SELECT 'sale_batch_allocations table exists' AS check_name,
       EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'sale_batch_allocations'
       ) AS passed;

SELECT 'party_purchase_movements table exists' AS check_name,
       EXISTS (
         SELECT 1
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name = 'party_purchase_movements'
       ) AS passed;

SELECT 'batch tables have RLS enabled' AS check_name,
       bool_and(relrowsecurity) AS passed
FROM pg_class
WHERE oid IN (
  'public.product_stock_batches'::regclass,
  'public.sale_batch_allocations'::regclass,
  'public.party_purchase_movements'::regclass
);

SELECT 'batch RPC/functions installed' AS check_name,
       COUNT(*) = 5 AS passed
FROM pg_proc
WHERE proname IN (
  'record_party_transfer_batch',
  'allocate_sale_to_stock_batches',
  'restore_sale_batch_allocations',
  'adjust_product_stock',
  'record_party_purchase_deduction'
);

SELECT 'sale trigger functions still installed' AS check_name,
       COUNT(*) = 3 AS passed
FROM pg_proc
WHERE proname IN (
  'apply_stock_for_sale_insert',
  'apply_stock_for_sale_update',
  'apply_stock_for_sale_delete'
);

SELECT 'sales stock triggers active' AS check_name,
       COUNT(*) = 3 AS passed
FROM pg_trigger
WHERE tgname IN (
  'trigger_apply_stock_for_sale_insert',
  'trigger_apply_stock_for_sale_update',
  'trigger_apply_stock_for_sale_delete'
)
AND NOT tgisinternal;
