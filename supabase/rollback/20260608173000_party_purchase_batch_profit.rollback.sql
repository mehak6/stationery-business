-- Rollback for party purchase batch profit/loss migration.
--
-- Important:
-- This removes batch profit/loss history created by this migration.
-- After rollback, rerun 20260601164500_atomic_sales_inventory_ledger.sql and
-- 20260603110000_adjust_product_stock_rpc.sql to restore the pre-batch trigger
-- and stock adjustment function bodies.

BEGIN;

DROP FUNCTION IF EXISTS public.record_party_purchase_deduction(
  UUID, INTEGER, DATE, TEXT, TEXT, JSONB
);

DROP FUNCTION IF EXISTS public.record_party_transfer_batch(
  UUID, UUID, INTEGER, NUMERIC, NUMERIC, DATE, TEXT, JSONB
);

DROP FUNCTION IF EXISTS public.restore_sale_batch_allocations(UUID);
DROP FUNCTION IF EXISTS public.allocate_sale_to_stock_batches(UUID, UUID, INTEGER, NUMERIC);

DROP TABLE IF EXISTS public.party_purchase_movements;
DROP TABLE IF EXISTS public.sale_batch_allocations;
DROP TABLE IF EXISTS public.product_stock_batches;

COMMIT;
