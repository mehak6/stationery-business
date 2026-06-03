-- Verification for 20260603110000_adjust_product_stock_rpc.sql

WITH checks AS (
  SELECT 'adjust_product_stock rpc exists' AS check_name,
         EXISTS (
         SELECT 1
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'adjust_product_stock'
           AND pg_get_function_identity_arguments(p.oid) = 'p_product_id uuid, p_mode text, p_quantity integer, p_target_stock integer, p_reason text, p_adjustment_date date, p_party_purchase_id uuid'
         ) AS passed
  UNION ALL
  SELECT 'authenticated can execute adjust_product_stock' AS check_name,
         has_function_privilege(
           'authenticated',
           'public.adjust_product_stock(uuid,text,integer,integer,text,date,uuid)',
           'EXECUTE'
         ) AS passed
  UNION ALL
  SELECT 'ledger actions needed for adjustments are allowed' AS check_name,
         pg_get_constraintdef(oid) LIKE '%manual_stock_added%'
         AND pg_get_constraintdef(oid) LIKE '%manual_stock_reduced%'
         AND pg_get_constraintdef(oid) LIKE '%damaged_stock_removed%'
         AND pg_get_constraintdef(oid) LIKE '%party_transfer%'
         AND pg_get_constraintdef(oid) LIKE '%stock_repair%' AS passed
  FROM pg_constraint
  WHERE conrelid = 'public.inventory_transactions'::regclass
    AND conname = 'inventory_transactions_action_check'
)
SELECT * FROM checks;
