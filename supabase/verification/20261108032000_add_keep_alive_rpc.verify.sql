select
  to_regprocedure('public.keep_alive()') is not null as function_installed,
  has_function_privilege('anon', 'public.keep_alive()', 'EXECUTE') as anon_can_execute,
  has_function_privilege('authenticated', 'public.keep_alive()', 'EXECUTE') as authenticated_can_execute;

