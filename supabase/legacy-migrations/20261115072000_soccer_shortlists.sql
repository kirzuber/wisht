-- JINN-004.2 source-linked club research saved under one soccer wish.
-- A stored result does NOT establish open registration, trial places or contact.
create table public.soccer_shortlists (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 wish_id uuid not null,
 city text not null check (length(city) between 2 and 65),
 level text not null check (level in ('beginner','recreational','competitive')),
 age_group text not null check (age_group in ('adult','youth')),
 source text not null default 'curated_ontario_clubs_v1'
   check (source='curated_ontario_clubs_v1'),
 fetched_at timestamptz not null,
 matches jsonb not null check (jsonb_typeof(matches)='array'
   and jsonb_array_length(matches) between 1 and 5),
 created_on date not null default (now() at time zone 'UTC')::date,
 created_at timestamptz not null default now(),
 constraint soccer_shortlist_same_owner_fk foreign key (wish_id,user_id)
   references public.wishes(id,user_id) on delete cascade,
 constraint soccer_one_shortlist_daily unique (wish_id,created_on)
);
create index soccer_shortlist_by_owner on public.soccer_shortlists(user_id,created_at desc);
alter table public.soccer_shortlists enable row level security;
revoke all on public.soccer_shortlists from public,anon,authenticated;
grant select,insert,delete on public.soccer_shortlists to authenticated;
create policy "verified owner reads soccer shortlists" on public.soccer_shortlists
 for select to authenticated using (
 (select auth.uid())=user_id and
 coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner saves soccer shortlists" on public.soccer_shortlists
 for insert to authenticated with check (
 (select auth.uid())=user_id and
 coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner deletes soccer shortlists" on public.soccer_shortlists
 for delete to authenticated using (
 (select auth.uid())=user_id and
 coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);

create or replace function private.validate_soccer_shortlist()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare kind text; item jsonb;
begin
 select w.kind into kind from public.wishes w
 where w.id=new.wish_id and w.user_id=new.user_id;
 if kind is distinct from 'soccer' then
  raise exception 'SOCCER_SHORTLIST_REQUIRES_SOCCER_WISH' using errcode='P0001';
 end if;
 if new.fetched_at<now()-interval '2 hours' or new.fetched_at>now()+interval '3 minutes' then
  raise exception 'SOCCER_SHORTLIST_STALE' using errcode='P0001';
 end if;
 for item in select value from pg_catalog.jsonb_array_elements(new.matches) loop
  if length(coalesce(item->>'name',''))<3
   or length(coalesce(item->>'city',''))<2
   or coalesce(item->>'evidence','')<>'program_documented'
   or coalesce(item->>'sourceUrl','') !~ '^https://(www[.])?(burlingtonsoccer[.]com|oakvillesoccer[.]ca|oakvillesoccer[.]com|guelphsoccer[.]ca|erinmillssoccer[.]com|thpfc[.]ca|osu[.]ca)/'
   or coalesce(item->>'programUrl','') !~ '^https://(www[.])?(burlingtonsoccer[.]com|oakvillesoccer[.]ca|oakvillesoccer[.]com|guelphsoccer[.]ca|erinmillssoccer[.]com|thpfc[.]ca|osu[.]ca)/'
  then raise exception 'SOCCER_SHORTLIST_INVALID_SOURCE' using errcode='P0001';
  end if;
 end loop;
 return new;
end $$;
revoke all on function private.validate_soccer_shortlist() from public,anon,authenticated;
create trigger validate_soccer_shortlist before insert on public.soccer_shortlists
 for each row execute function private.validate_soccer_shortlist();

alter table public.work_receipts add column soccer_shortlist_id uuid
 references public.soccer_shortlists(id) on delete set null;
alter table public.work_receipts drop constraint work_receipts_action_check;
alter table public.work_receipts add constraint work_receipts_action_check
 check(action in ('PRIVATE_GALLERY_CREATED','PUBLIC_LISTING_CREATED','PUBLIC_LISTING_REMOVED',
  'OPPORTUNITY_SHORTLIST_SAVED','SUBMISSION_DRAFT_SAVED','WATCH_CHECK_COMPLETED',
  'CAREER_SHORTLIST_SAVED','SOCCER_SHORTLIST_SAVED'));

create or replace function private.record_soccer_shortlist_receipt()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
 insert into public.work_receipts
   (user_id,wish_id,soccer_shortlist_id,action,opportunity_count,photo_count,source)
 values(new.user_id,new.wish_id,new.id,'SOCCER_SHORTLIST_SAVED',
   pg_catalog.jsonb_array_length(new.matches),0,'database_event');
 return null;
end $$;
revoke all on function private.record_soccer_shortlist_receipt() from public,anon,authenticated;
create trigger record_saved_soccer_shortlist after insert on public.soccer_shortlists
 for each row execute function private.record_soccer_shortlist_receipt();
