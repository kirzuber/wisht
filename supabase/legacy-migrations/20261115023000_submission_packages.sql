-- JINN-003.3: owner-owned submission drafts under one photography wish.
-- A prepared draft is NOT evidence of eligibility, organizer verification or external submission.
create table public.submission_packages(
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  wish_id uuid not null,
  shortlist_id uuid not null references public.opportunity_shortlists(id) on delete restrict,
  portfolio_id uuid not null references public.portfolios(id) on delete restrict,
  opportunity_id text not null check (char_length(opportunity_id) between 1 and 128),
  opportunity_title text not null check (char_length(opportunity_title) between 1 and 180),
  deadline date not null,
  listing_url text not null check (char_length(listing_url) <= 600),
  organizer_url text not null default '' check (char_length(organizer_url) <= 600),
  rules_notes text not null default '' check (char_length(rules_notes) <= 2500),
  reviewed_by_user boolean not null default false,
  artist_name text not null default '' check (char_length(artist_name) <= 120),
  artist_statement text not null default '' check (char_length(artist_statement) <= 2500),
  cover_note text not null default '' check (char_length(cover_note) <= 4000),
  selected_photos jsonb not null
    check(jsonb_typeof(selected_photos)='array'
      and jsonb_array_length(selected_photos) between 1 and 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint submission_package_wish_owner_fk foreign key(wish_id,user_id)
    references public.wishes(id,user_id) on delete cascade,
  constraint submission_unique_per_opportunity_and_gallery
    unique(shortlist_id,opportunity_id,portfolio_id)
);
create index submission_packages_by_wish on public.submission_packages(wish_id,created_at desc);
create index submission_packages_by_owner on public.submission_packages(user_id,created_at desc);

alter table public.submission_packages enable row level security;
revoke all on public.submission_packages from public,anon,authenticated;
grant select,delete on public.submission_packages to authenticated;
grant insert(user_id,wish_id,shortlist_id,portfolio_id,opportunity_id,
 opportunity_title,deadline,listing_url,organizer_url,rules_notes,
 reviewed_by_user,artist_name,artist_statement,cover_note,selected_photos)
 on public.submission_packages to authenticated;
grant update(organizer_url,rules_notes,reviewed_by_user,artist_name,
 artist_statement,cover_note,selected_photos) on public.submission_packages to authenticated;
create policy "verified owner reads submission packages" on public.submission_packages
 for select to authenticated
 using ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner creates submission packages" on public.submission_packages
 for insert to authenticated
 with check ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner edits submission packages" on public.submission_packages
 for update to authenticated
 using ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false)
 with check ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner removes submission packages" on public.submission_packages
 for delete to authenticated
 using ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);

create or replace function private.validate_submission_package()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare
  source_list record;
  gallery record;
  matched jsonb;
  photo jsonb;
  prior_uuid uuid;
begin
  if tg_op='UPDATE' then
    if (new.user_id,new.wish_id,new.shortlist_id,new.portfolio_id,
      new.opportunity_id,new.opportunity_title,new.deadline,new.listing_url)
       is distinct from
       (old.user_id,old.wish_id,old.shortlist_id,old.portfolio_id,
       old.opportunity_id,old.opportunity_title,old.deadline,old.listing_url)
    then
      raise exception 'SUBMISSION_IDENTITY_IMMUTABLE' using errcode='P0001';
    end if;
  end if;
  select id,wish_id,user_id,matches into source_list
  from public.opportunity_shortlists
  where id=new.shortlist_id and wish_id=new.wish_id and user_id=new.user_id;
  if source_list.id is null then
    raise exception 'SUBMISSION_SHORTLIST_OWNER_MISMATCH' using errcode='P0001';
  end if;
  select id,wish_id,user_id,photos into gallery
  from public.portfolios where id=new.portfolio_id and wish_id=new.wish_id
    and user_id=new.user_id;
  if gallery.id is null then
    raise exception 'SUBMISSION_PORTFOLIO_OWNER_MISMATCH' using errcode='P0001';
  end if;
  select value into matched from pg_catalog.jsonb_array_elements(source_list.matches)
    where value->>'id'=new.opportunity_id limit 1;
  if matched is null or coalesce(matched->>'title','')<>new.opportunity_title
   or coalesce(matched->>'deadline','')<>new.deadline::text
   or coalesce(matched->>'sourceUrl','')<>new.listing_url then
    raise exception 'SUBMISSION_OPPORTUNITY_MISMATCH' using errcode='P0001';
  end if;
  if new.listing_url !~ '^https://(www[.])?pixcontests[.]com/' then
    raise exception 'SUBMISSION_LISTING_URL_INVALID' using errcode='P0001';
  end if;
  if new.organizer_url<>'' and new.organizer_url !~ '^https://[^/?#:@ ]+(/[^ ]*)?$' then
    raise exception 'SUBMISSION_ORGANIZER_URL_INVALID' using errcode='P0001';
  end if;
  if new.reviewed_by_user and (new.organizer_url='' or pg_catalog.length(pg_catalog.btrim(new.rules_notes))<10) then
    raise exception 'SUBMISSION_REVIEW_REQUIRES_RULES' using errcode='P0001';
  end if;
  for photo in select value from pg_catalog.jsonb_array_elements(new.selected_photos) loop
    if coalesce(photo->>'id','')='' or
       not exists(select 1 from pg_catalog.jsonb_array_elements(gallery.photos) p
         where p->>'id'=photo->>'id' and p->>'path'=photo->>'path'
           and p->>'selected'='true') then
      raise exception 'SUBMISSION_INVALID_PHOTO_SELECTION' using errcode='P0001';
    end if;
  end loop;
  if (select count(distinct value->>'id') from pg_catalog.jsonb_array_elements(new.selected_photos))
      <> pg_catalog.jsonb_array_length(new.selected_photos) then
    raise exception 'SUBMISSION_DUPLICATE_PHOTO' using errcode='P0001';
  end if;
  new.updated_at:=now();
  return new;
end $$;
revoke all on function private.validate_submission_package() from public,anon,authenticated;
create trigger validate_submission_package
 before insert or update on public.submission_packages
 for each row execute function private.validate_submission_package();

-- Work Receipt: the durable fact is that a private submission DRAFT was saved.
-- The user may later confirm reading rules, but that does not attest to organizer consent.
alter table public.work_receipts add column submission_id uuid
 references public.submission_packages(id) on delete set null;
alter table public.work_receipts drop constraint work_receipts_action_check;
alter table public.work_receipts add constraint work_receipts_action_check
 check(action in ('PRIVATE_GALLERY_CREATED','PUBLIC_LISTING_CREATED',
  'PUBLIC_LISTING_REMOVED','OPPORTUNITY_SHORTLIST_SAVED','SUBMISSION_DRAFT_SAVED'));

create or replace function private.record_work_receipt()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid;v_wish uuid;v_portfolio uuid;v_action text;
 v_count integer:=0;v_slug text;v_shortlist uuid;
 v_opportunity_count integer:=0;v_submission uuid;
begin
 if TG_TABLE_NAME='portfolios' and TG_OP='INSERT' then
  v_user:=new.user_id;v_wish:=new.wish_id;v_portfolio:=new.id;
  v_action:='PRIVATE_GALLERY_CREATED';
  v_count:=pg_catalog.jsonb_array_length(new.photos);
 elsif TG_TABLE_NAME='portfolio_publications' and TG_OP in ('INSERT','DELETE') then
  v_user:=case when TG_OP='INSERT' then new.user_id else old.user_id end;
  v_portfolio:=case when TG_OP='INSERT' then new.portfolio_id else old.portfolio_id end;
  v_action:=case when TG_OP='INSERT' then 'PUBLIC_LISTING_CREATED' else 'PUBLIC_LISTING_REMOVED' end;
  v_count:=case when TG_OP='INSERT' then pg_catalog.jsonb_array_length(new.photos)
    else pg_catalog.jsonb_array_length(old.photos) end;
  v_slug:=case when TG_OP='INSERT' then new.slug else old.slug end;
  select p.wish_id into v_wish from public.portfolios p
   where p.id=v_portfolio and p.user_id=v_user;
  if v_wish is null then raise exception 'RECEIPT_PARENT_NOT_FOUND' using errcode='P0001';end if;
 elsif TG_TABLE_NAME='opportunity_shortlists' and TG_OP='INSERT' then
  v_user:=new.user_id;v_wish:=new.wish_id;v_shortlist:=new.id;
  v_action:='OPPORTUNITY_SHORTLIST_SAVED';
  v_opportunity_count:=pg_catalog.jsonb_array_length(new.matches);
 elsif TG_TABLE_NAME='submission_packages' and TG_OP='INSERT' then
  v_user:=new.user_id;v_wish:=new.wish_id;v_portfolio:=new.portfolio_id;
  v_shortlist:=new.shortlist_id;v_submission:=new.id;
  v_action:='SUBMISSION_DRAFT_SAVED';
  v_count:=pg_catalog.jsonb_array_length(new.selected_photos);
 else
  raise exception 'UNSUPPORTED_RECEIPT_EVENT';
 end if;
 insert into public.work_receipts
  (user_id,wish_id,portfolio_id,shortlist_id,submission_id,action,
   photo_count,opportunity_count,public_slug,source)
 values(v_user,v_wish,v_portfolio,v_shortlist,v_submission,v_action,
  v_count,v_opportunity_count,v_slug,'database_event');
 return null;
end $$;
revoke all on function private.record_work_receipt() from public,anon,authenticated;
create trigger record_saved_submission_draft
 after insert on public.submission_packages
 for each row execute function private.record_work_receipt();
