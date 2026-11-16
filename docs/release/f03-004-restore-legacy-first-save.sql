-- F03-004 controlled rollback ONLY: restoration of legacy client permission.
-- Must be explicitly authorized; reopens old client-receipt risk.
-- This SQL is not an automatic Supabase migration.
begin;
grant execute on function public.create_wish_with_deed(uuid,text,jsonb,jsonb)
  to authenticated;
do $$
begin
  if not has_function_privilege('authenticated',
    'public.create_wish_with_deed(uuid,text,jsonb,jsonb)','EXECUTE') then
    raise exception 'Legacy first-save RPC was not restored';
  end if;
end $$;
commit;
