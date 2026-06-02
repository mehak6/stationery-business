-- Allow damaged stock adjustments to be recorded separately from sales.

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
      'damaged_stock_removed',
      'party_transfer',
      'year_reset',
      'stock_repair'
    )
  );

COMMIT;
