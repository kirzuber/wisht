#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
container="wisht-f03-cutover-$$"
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
insert into auth.users values('00000000-0000-0000-0000-000000000001');
create table public.wishes(id uuid primary key, user_id uuid not null references auth.users(id), kind text not null, mission_id text not null);
create table public.portfolios(id uuid primary key, wish_id uuid references public.wishes(id));
create table public.portfolio_publications(id uuid primary key, portfolio_id uuid references public.portfolios(id));
create table public.opportunity_shortlists(id uuid primary key, wish_id uuid references public.wishes(id));
create table public.submission_packages(id uuid primary key, wish_id uuid references public.wishes(id));
create table public.photo_watches(id uuid primary key, wish_id uuid references public.wishes(id));
create table public.photo_watch_runs(id uuid primary key, watch_id uuid references public.photo_watches(id));
create table public.career_shortlists(id uuid primary key, wish_id uuid references public.wishes(id));
create table public.soccer_shortlists(id uuid primary key, wish_id uuid references public.wishes(id));
create table public.work_receipts(id uuid primary key, wish_id uuid references public.wishes(id));
insert into public.wishes values('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','photography','portfolio');
insert into public.portfolios values('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001');
insert into public.portfolio_publications values('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
SQL
{
 printf 'begin;\nset local wisht.cutover_approved = yes;\nset local wisht.backup_verified = yes;\n'
 cat supabase/cutover/archive-legacy.sql
 cat supabase/migrations/20261115201523_f03_domain_neutral_baseline.sql
 printf 'commit;\n'
} | docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
 if (select count(*) from legacy_archive.wishes)<>1 or (select count(*) from legacy_archive.portfolios)<>1
 or (select count(*) from legacy_archive.portfolio_publications)<>1 then raise exception 'archive rows missing'; end if;
 if (select count(*) from public.wish_records)<>0 or to_regclass('public.artifacts') is null then raise exception 'F03 baseline absent'; end if;
 if (select count(*) from auth.users)<>1 then raise exception 'Auth altered'; end if;
end $$;
SQL
{
 printf 'begin;\nset local wisht.rollback_approved = yes;\n'
 cat supabase/cutover/rollback-legacy.sql
 printf 'commit;\n'
} | docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q
docker exec -i "$container" psql -U postgres -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
 if (select count(*) from public.wishes)<>1 or (select count(*) from public.portfolios)<>1
 or (select count(*) from public.portfolio_publications)<>1 then raise exception 'rollback lost legacy data'; end if;
 if to_regclass('f03_rollback.wish_records') is null or (select count(*) from auth.users)<>1 then raise exception 'rollback lost new schema or Auth'; end if;
end $$;
SQL
echo 'Synthetic legacy dependency graph archive -> F03 baseline -> non-destructive rollback: PASS'
