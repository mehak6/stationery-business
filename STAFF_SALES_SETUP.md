# Shared inventory and restricted voice sales

The `/sales` counter uses the same Supabase products, sales, inventory ledger and stock-batch triggers as the existing admin app. It does not import a second catalogue or store another stock balance.

## Access

- `mehakaggarwal70@gmail.com` is bootstrapped as the administrator only after the Supabase account email is verified.
- Other verified accounts start pending. The admin approves or disables them in **Manage salesperson access**.
- Staff receive only product IDs, names, selling prices and spoken aliases. No purchase prices, stock balances, supplier details, customer details, profit, backup data or inventory reports are returned by the staff API.
- Staff can create sales, see today's total shop sales, and correct their own counter entries from the current India calendar day. Admins retain the inventory app and may correct any counter entry from today.
- SQL policies and RPC guards enforce permissions even if someone changes the browser UI or calls the APIs directly. Roles in user-editable metadata are ignored.
- The existing admin app has local offline storage. Use a separate browser profile/device for administration; a salesperson should not be given a browser profile containing an administrator's existing offline database. The sales counter does not load or cache the admin database. Server rules cannot erase data previously downloaded by an admin.

## Deployment order

1. Confirm the June 2026 stock ledger/batch migrations have been applied, including `20260608184500_defer_sale_batch_allocation_fk.sql`.
2. Apply `supabase/migrations/20261107180000_staff_voice_sales.sql` once. Existing products and sales are preserved. The migration restricts legacy direct table access to the admin, makes existing views obey RLS, and closes privileged helper RPCs.
3. Deploy the GitHub application using the existing `NEXT_PUBLIC_SUPABASE_URL` and public anonymous key. There is no service-role key in the browser.
4. Sign in as the admin. Staff create and verify their accounts, then the admin approves them. Never enable unknown pending users.
5. Add Hindi/Hinglish aliases in **Manage salesperson access → Hindi product names**. Test microphone input on the actual counter device; ambiguous phrases require manual selection.

Email/password is available immediately. Optional mobile OTP needs Supabase Phone Auth and an SMS provider configured, then `NEXT_PUBLIC_PHONE_LOGIN_ENABLED=true` at build time. This flag alone cannot configure or pay for SMS delivery.

## Checks

- `npm test -- --runInBand`: draft parsing, role UI gates and existing inventory regression tests.
- `node scripts/verify-staff-access.mjs`: isolated PostgreSQL tests using PGlite; tests the actual migrations, admin/staff/pending/anonymous permissions, existing permissive policy overrides, duplicate requests, atomic corrections, stock restoration and rollback.
- `npm run build`: production static export for the existing Vercel deployment.

Receipt corrections are auditable in `app_private.receipt_audit`. A correction deletes/recreates its underlying sales rows within one database transaction, allowing existing stock/batch triggers to restore/reallocate stock. Receipt IDs remain stable; existing sales row IDs change. Failed corrections roll back completely. Network retries reuse an idempotency key. The staff screen deliberately requires an internet connection to save.
