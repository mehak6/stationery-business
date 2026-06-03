# Supabase Migration Checklist

Use this checklist before deploying application code that depends on database changes.

1. Create a full export backup from Dashboard for products, sales, party purchases, categories, customers, and inventory ledger.
2. Run the migration in `supabase/migrations` in Supabase SQL Editor or with Supabase CLI.
3. Run the matching SQL in `supabase/verification`.
4. Confirm every verification row returns `passed = true`.
5. Test a temporary sale create, edit, and delete against production data, then clean it up.
6. Test manual stock add/reduce/damaged/correction and confirm each writes `inventory_transactions`.
7. Test party transfer and confirm product stock increases while party remaining quantity decreases.
8. Deploy the app only after the migration and verification pass.
9. Keep the rollback SQL available, but run it only after a fresh backup.
