-- Non-destructive rollback after a committed F03 cutover. Run only with a
-- reviewed maintenance plan. New generic rows move to f03_rollback, not DROP.
do $$ begin
 if current_setting('wisht.rollback_approved',true) is distinct from 'yes' then
  raise exception 'F03 rollback requires explicit approval';
 end if;
 if to_regclass('legacy_archive.wishes') is null then
  raise exception 'Legacy Wish snapshot is absent';
 end if;
end $$;
create schema if not exists f03_rollback;
revoke all on schema f03_rollback from public, anon, authenticated;
alter table public.artifacts set schema f03_rollback;
alter table public.deeds set schema f03_rollback;
alter table public.wish_records set schema f03_rollback;
alter table public.jinns set schema f03_rollback;
alter table if exists legacy_archive.jinns set schema public;
alter table legacy_archive.wishes set schema public;
alter table if exists legacy_archive.portfolios set schema public;
alter table if exists legacy_archive.work_receipts set schema public;
alter table if exists legacy_archive.soccer_shortlists set schema public;
alter table if exists legacy_archive.career_shortlists set schema public;
alter table if exists legacy_archive.photo_watches set schema public;
alter table if exists legacy_archive.photo_watch_runs set schema public;
alter table if exists legacy_archive.submission_packages set schema public;
alter table if exists legacy_archive.opportunity_shortlists set schema public;
alter table if exists legacy_archive.portfolio_publications set schema public;
