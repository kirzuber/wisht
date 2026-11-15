-- JINN-F03-001 hosted transition fragment. DO NOT run without a verified backup,
-- object export, URL inventory, founder approval and maintenance window.
-- Run in one transaction immediately before the F03 baseline SQL. This file
-- deliberately does not delete rows, buckets, objects or auth identities.
do $$ begin
 if current_setting('wisht.cutover_approved',true) is distinct from 'yes'
   or current_setting('wisht.backup_verified',true) is distinct from 'yes' then
  raise exception 'F03 hosted cutover requires explicit approval and a tested backup';
 end if;
end $$;
create schema if not exists legacy_archive;
revoke all on schema legacy_archive from public, anon, authenticated;
alter table if exists public.portfolio_publications set schema legacy_archive;
alter table if exists public.opportunity_shortlists set schema legacy_archive;
alter table if exists public.submission_packages set schema legacy_archive;
alter table if exists public.photo_watch_runs set schema legacy_archive;
alter table if exists public.photo_watches set schema legacy_archive;
alter table if exists public.career_shortlists set schema legacy_archive;
alter table if exists public.soccer_shortlists set schema legacy_archive;
alter table if exists public.work_receipts set schema legacy_archive;
alter table if exists public.portfolios set schema legacy_archive;
alter table if exists public.wishes set schema legacy_archive;
alter table if exists public.jinns set schema legacy_archive;
-- Public PostgREST RPC from the vertical watch must not remain callable.
do $$ begin
 if to_regprocedure('public.claim_due_photo_watches(integer)') is not null then
  execute 'revoke all on function public.claim_due_photo_watches(integer) from public, anon, authenticated';
 end if;
end $$;
