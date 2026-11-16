-- F03-004 PHASE 2 (CONTRACT) — NOT AN AUTOMATIC MIGRATION.
-- Requires new explicit Founder approval, deployed clients using verified server
-- save exclusively, fallback UI/runtime removed, traffic monitoring, and an
-- approved rollback window. DO NOT run at initial F03-004 release.
begin;
revoke execute on function public.create_wish_with_deed(uuid,text,jsonb,jsonb)
  from public, anon, authenticated;
do $$
begin
  if has_function_privilege('authenticated',
    'public.create_wish_with_deed(uuid,text,jsonb,jsonb)','EXECUTE') then
    raise exception 'Legacy first-save RPC still callable; abort retiring';
  end if;
  if not has_function_privilege('service_role',
    'public.create_verified_first_value(uuid,uuid,text,jsonb,jsonb)','EXECUTE') then
    raise exception 'Verified first-save route missing; abort retiring';
  end if;
end $$;
commit;
