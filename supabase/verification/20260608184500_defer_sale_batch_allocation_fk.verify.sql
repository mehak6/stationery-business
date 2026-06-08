-- Verification for deferred sale batch allocation foreign key.

SELECT 'sale_batch_allocations sale_id FK is deferred' AS check_name,
       condeferrable = true AND condeferred = true AS passed
FROM pg_constraint
WHERE conrelid = 'public.sale_batch_allocations'::regclass
  AND conname = 'sale_batch_allocations_sale_id_fkey';
