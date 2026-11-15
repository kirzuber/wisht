#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# Disposable PostgreSQL proof for the F02 migration. No hosted database is touched.
container="wisht-f02-test-$$"
image="${WISHT_TEST_PG_IMAGE:-postgres:17-alpine}"
docker run --rm -d --name "$container" -e POSTGRES_PASSWORD=localtest "$image" >/dev/null
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
for attempt in {1..20}; do
  if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
  sleep 1
done

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
create role anon nologin;
create role authenticated nologin;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb
$$;
insert into auth.users values
  ('00000000-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-000000000002'),
  ('00000000-0000-0000-0000-000000000003');
grant usage on schema auth to authenticated;
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261114000000_create_wishes.sql
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
create policy "verified account required for wishes" on public.wishes
  as restrictive for all to authenticated
  using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
  with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);
insert into public.wishes(user_id,aspiration,kind,mission_id,answer,status) values
  ('00000000-0000-0000-0000-000000000001','Build my photography portfolio','photography','portfolio','start','PLANNED'),
  ('00000000-0000-0000-0000-000000000002','Find a remote career','career','research','start','PLANNED'),
  ('00000000-0000-0000-0000-000000000003','Find a soccer club','soccer','clubs','start','PLANNED');
SQL
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q < supabase/migrations/20261115080000_first_real_wish.sql

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
  if (select count(*) from public.wishes where kind in ('photography','career','soccer') and first_artifact is null and jinn_id is null) <> 3
    then raise exception 'existing wish rows were not preserved'; end if;
  if (select count(*) from public.wishes where revision = 1 and deed_history = '[]'::jsonb) <> 3
    then raise exception 'existing wish defaults were not populated'; end if;
end $$;
SQL

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
insert into public.jinns(user_id) values ('00000000-0000-0000-0000-000000000001');
insert into public.wishes(user_id,aspiration,kind,mission_id,answer,status,jinn_id,first_artifact,first_deed,deed_history)
select user_id,'Plant observation log','personal','first-real-deed','Leaves drooping','PLANNED',id,
  '{"title":"Care log","sourceNote":"Leaves drooping","sections":[{"type":"document","title":"Observation","body":"Check soil"}],"unknowns":["Cause"],"nextDeed":{"title":"Observe","why":"Learn","prompt":"Record"},"boundary":"No diagnosis"}'::jsonb,
  '{"status":"PREPARED","operation":"AI draft"}'::jsonb,
  '[{"status":"PREPARED","operation":"AI draft"}]'::jsonb
from public.jinns where user_id='00000000-0000-0000-0000-000000000001';
do $$ begin if (select count(*) from public.wishes) <> 2 then raise exception 'owner insert/read failed'; end if; end $$;
SQL

# A new connection simulates reload. The other user cannot inspect, edit or delete.
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ declare changed integer; begin
  if (select count(*) from public.wishes) <> 1 or (select count(*) from public.wishes where first_artifact is not null) <> 0
    or (select count(*) from public.jinns) <> 0 then raise exception 'cross-owner read leak'; end if;
  update public.wishes set first_artifact='{}'::jsonb where first_artifact is not null;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'cross-owner edit leak'; end if;
  delete from public.wishes where first_artifact is not null;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'cross-owner delete leak'; end if;
end $$;
SQL

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":true}',false);
do $$ begin if (select count(*) from public.wishes) <> 0 or (select count(*) from public.jinns) <> 0
  then raise exception 'anonymous account read leak'; end if; end $$;
SQL

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ begin if (select first_artifact->>'sourceNote' from public.wishes where first_artifact is not null) <> 'Leaves drooping'
  then raise exception 'reload failed'; end if; end $$;
update public.wishes set first_artifact=jsonb_set(first_artifact,'{sourceNote}','"Leaves firming"'::jsonb),revision=revision+1
  where first_artifact is not null;
SQL

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ begin if (select first_artifact->>'sourceNote' from public.wishes where first_artifact is not null) <> 'Leaves firming'
  then raise exception 'correction did not survive reload'; end if; end $$;
update public.wishes set deed_history=deed_history || '[{"status":"PREPARED","operation":"second draft"}]'::jsonb,
  first_deed='{"status":"PREPARED","operation":"second draft"}'::jsonb,revision=revision+1
  where first_artifact is not null;
SQL

docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
select set_config('request.jwt.claims','{"is_anonymous":false}',false);
do $$ begin if (select jsonb_array_length(deed_history) from public.wishes where first_artifact is not null) <> 2
  then raise exception 'second deed did not survive reload'; end if; end $$;
delete from public.wishes where first_artifact is not null;
do $$ begin if (select count(*) from public.wishes) <> 1 then raise exception 'delete removed an existing wish'; end if; end $$;
SQL
echo 'First wish migration, existing wishes, RLS, reload, correction, second deed and delete: PASS'
