-- Prototype quota: three saved wish cards per account.
-- Keeps preexisting rows, including any account with >3; rejects new rows.
-- Owner RLS continues to control SELECT/INSERT/DELETE access.
-- The advisory transaction lock serializes concurrent saves from the same user.
create schema if not exists private;

create or replace function private.enforce_three_saved_wishes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_count integer;
begin
  -- The RLS INSERT policy independently requires new.user_id = auth.uid().
  -- Block a stale client inserting a fourth wish, even through the REST API.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 30927)
  );
  select count(*) into existing_count
    from public.wishes
    where user_id = new.user_id;
  if existing_count >= 3 then
    raise exception 'WISH_LIMIT_REACHED'
      using errcode = 'P0001',
            detail = 'A user may save up to three wishes. Delete a saved wish to create another.';
  end if;
  return new;
end
$$;

revoke all on function private.enforce_three_saved_wishes() from public;

drop trigger if exists enforce_three_saved_wishes on public.wishes;
create trigger enforce_three_saved_wishes
before insert on public.wishes
for each row execute function private.enforce_three_saved_wishes();
