-- Verification for 20260602103000_add_damaged_stock_ledger_action.sql

SELECT 'damaged stock ledger action allowed' AS check_name,
       pg_get_constraintdef(oid) LIKE '%damaged_stock_removed%' AS passed
FROM pg_constraint
WHERE conrelid = 'public.inventory_transactions'::regclass
  AND conname = 'inventory_transactions_action_check';
