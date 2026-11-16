-- JINN-004.1: user-owned saved remote career shortlists.
-- Jobs are attributed to Himalayas and NOT independently employer-verified.
-- Do not store the user's private experience summary; it is transmitted to
-- DeepSeek only for explicit opt-in matching, not written into this table.
create table public.career_shortlists(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 wish_id uuid not null,
 query text not null check(length(query) between 3 and 90),
 country text not null check(country in ('CA','US','worldwide')),
 source text not null default 'himalayas_jobs' check(source='himalayas_jobs'),
 fetched_at timestamptz not null,
 ai_used boolean not null default false,
 matches jsonb not null check(jsonb_typeof(matches)='array' and
   jsonb_array_length(matches) between 1 and 5),
 created_on date not null default (now() at time zone 'UTC')::date,
 created_at timestamptz not null default now(),
 constraint career_shortlist_same_owner_fk foreign key(wish_id,user_id)
   references public.wishes(id,user_id) on delete cascade,
 constraint career_one_shortlist_daily unique(wish_id,created_on)
);
create index career_shortlist_by_owner on public.career_shortlists(user_id,created_at desc);
alter table public.career_shortlists enable row level security;
revoke all on public.career_shortlists from public,anon,authenticated;
grant select,insert,delete on public.career_shortlists to authenticated;
create policy "verified owner reads career shortlists" on public.career_shortlists
 for select to authenticated
 using ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner saves career shortlists" on public.career_shortlists
 for insert to authenticated
 with check ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner deletes career shortlists" on public.career_shortlists
 for delete to authenticated
 using ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);

create or replace function private.validate_career_shortlist()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare wish_kind text; item jsonb;
begin
 select kind into wish_kind from public.wishes where id=new.wish_id and user_id=new.user_id;
 if wish_kind is distinct from 'career' then
  raise exception 'CAREER_SHORTLIST_REQUIRES_CAREER_WISH' using errcode='P0001';
 end if;
 if new.fetched_at<now()-interval '2 hours' or new.fetched_at>now()+interval '3 minutes' then
  raise exception 'CAREER_SHORTLIST_STALE' using errcode='P0001';
 end if;
 for item in select value from pg_catalog.jsonb_array_elements(new.matches) loop
  if coalesce(item->>'sourceUrl','') !~ '^https://himalayas[.]app/companies/[a-z0-9-]+/jobs/[a-z0-9-]+/?$'
   or coalesce(item->>'applicationLink','') !~ '^https://[^ /]+'
   or length(coalesce(item->>'title',''))<2 or length(coalesce(item->>'company',''))<2 then
   raise exception 'CAREER_SHORTLIST_INVALID_LISTING' using errcode='P0001';
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.validate_career_shortlist() from public,anon,authenticated;
create trigger validate_career_shortlist before insert on public.career_shortlists
 for each row execute function private.validate_career_shortlist();

alter table public.work_receipts add column career_shortlist_id uuid
 references public.career_shortlists(id) on delete set null;
alter table public.work_receipts drop constraint work_receipts_action_check;
alter table public.work_receipts add constraint work_receipts_action_check
 check(action in ('PRIVATE_GALLERY_CREATED','PUBLIC_LISTING_CREATED','PUBLIC_LISTING_REMOVED',
  'OPPORTUNITY_SHORTLIST_SAVED','SUBMISSION_DRAFT_SAVED','WATCH_CHECK_COMPLETED',
  'CAREER_SHORTLIST_SAVED'));

-- A source-backed shortlist record was saved. This does not assert actual employer
-- vacancy, eligibility, correctness of user-submitted content, or AI accuracy.
create or replace function private.record_career_shortlist_receipt()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.work_receipts
  (user_id,wish_id,career_shortlist_id,action,opportunity_count,photo_count,source)
 values(new.user_id,new.wish_id,new.id,'CAREER_SHORTLIST_SAVED',
  pg_catalog.jsonb_array_length(new.matches),0,'database_event');
 return null;
end $$;
revoke all on function private.record_career_shortlist_receipt() from public,anon,authenticated;
create trigger record_saved_career_shortlist
 after insert on public.career_shortlists
 for each row execute function private.record_career_shortlist_receipt();
