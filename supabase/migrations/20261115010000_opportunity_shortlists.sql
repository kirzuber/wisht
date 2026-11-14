-- JINN-003.2: persistent user-owned research shortlist, not organizer-certified fact.
-- One list per photography wish per UTC day; deduplicates repeated saves.
create table public.opportunity_shortlists (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 wish_id uuid not null,
 genre text not null check (genre in ('any','nature','portrait','open')),
 free_only boolean not null default true,
 source text not null default 'pixcontests_calendar' check(source='pixcontests_calendar'),
 feed_url text not null check(feed_url in (
  'https://pixcontests.com/calendar/free.ics','https://pixcontests.com/calendar/all.ics'
 )),
 fetched_at timestamptz not null,
 matches jsonb not null check (
  jsonb_typeof(matches)='array' and jsonb_array_length(matches) between 1 and 5
 ),
 created_on date not null default (now() at time zone 'UTC')::date,
 created_at timestamptz not null default now(),
 constraint shortlist_same_owner_fk foreign key (wish_id,user_id)
  references public.wishes(id,user_id) on delete cascade,
 unique(wish_id,created_on)
);
create index opportunity_shortlists_owner on public.opportunity_shortlists(user_id,created_at desc);
alter table public.opportunity_shortlists enable row level security;
revoke all on public.opportunity_shortlists from public,anon,authenticated;
grant select,insert,delete on public.opportunity_shortlists to authenticated;

create policy "verified owner reads shortlists" on public.opportunity_shortlists
 for select to authenticated
 using ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner saves own shortlists" on public.opportunity_shortlists
 for insert to authenticated
 with check ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner deletes own shortlists" on public.opportunity_shortlists
 for delete to authenticated
 using ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);

create or replace function private.validate_scout_shortlist()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare
 kind_of_goal text;
 entry jsonb;
begin
 select w.kind into kind_of_goal from public.wishes w
  where w.id=new.wish_id and w.user_id=new.user_id;
 if kind_of_goal is distinct from 'photography' then
  raise exception 'SCOUT_REQUIRES_PHOTOGRAPHY_WISH' using errcode='P0001';
 end if;
 if new.fetched_at < now()-interval '2 hours' or new.fetched_at > now()+interval '3 minutes' then
  raise exception 'SCOUT_RESULTS_STALE' using errcode='P0001';
 end if;
 for entry in select value from pg_catalog.jsonb_array_elements(new.matches)
 loop
  if coalesce(entry->>'sourceUrl','') !~ '^https://(www[.])?pixcontests[.]com/'
   or coalesce(entry->>'title','')=''
   or coalesce(entry->>'deadline','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
   or coalesce(entry->>'evidence','') <> 'calendar_listing'
  then
   raise exception 'INVALID_SCOUT_EVIDENCE' using errcode='P0001';
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.validate_scout_shortlist() from public,anon,authenticated;
create trigger validate_scout_shortlist before insert on public.opportunity_shortlists
for each row execute function private.validate_scout_shortlist();

-- A scout result is a wish deed, not a portfolio. Reuse the durable receipt history
-- without misattributing research to a gallery.
alter table public.work_receipts alter column portfolio_id drop not null;
alter table public.work_receipts add column shortlist_id uuid
 references public.opportunity_shortlists(id) on delete set null;
alter table public.work_receipts add column opportunity_count integer
 not null default 0 check(opportunity_count between 0 and 5);
alter table public.work_receipts drop constraint work_receipts_action_check;
alter table public.work_receipts add constraint work_receipts_action_check
 check (action in ('PRIVATE_GALLERY_CREATED','PUBLIC_LISTING_CREATED',
  'PUBLIC_LISTING_REMOVED','OPPORTUNITY_SHORTLIST_SAVED'));

create or replace function private.record_work_receipt()
returns trigger
language plpgsql security definer
set search_path=''
as $$
declare
 v_user uuid;v_wish uuid;v_portfolio uuid;v_action text;
 v_count integer:=0;v_slug text;v_shortlist uuid;v_opportunity_count integer:=0;
begin
 if TG_TABLE_NAME='portfolios' and TG_OP='INSERT' then
  v_user:=new.user_id;v_wish:=new.wish_id;v_portfolio:=new.id;
  v_action:='PRIVATE_GALLERY_CREATED';v_count:=pg_catalog.jsonb_array_length(new.photos);
 elsif TG_TABLE_NAME='portfolio_publications' and TG_OP in ('INSERT','DELETE') then
  v_user:=case when TG_OP='INSERT' then new.user_id else old.user_id end;
  v_portfolio:=case when TG_OP='INSERT' then new.portfolio_id else old.portfolio_id end;
  v_action:=case when TG_OP='INSERT' then 'PUBLIC_LISTING_CREATED' else 'PUBLIC_LISTING_REMOVED' end;
  v_count:=case when TG_OP='INSERT' then pg_catalog.jsonb_array_length(new.photos)
    else pg_catalog.jsonb_array_length(old.photos) end;
  v_slug:=case when TG_OP='INSERT' then new.slug else old.slug end;
  select p.wish_id into v_wish from public.portfolios p
   where p.id=v_portfolio and p.user_id=v_user;
  if v_wish is null then
   raise exception 'RECEIPT_PARENT_NOT_FOUND' using errcode='P0001';
  end if;
 elsif TG_TABLE_NAME='opportunity_shortlists' and TG_OP='INSERT' then
  v_user:=new.user_id;v_wish:=new.wish_id;v_shortlist:=new.id;
  v_action:='OPPORTUNITY_SHORTLIST_SAVED';
  v_opportunity_count:=pg_catalog.jsonb_array_length(new.matches);
 else
  raise exception 'UNSUPPORTED_RECEIPT_EVENT';
 end if;
 insert into public.work_receipts
  (user_id,wish_id,portfolio_id,shortlist_id,action,photo_count,opportunity_count,public_slug,source)
 values(v_user,v_wish,v_portfolio,v_shortlist,v_action,v_count,v_opportunity_count,v_slug,'database_event');
 return null;
end $$;
revoke all on function private.record_work_receipt() from public,anon,authenticated;
create trigger record_saved_opportunity_shortlist
 after insert on public.opportunity_shortlists
 for each row execute function private.record_work_receipt();
