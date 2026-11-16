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
create schema auth;
create table auth.users(id uuid primary key);
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
insert into public.jinns(user_id,is_primary,name) values
 ('00000000-0000-0000-0000-000000000002',true,'Other owner Jinn');
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
 select id into other_id from public.jinns where user_id='00000000-0000-0000-0000-000000000002';
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
