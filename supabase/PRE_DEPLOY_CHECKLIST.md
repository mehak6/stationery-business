# Supabase Migration Checklist

Use this checklist before deploying application code that depends on database changes.

1. Create a full export backup for products, sales, party purchases, categories, and customers.
2. Run the migration in `supabase/migrations` in Supabase SQL Editor or with Supabase CLI.
3. Run the matching SQL in `supabase/verification`.
4. Confirm every verification row returns `passed = true`.
5. Test a temporary sale create, edit, and delete against production data, then clean it up.
6. Deploy the app only after the migration and verification pass.
7. Keep the rollback SQL available, but run it only after a fresh backup.
