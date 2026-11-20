#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="wisht-f03-test-$$"
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=localtest "${WISHT_TEST_PG_IMAGE:-postgres:17-alpine}" >/dev/null
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
for attempt in {1..30}; do docker exec "$container" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1 && break; sleep 1; done
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users(id uuid primary key, email_confirmed_at timestamptz default now(), is_anonymous boolean default false);
grant usage on schema auth to service_role;
grant select on auth.users to service_role;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
grant execute on function auth.jwt() to authenticated;
insert into auth.users values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');

-- Simulate the populated hosted legacy schema before applying the additive F03 migration.
-- Its name, composite FKs, RLS policy, trigger, and sample data must survive unchanged.
create table public.wishes (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  aspiration text not null,
  kind text not null,
  mission_id text,
  answer jsonb not null default '{}'::jsonb,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
create table public.portfolios (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  wish_id uuid not null,
  unique (id, user_id),
  constraint legacy_portfolio_owner foreign key (wish_id, user_id)
    references public.wishes(id, user_id)
);
create table public.portfolio_publications (
  id uuid primary key,
  user_id uuid not null,
  portfolio_id uuid not null,
  slug text not null unique,
  constraint legacy_publication_owner foreign key (portfolio_id, user_id)
    references public.portfolios(id, user_id)
);
alter table public.wishes enable row level security;
create policy "legacy owner reads wishes" on public.wishes for select to authenticated
  using (auth.uid() = user_id);
create function public.legacy_wish_noop() returns trigger language plpgsql as $$
begin return new; end $$;
create trigger legacy_wish_trigger before insert or update on public.wishes
  for each row execute function public.legacy_wish_noop();
insert into public.wishes(id, user_id, aspiration, kind) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Build a photo portfolio','photography'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Find a new job','career'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','Join a team','soccer'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','Capture city photos','photography'),
 ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','Explore nearby clubs','soccer');
insert into public.portfolios(id, user_id, wish_id) values
 ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001'),
 ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000004');
insert into public.portfolio_publications(id, user_id, portfolio_id, slug) values
 ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','legacy-portfolio');
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261115224928_f03_additive_generic_wish_records.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261115234000_f03_003_jinn_management.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
-- The generic schema must coexist with real legacy table names and linked rows.
do $$ begin
 if (select count(*) from public.wishes) <> 5
   or (select count(*) from public.portfolios) <> 2
   or (select count(*) from public.portfolio_publications) <> 1
   or (select aspiration from public.wishes where id='10000000-0000-0000-0000-000000000001') <> 'Build a photo portfolio'
   or (select slug from public.portfolio_publications limit 1) <> 'legacy-portfolio'
   then raise exception 'F03 altered legacy rows or linked portfolio records'; end if;
 if not exists (select 1 from pg_policies
   where schemaname='public' and tablename='wishes' and policyname='legacy owner reads wishes')
   or not exists (select 1 from pg_trigger
   where tgname='legacy_wish_trigger' and tgrelid='public.wishes'::regclass and not tgisinternal)
   or not exists (select 1 from pg_constraint
   where conname='legacy_portfolio_owner' and conrelid='public.portfolios'::regclass)
   then raise exception 'F03 altered legacy RLS, trigger or owner FK'; end if;
 if to_regclass('public.wish_records') is null or to_regclass('public.jinns') is null
   or to_regclass('public.deeds') is null or to_regclass('public.artifacts') is null
   then raise exception 'F03 generic tables missing'; end if;
end $$;
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
insert into public.jinns(user_id,is_primary) values('00000000-0000-0000-0000-000000000001',true);
create temporary table fixture(artifact jsonb, receipt jsonb);
insert into fixture values(
'{"title":"Observation kit","sourceNote":"Leaves drooping","sections":[{"type":"document","title":"Care log","body":"Check soil"}],"unknowns":["Cause"],"nextDeed":{"title":"Observe","why":"Learn","prompt":"Record"},"boundary":"No diagnosis"}',
'{"status":"PREPARED","operation":"AI generated a draft","recordedAt":"2026-11-15T00:00:00Z","scope":"Private draft"}');
select public.create_wish_with_deed((select id from public.jinns limit 1),'Help my houseplant',(select artifact from fixture),(select receipt from fixture));
select public.create_wish_with_deed((select id from public.jinns limit 1),'Make a family story book',(select artifact from fixture),(select receipt from fixture));
select public.create_wish_with_deed((select id from public.jinns limit 1),'Start a garden',(select artifact from fixture),(select receipt from fixture));
select public.create_wish_with_deed((select id from public.jinns limit 1),'Learn to play chess',(select artifact from fixture),(select receipt from fixture));
do $$ begin if (select count(*) from public.wish_records) <> 4 or (select count(*) from public.deeds) <> 4 or (select count(*) from public.artifacts) <> 4 then raise exception 'save or no-limit check failed'; end if; end $$;
select public.correct_artifact((select id from public.artifacts where content->>'sourceNote'='Leaves drooping' limit 1),1,
  jsonb_set((select content from public.artifacts limit 1),'{sourceNote}','"Leaves firming"'::jsonb));
do $$ begin if (select count(*) from public.artifacts where version=2 and content->>'sourceNote'='Leaves firming') <> 1 then raise exception 'correction failed'; end if; end $$;
SQL
# Fresh connection simulates return and verifies owner isolation before follow-up.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ declare changed integer; begin
 if (select count(*) from public.wish_records) <> 0 or (select count(*) from public.deeds) <> 0 or (select count(*) from public.artifacts) <> 0 or (select count(*) from public.jinns) <> 0 then raise exception 'cross-owner read'; end if;
 update public.jinns set name='Intruder'; get diagnostics changed=row_count; if changed<>0 then raise exception 'cross-owner Jinn update'; end if;
 update public.wish_records set title='Intruder'; get diagnostics changed=row_count; if changed<>0 then raise exception 'cross-owner Wish update'; end if;
 update public.artifacts set version=version+1; get diagnostics changed=row_count; if changed<>0 then raise exception 'cross-owner Artifact update'; end if;
 delete from public.wish_records; get diagnostics changed=row_count; if changed<>0 then raise exception 'cross-owner Wish delete'; end if;
end $$;
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ begin if (select count(*) from public.wish_records) <> 4 or (select count(*) from public.artifacts where version=2) <> 1 then raise exception 'return failed'; end if; end $$;
select public.append_prepared_deed(a.wish_id,a.id,a.version,a.content,
  '{"status":"PREPARED","operation":"AI prepared follow-up","recordedAt":"2026-11-15T00:00:00Z","scope":"Private draft"}'::jsonb)
from public.artifacts a where a.version=2;
do $$ begin if (select count(*) from public.deeds) <> 5 or (select count(*) from public.artifacts where version=3) <> 1 then raise exception 'follow-up failed'; end if; end $$;
do $$ begin
 perform public.correct_artifact((select id from public.artifacts where version=3),1,(select content from public.artifacts where version=3));
 raise exception 'stale version was accepted';
 exception when others then if sqlerrm='stale version was accepted' then raise; end if;
end $$;
delete from public.wish_records where original_intent='Help my houseplant';
do $$ begin if (select count(*) from public.wish_records) <> 3 or (select count(*) from public.deeds) <> 3 or (select count(*) from public.artifacts) <> 3 then raise exception 'cascade deletion failed'; end if; end $$;
SQL
# Multi-Jinn acceptance: save 5+ under one Jinn, move without changing work,
# reject foreign-owner links, and delete only empty non-primary companions.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
insert into public.jinns(id,user_id,is_primary,name) values
 ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000002',true,'Other owner Jinn');
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
update public.jinns set name='Everyday Jinn',updated_at=now() where is_primary;
insert into public.jinns(user_id,name,settings) values
 ('00000000-0000-0000-0000-000000000001','Writing Jinn','{"purpose":"Descriptive only"}'::jsonb);
do $$ declare a jsonb; r jsonb; primary_id uuid; second_id uuid; other_id uuid; moved_wish uuid; before_content jsonb; before_deeds integer;
begin
 select id into primary_id from public.jinns where is_primary and user_id='00000000-0000-0000-0000-000000000001';
 select id into second_id from public.jinns where name='Writing Jinn' and user_id='00000000-0000-0000-0000-000000000001';
 -- A correct RLS policy makes the other owner's Jinn unqueryable.
 -- Use a known fixture UUID to exercise the composite owner FK directly.
 other_id := '40000000-0000-0000-0000-000000000002';
 a := '{"title":"Fresh kit","sourceNote":"Source remains local","sections":[{"type":"document","title":"Notes","body":"No shared memories"}],"unknowns":["Unconfirmed"],"nextDeed":{"title":"Continue","why":"A bounded step","prompt":"Write"},"boundary":"Draft"}'::jsonb;
 r := '{"status":"PREPARED","operation":"Prepared only","recordedAt":"2026-11-15T00:00:00Z","scope":"Private"}'::jsonb;
 perform public.create_wish_with_deed(primary_id,'Research a local language',a,r);
 perform public.create_wish_with_deed(primary_id,'Practice yoga',a,r);
 perform public.create_wish_with_deed(primary_id,'Plan garden visits',a,r);
 if (select count(*) from public.wish_records where primary_jinn_id=primary_id) < 5 then
   raise exception 'five-or-more Wishes per Jinn failed'; end if;
 moved_wish := public.create_wish_with_deed(second_id,'Write a short story',a,r);
 select content into before_content from public.artifacts where wish_id=moved_wish;
 select count(*) into before_deeds from public.deeds where wish_id=moved_wish;
 update public.wish_records set primary_jinn_id=primary_id,updated_at=now() where id=moved_wish;
 if (select count(*) from public.wish_records where id=moved_wish and primary_jinn_id=primary_id) <> 1
   or (select content from public.artifacts where wish_id=moved_wish) is distinct from before_content
   or (select count(*) from public.deeds where wish_id=moved_wish) <> before_deeds then
   raise exception 'reassignment changed stored work or did not persist'; end if;
 begin
   update public.wish_records set primary_jinn_id=other_id where id=moved_wish;
   raise exception 'foreign-owner reassignment unexpectedly succeeded';
 exception when foreign_key_violation then null;
 end;
 if (select primary_jinn_id from public.wish_records where id=moved_wish) <> primary_id then
   raise exception 'foreign-owner attempt changed Jinn'; end if;
 -- Only an empty nonprimary Jinn may be deleted; the primary Jinn must survive.
 delete from public.jinns where id=primary_id;
 if not exists (select 1 from public.jinns where id=primary_id) then raise exception 'primary Jinn was deletable'; end if;
 delete from public.jinns where id=second_id;
 if exists (select 1 from public.jinns where id=second_id) then raise exception 'empty Jinn deletion failed'; end if;
 -- FK still prevents deleting a nonprimary Jinn while it owns any Wish.
 insert into public.jinns(user_id,name) values
   ('00000000-0000-0000-0000-000000000001','Protected Jinn') returning id into second_id;
 perform public.create_wish_with_deed(second_id,'Inspect a book',a,r);
 delete from public.jinns where id=second_id;
 if not exists (select 1 from public.jinns where id=second_id) then raise exception 'nonempty Jinn was deleted'; end if;
end $$;
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ declare n integer; begin
 if (select count(*) from public.wish_records) <> 0 then raise exception 'second owner can list another owner Wishes'; end if;
 update public.jinns set name='Cross-owner change' where name='Everyday Jinn';
 get diagnostics n=row_count;
 if n <> 0 then raise exception 'second owner updated first owner Jinn'; end if;
 update public.wish_records set primary_jinn_id=(select id from public.jinns where name='Other owner Jinn');
 get diagnostics n=row_count;
 if n <> 0 then raise exception 'second owner moved first owner Wish'; end if;
end $$;
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role anon;
do $$ begin if (select count(*) from public.wish_records) <> 0 then raise exception 'anonymous saved-work access'; end if;
 exception when insufficient_privilege then null; end $$;
SQL
echo 'F03 legacy coexistence, multi-Jinn assignment, 5+ Wishes, owner RLS, persistence and safe deletion: PASS'

# F03-004 expand migration follows legacy regression fixtures:
# keep legacy client/save RPC operational until an explicitly authorized retirement.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261116040000_f03_004_verified_first_value.sql
# Simulate a developer whose local DB already received the earlier draft
# migration which revoked this RPC. The next additive file must repair it
# without resetting or changing existing Wish data.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q -c "revoke execute on function public.create_wish_with_deed(uuid,text,jsonb,jsonb) from authenticated;"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261116170000_f03_004_restore_legacy_first_save_grant.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
 if not has_function_privilege('authenticated',
   'public.create_wish_with_deed(uuid,text,jsonb,jsonb)','EXECUTE') then
   raise exception 'Legacy first-save fallback broke during expansion'; end if;
 if has_function_privilege('authenticated',
   'public.create_verified_first_value(uuid,uuid,text,jsonb,jsonb)','EXECUTE') then
   raise exception 'Client can call the server-only receipt function'; end if;
 if not has_function_privilege('service_role',
   'public.create_verified_first_value(uuid,uuid,text,jsonb,jsonb)','EXECUTE') then
   raise exception 'Verified server cannot write first value'; end if;
end $$;
grant usage on schema public to service_role;
grant select, insert on public.jinns, public.wish_records, public.deeds, public.artifacts to service_role;
set role service_role;
select public.create_verified_first_value(
 '00000000-0000-0000-0000-000000000001'::uuid,
 (select id from public.jinns where user_id='00000000-0000-0000-0000-000000000001' and is_primary limit 1),
 'Create an independent first value result',
 '{"title":"A first result","sourceNote":"","sections":[{"type":"document","title":"Useful first text","body":"A fully usable starter draft based on input."}],"unknowns":[],"nextDeed":{"title":"Refine one fact","why":"Ground the text","prompt":"Add a correction"},"boundary":"Private only","experience":{"version":1,"locale":"en","intent":"Start","firstOutcome":"An artifact","deed":{"title":"Write","scope":"PRIVATE_DRAFT","result":"A draft"},"questions":[],"components":["jinn_identity","deed_proposal","artifact_reader","source_status","work_receipt","next_deed"]}}'::jsonb,
 '{"status":"PREPARED","operation":"AI composed a private First Artifact from your Wish and selected answers","recordedAt":"2026-11-16T02:00:00Z","scope":"Private draft only. No external action or source verification.","draftSource":"model"}'::jsonb);
reset role;
do $$ begin
 if (select count(*) from public.wish_records where original_intent='Create an independent first value result')<>1
   then raise exception 'Server-only first-value atomic save failed'; end if;
 if (select count(*) from public.artifacts where content->'experience'->>'version'='1')<>1
   then raise exception 'Experience Plan persistence failed'; end if;
 if (select count(*) from public.wishes)<>5 then
   raise exception 'Legacy Wishes unexpectedly altered'; end if;
end $$;
SQL

# A client from the previous release and an existing saved Wish remain usable.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
select public.create_wish_with_deed(
 (select id from public.jinns where user_id='00000000-0000-0000-0000-000000000001' and is_primary limit 1),
 'Legacy client saved during mixed-version rollout',
 '{"title":"Existing client draft","sourceNote":"Confirmed legacy note","sections":[{"type":"document","title":"Historical content","body":"Old saved work must remain editable."}],"unknowns":[],"nextDeed":{"title":"Edit","why":"Make a correction","prompt":"Correct one detail"},"boundary":"Private draft"}'::jsonb,
 '{"status":"PREPARED","operation":"Legacy client prepared a draft","recordedAt":"2026-11-16T02:00:00Z","scope":"Private draft","draftSource":"model"}'::jsonb);
select public.correct_artifact(
 (select a.id from public.artifacts a join public.wish_records w on w.id=a.wish_id
    where w.original_intent='Make a family story book' limit 1),
 (select a.version from public.artifacts a join public.wish_records w on w.id=a.wish_id
    where w.original_intent='Make a family story book' limit 1),
 jsonb_set(
   (select a.content from public.artifacts a join public.wish_records w on w.id=a.wish_id
     where w.original_intent='Make a family story book' limit 1),
   '{sourceNote}','"Confirmed after migration"'::jsonb));
do $$ begin
 if (select count(*) from public.wish_records where original_intent='Legacy client saved during mixed-version rollout')<>1 then
   raise exception 'Existing client first-save fallback failed after F03-004 migration'; end if;
 if not exists (select 1 from public.artifacts a join public.wish_records w on w.id=a.wish_id
   where w.original_intent='Make a family story book' and a.version>1 and a.content->>'sourceNote'='Confirmed after migration') then
   raise exception 'Previously saved Wish could not be corrected after migration'; end if;
end $$;
reset role;
SQL
echo 'F03-004 expand: old client save, existing saved Wish correction and verified server save: PASS'

# Prove Phase 2 is separately executable and reversible on the disposable DB.
# NEVER apply contract/rollback SQL to hosted Supabase as part of CI.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < docs/release/f03-004-retire-legacy-first-save.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
 if has_function_privilege('authenticated','public.create_wish_with_deed(uuid,text,jsonb,jsonb)','EXECUTE')
   then raise exception 'Retirement failed to close legacy client receipt route'; end if;
 if not has_function_privilege('service_role','public.create_verified_first_value(uuid,uuid,text,jsonb,jsonb)','EXECUTE')
   then raise exception 'Retirement damaged verified server saving'; end if;
 if (select count(*) from public.wishes)<>5 then raise exception 'Retirement modified legacy records'; end if;
end $$;
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < docs/release/f03-004-restore-legacy-first-save.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
 if not has_function_privilege('authenticated','public.create_wish_with_deed(uuid,text,jsonb,jsonb)','EXECUTE')
   then raise exception 'Rollback did not restore legacy client compatibility'; end if;
end $$;
SQL
echo 'F03-004 later contract & rollback are independently verified (NOT hosted or automatically applied): PASS'

# F04 remains isolated in this disposable Postgres instance. Existing F03 rows
# are left in place so the test also catches destructive migration behavior.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261120192233_f04_001_trusted_continuation.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ declare v_wish uuid; v_revision integer; begin
  select id into v_wish from public.wish_records where original_intent='Create an independent first value result';
  v_revision:=public.set_trusted_wish_context(v_wish,0,'["Sunday pancakes with Aunt"]'::jsonb,
    '["Other biographical details remain unknown"]'::jsonb,true);
  if v_revision<>1 then raise exception 'Context revision did not advance'; end if;
  begin
    perform public.set_trusted_wish_context(v_wish,0,'["Sunday pancakes with Grandma"]'::jsonb,'[]'::jsonb,true);
    raise exception 'Stale context correction was accepted';
  exception when serialization_failure then null; end;
  if (select wish_context->'confirmedFacts' from public.wish_records where id=v_wish)<>'["Sunday pancakes with Aunt"]'::jsonb
    then raise exception 'Correction precedence failed'; end if;
  begin
    update public.artifacts set version=version+1 where wish_id=v_wish;
    raise exception 'Direct Artifact update bypassed correction RPC';
  exception when others then
    if sqlerrm='Direct Artifact update bypassed correction RPC' then raise; end if;
  end;
  begin
    insert into public.deeds(wish_id,user_id,operation,input,receipt,status,verified_followup,actor_jinn_id)
      values(v_wish,'00000000-0000-0000-0000-000000000001','forged','{}',
        '{"status":"PREPARED","verified":true}'::jsonb,'PREPARED',true,
        (select primary_jinn_id from public.wish_records where id=v_wish));
    raise exception 'Client forged verified attribution';
  exception when others then
    if sqlerrm='Client forged verified attribution' then raise; end if;
  end;
  begin
    perform public.create_verified_continuation('00000000-0000-0000-0000-000000000001',v_wish,
      (select id from public.artifacts where wish_id=v_wish limit 1),1,1,
      (select primary_jinn_id from public.wish_records where id=v_wish),
      (select name from public.jinns where id=(select primary_jinn_id from public.wish_records where id=v_wish)),
      (select updated_at from public.jinns where id=(select primary_jinn_id from public.wish_records where id=v_wish)),
      (select id from public.deeds where wish_id=v_wish limit 1),
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', repeat('a',64), '{}'::jsonb,'model');
    raise exception 'Client called server-only RPC';
  exception when others then
    if sqlerrm='Client called server-only RPC' then raise; end if;
  end;
end $$;
reset role;
set role service_role;
do $$ declare v_wish uuid; v_source uuid; v_deed uuid; v_result jsonb; v_replay jsonb;
  v_first jsonb; v_actor text; v_key uuid:='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  v_artifact jsonb:='{"title":"Chapter opening","sourceNote":"","sections":[{"type":"document","title":"Opening","body":"Sunday pancakes with Aunt. This is a grounded private opening, with other details intentionally left unknown."}],"unknowns":[],"nextDeed":{"title":"Next scene","why":"Advance the story","prompt":"Choose another confirmed memory"},"boundary":"Private draft","experience":{"version":1,"locale":"en","intent":"Continue the book","firstOutcome":"A chapter opening","deed":{"title":"Write opening","scope":"PRIVATE_DRAFT","result":"A chapter opening"},"questions":[],"components":["jinn_identity","deed_proposal","artifact_reader","source_status","work_receipt","next_deed"]}}'::jsonb;
begin
  select id into v_wish from public.wish_records where original_intent='Create an independent first value result';
  select id,content into v_source,v_first from public.artifacts where wish_id=v_wish limit 1;
  select id into v_deed from public.deeds where wish_id=v_wish order by created_at desc,id desc limit 1;
  select name into v_actor from public.jinns where id=(select primary_jinn_id from public.wish_records where id=v_wish);
  v_result:=public.create_verified_continuation('00000000-0000-0000-0000-000000000001',v_wish,
  v_source,1,1,(select primary_jinn_id from public.wish_records where id=v_wish),v_actor,
  (select updated_at from public.jinns where name=v_actor),v_deed,v_key,repeat('a',64),v_artifact,'model');
  v_replay:=public.create_verified_continuation('00000000-0000-0000-0000-000000000001',v_wish,
  v_source,1,1,(select primary_jinn_id from public.wish_records where id=v_wish),v_actor,
  (select updated_at from public.jinns where name=v_actor),v_deed,v_key,repeat('a',64),v_artifact,'model');
  if v_result->>'deedId' is distinct from v_replay->>'deedId'
    or v_result->>'artifactId' is distinct from v_replay->>'artifactId'
    or (select count(*) from public.artifacts where wish_id=v_wish)<>2
    or (select count(*) from public.deeds where wish_id=v_wish)<>2
    or (select content from public.artifacts where id=v_source)<>v_first then
    raise exception 'Independent save, idempotency, or First Artifact preservation failed'; end if;
  if (select actor_jinn_name from public.deeds where id=(v_result->>'deedId')::uuid)<>v_actor
    or (select verified_followup from public.deeds where id=(v_result->>'deedId')::uuid) is not true then
    raise exception 'Historical actor or verified marker missing'; end if;
  if (select actor_jinn_id from public.deeds where id=v_deed) is not null
    or (select actor_jinn_name from public.deeds where id=v_deed) is not null then
    raise exception 'Pre-migration First Deed was guessed from current assignment'; end if;
  perform public.create_verified_first_value('00000000-0000-0000-0000-000000000001',
    (select primary_jinn_id from public.wish_records where id=v_wish),
    'F04 new First Deed actor snapshot',v_first,
    '{"status":"PREPARED","scope":"Private draft","draftSource":"model"}'::jsonb);
  if not exists(select 1 from public.deeds d join public.wish_records w on w.id=d.wish_id
    where w.original_intent='F04 new First Deed actor snapshot' and d.verified_first
      and d.actor_jinn_id=w.primary_jinn_id and d.actor_jinn_name=v_actor) then
    raise exception 'New First Deed actor was not captured at save'; end if;
  begin
    perform public.create_verified_continuation('00000000-0000-0000-0000-000000000001',v_wish,
      v_source,1,1,(select primary_jinn_id from public.wish_records where id=v_wish),
      v_actor,(select updated_at from public.jinns where name=v_actor),
      v_deed,v_key,repeat('b',64),v_artifact,'model');
    raise exception 'Different approved action replayed an unrelated Artifact';
  exception when unique_violation then null; end;
  if (select count(*) from public.artifacts where wish_id=v_wish)<>2 then
    raise exception 'Conflicting key changed saved work'; end if;
  begin
    perform public.create_verified_continuation('00000000-0000-0000-0000-000000000001',v_wish,
      v_source,1,0,(select primary_jinn_id from public.wish_records where id=v_wish),v_actor,
      (select updated_at from public.jinns where name=v_actor),v_deed,gen_random_uuid(),repeat('c',64),v_artifact,'model');
    raise exception 'Stale context accepted';
  exception when serialization_failure then null; end;
  if (select count(*) from public.artifacts where wish_id=v_wish)<>2 then
    raise exception 'Failed write left an Artifact'; end if;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ declare v_wish uuid; v_new uuid; begin
  select id into v_wish from public.wish_records where original_intent='Create an independent first value result';
  insert into public.jinns(user_id,name,is_primary)
    values('00000000-0000-0000-0000-000000000001','Later Jinn',false) returning id into v_new;
  update public.wish_records set primary_jinn_id=v_new where id=v_wish;
  update public.jinns set name='Earlier Jinn renamed' where id=(select actor_jinn_id
    from public.deeds where wish_id=v_wish and verified_followup);
end $$;
reset role;
set role service_role;
do $$ declare v_wish uuid; v_old_actor uuid; begin
  select id into v_wish from public.wish_records where original_intent='Create an independent first value result';
  select actor_jinn_id into v_old_actor from public.deeds where wish_id=v_wish and verified_followup;
  if (select count(*) from public.deeds where wish_id=v_wish and actor_jinn_id=v_old_actor)<>1
    or (select actor_jinn_name from public.deeds where wish_id=v_wish and verified_followup)='Later Jinn'
    then raise exception 'Reassignment rewrote historical actor'; end if;
  if not exists(select 1 from public.deeds d join public.wish_records w on w.id=d.wish_id
    where w.original_intent='F04 new First Deed actor snapshot' and d.actor_jinn_id=v_old_actor
      and d.actor_jinn_name is distinct from 'Earlier Jinn renamed') then
    raise exception 'Rename rewrote First Deed attribution'; end if;
  begin
    perform public.create_verified_continuation('00000000-0000-0000-0000-000000000001',v_wish,
      (select id from public.artifacts where wish_id=v_wish order by created_at limit 1),1,1,
      v_old_actor,'Earlier Jinn renamed',(select updated_at from public.jinns where id=v_old_actor),
      (select id from public.deeds where wish_id=v_wish order by created_at desc,id desc limit 1),
      gen_random_uuid(),repeat('d',64),(select content from public.artifacts where wish_id=v_wish order by created_at desc limit 1),'model');
    raise exception 'Stale Jinn assignment accepted';
  exception when serialization_failure then null; end;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ begin
  if (select count(*) from public.wish_records)<>0
    or (select count(*) from public.deeds)<>0 or (select count(*) from public.artifacts)<>0 then
    raise exception 'Second account can inspect first account work'; end if;
end $$;
SQL
echo 'F04 context, forged marker denial, atomic independent save, replay, stale conflict and two-owner RLS: PASS'

# Two independent service requests with the SAME stable key race on the Wish
# row lock. Both must resolve to one Deed and one new Artifact.
race_sql=$(mktemp)
race_a=$(mktemp)
race_b=$(mktemp)
trap 'rm -f "$race_sql" "$race_a" "$race_b"; docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
cat > "$race_sql" <<'SQL'
set role service_role;
select (result->>'deedId') || '|' || (result->>'artifactId') from (
  select public.create_verified_continuation(
    '00000000-0000-0000-0000-000000000001'::uuid,
    w.id,
    (select id from public.artifacts where wish_id=w.id order by created_at,id limit 1),
    1,1,w.primary_jinn_id,
    (select name from public.jinns where id=w.primary_jinn_id),
    (select updated_at from public.jinns where id=w.primary_jinn_id),
    (select id from public.deeds where wish_id=w.id order by created_at desc,id desc limit 1),
    'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
    repeat('e',64),
    (select content from public.artifacts where wish_id=w.id order by created_at desc,id desc limit 1),
    'model') as result
  from public.wish_records w where w.original_intent='Create an independent first value result'
) x;
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -t -A < "$race_sql" > "$race_a" &
race_pid_a=$!
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -t -A < "$race_sql" > "$race_b" &
race_pid_b=$!
wait "$race_pid_a"
wait "$race_pid_b"
test "$(tail -1 "$race_a")" = "$(tail -1 "$race_b")"
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ declare v_wish uuid; begin
  select id into v_wish from public.wish_records where original_intent='Create an independent first value result';
  if (select count(*) from public.deeds where wish_id=v_wish)<>3
    or (select count(*) from public.artifacts where wish_id=v_wish)<>3
    or (select count(*) from public.deeds where wish_id=v_wish and request_key='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')<>1
    then raise exception 'Concurrent idempotency created duplicate work'; end if;
end $$;
SQL
echo 'F04 concurrent identical requests persisted one Deed and one Artifact: PASS'
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ declare v_wish uuid; v_source uuid; begin
  select id into v_wish from public.wish_records where original_intent='Create an independent first value result';
  select id into v_source from public.artifacts where wish_id=v_wish order by created_at,id limit 1;
  perform public.correct_artifact(v_source,1,jsonb_set(
    (select content from public.artifacts where id=v_source),'{sourceNote}',
    '"Sunday pancakes with Aunt"'::jsonb));
  if (select wish_context->'confirmedFacts' from public.wish_records where id=v_wish)<>'["Sunday pancakes with Aunt"]'::jsonb
    or (select wish_context->>'revision' from public.wish_records where id=v_wish)<>'2'
    then raise exception 'Source correction erased trusted context or failed to advance revision'; end if;
end $$;
SQL
echo 'F04 versioned source correction preserved confirmed facts: PASS'
