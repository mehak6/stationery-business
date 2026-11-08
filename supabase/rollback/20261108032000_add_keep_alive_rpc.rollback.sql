-- Removes only the keep-alive RPC introduced by the matching migration.
drop function if exists public.keep_alive();

