-- Fix Quick Sale failures after batch allocation migration.
--
-- sale_batch_allocations rows are created from the sales BEFORE INSERT trigger.
-- The sale id is assigned in that trigger, but the sales row is not visible to
-- the foreign key until the statement completes. Deferring the FK keeps the
-- relationship enforced without blocking the trigger.

BEGIN;

ALTER TABLE public.sale_batch_allocations
  DROP CONSTRAINT IF EXISTS sale_batch_allocations_sale_id_fkey;

ALTER TABLE public.sale_batch_allocations
  ADD CONSTRAINT sale_batch_allocations_sale_id_fkey
  FOREIGN KEY (sale_id)
  REFERENCES public.sales(id)
  ON DELETE CASCADE
  DEFERRABLE INITIALLY DEFERRED;

COMMIT;
