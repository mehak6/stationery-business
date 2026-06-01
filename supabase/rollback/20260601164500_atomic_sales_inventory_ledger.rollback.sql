-- Rollback notes for 20260601164500_atomic_sales_inventory_ledger.sql
--
-- Use only after taking a fresh backup. This rollback removes the new RPCs,
-- ledger trigger functions, triggers, and ledger table. It does not remove
-- sales.updated_at because application code now depends on it.

BEGIN;

DROP FUNCTION IF EXISTS public.delete_sale_with_stock_check(UUID);
DROP FUNCTION IF EXISTS public.update_sale_with_stock_check(
  UUID, UUID, INTEGER, DECIMAL, DECIMAL, DECIMAL, JSONB, DATE, TEXT
);
DROP FUNCTION IF EXISTS public.create_sale_with_stock_check(
  UUID, INTEGER, DECIMAL, DECIMAL, DECIMAL, DATE, TEXT, JSONB
);

DROP TRIGGER IF EXISTS trigger_apply_stock_for_sale_insert ON public.sales;
DROP TRIGGER IF EXISTS trigger_apply_stock_for_sale_update ON public.sales;
DROP TRIGGER IF EXISTS trigger_apply_stock_for_sale_delete ON public.sales;

DROP FUNCTION IF EXISTS public.apply_stock_for_sale_insert();
DROP FUNCTION IF EXISTS public.apply_stock_for_sale_update();
DROP FUNCTION IF EXISTS public.apply_stock_for_sale_delete();
DROP FUNCTION IF EXISTS public.write_inventory_ledger(
  UUID, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT, JSONB
);

DROP TABLE IF EXISTS public.inventory_transactions;

COMMIT;
