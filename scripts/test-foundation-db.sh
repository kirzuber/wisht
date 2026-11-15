#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="wisht-f03-test-$$"
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=localtest "${WISHT_TEST_PG_IMAGE:-postgres:17-alpine}" >/dev/null
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
for attempt in {1..30}; do docker exec "$container" pg_isready -U postgres >/dev/null 2>&1 && break; sleep 1; done
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
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261115201523_f03_domain_neutral_baseline.sql
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
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role anon;
do $$ begin if (select count(*) from public.wish_records) <> 0 then raise exception 'anonymous saved-work access'; end if;
 exception when insufficient_privilege then null; end $$;
SQL
echo 'F03 schema, four wishes, atomic save/edit/follow-up, return, RLS and deletion: PASS'
