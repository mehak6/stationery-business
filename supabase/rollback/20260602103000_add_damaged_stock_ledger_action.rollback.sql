-- Rollback for 20260602103000_add_damaged_stock_ledger_action.sql
-- Run only after backing up data. Existing damaged_stock_removed rows must be
-- converted or deleted before this rollback can succeed.

BEGIN;

ALTER TABLE public.inventory_transactions
  DROP CONSTRAINT IF EXISTS inventory_transactions_action_check;

ALTER TABLE public.inventory_transactions
  ADD CONSTRAINT inventory_transactions_action_check
  CHECK (
    action IN (
      'sale_created',
      'sale_quantity_increased',
      'sale_quantity_decreased',
      'sale_product_changed_restore',
      'sale_product_changed_deduct',
      'sale_deleted_restore',
      'manual_stock_added',
      'manual_stock_reduced',
      'party_transfer',
      'year_reset',
      'stock_repair'
    )
  );

COMMIT;
