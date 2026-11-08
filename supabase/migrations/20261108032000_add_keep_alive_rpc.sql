-- Provides a no-data database request for the external keep-alive workflow.
create or replace function public.keep_alive()
returns timestamptz
language sql
stable
security invoker
set search_path = pg_catalog
as $$
  select now();
$$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;

