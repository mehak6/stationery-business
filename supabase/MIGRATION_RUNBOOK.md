# Supabase Migration Runbook

Use this flow for every database change.

1. Create a full backup from the Dashboard export tools.
2. Add a versioned SQL file in `supabase/migrations`.
3. Add a matching verification file in `supabase/verification`.
4. Add rollback notes or rollback SQL in `supabase/rollback`.
5. Run the migration in Supabase SQL Editor or Supabase CLI.
6. Run the verification SQL and confirm every `passed` value is `true`.
7. Deploy app code only after verification passes.
8. If a migration is partially applied, stop and repair with a new migration instead of editing history.

For stock-related changes, verify:

- sale create, edit, and delete adjust product stock correctly
- manual add/reduce/damaged/correction writes `inventory_transactions`
- party transfer reduces `party_purchases.remaining_quantity`
- Dashboard backup includes products, sales, party purchases, and inventory ledger
