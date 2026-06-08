-- Rollback for deferred sale batch allocation foreign key.
-- Warning: rolling this back can make Quick Sale fail while allocations are
-- created from the sales BEFORE INSERT trigger.

BEGIN;

ALTER TABLE public.sale_batch_allocations
  DROP CONSTRAINT IF EXISTS sale_batch_allocations_sale_id_fkey;

ALTER TABLE public.sale_batch_allocations
  ADD CONSTRAINT sale_batch_allocations_sale_id_fkey
  FOREIGN KEY (sale_id)
  REFERENCES public.sales(id)
  ON DELETE CASCADE;

COMMIT;
