-- Rollback for 20260603110000_adjust_product_stock_rpc.sql
-- Run only after taking a fresh backup and confirming no deployed app version depends on this RPC.

BEGIN;

DROP FUNCTION IF EXISTS public.adjust_product_stock(
  UUID, TEXT, INTEGER, INTEGER, TEXT, DATE, UUID
);

COMMIT;
