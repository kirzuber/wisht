-- JINN-003.1 — Durable, database-origin Work Receipts.
-- These entries attest to database events only, not independent site reachability.
-- End users can SELECT their own receipts, but cannot INSERT/UPDATE/DELETE them.
-- All trigger functions are private, security definer and schema-qualified.

create table public.work_receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  wish_id uuid not null references public.wishes(id) on delete cascade,
  portfolio_id uuid not null,
  action text not null check (
    action in ('PRIVATE_GALLERY_CREATED','PUBLIC_LISTING_CREATED','PUBLIC_LISTING_REMOVED')
  ),
  photo_count integer not null check (photo_count between 0 and 15),
  public_slug text check(public_slug is null or public_slug ~ '^[a-f0-9]{16}$'),
  source text not null check(source in ('database_event','existing_record_backfill')),
  recorded_at timestamptz not null default now()
);
create index work_receipts_by_owner on public.work_receipts(user_id,recorded_at desc);
create index work_receipts_by_wish on public.work_receipts(wish_id,recorded_at desc);
create index work_receipts_by_portfolio on public.work_receipts(portfolio_id,recorded_at desc);

alter table public.work_receipts enable row level security;
revoke all on public.work_receipts from public,anon,authenticated;
grant select on public.work_receipts to authenticated;
create policy "verified owner sees only their receipts" on public.work_receipts
  for select to authenticated
  using (
    (select auth.uid())=user_id
    and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true) is false
  );

create or replace function private.record_work_receipt()
returns trigger
language plpgsql security definer
set search_path=''
as $$
declare
  v_user uuid;
  v_wish uuid;
  v_portfolio uuid;
  v_action text;
  v_count integer;
  v_slug text;
begin
  if TG_TABLE_NAME = 'portfolios' and TG_OP = 'INSERT' then
    v_user := new.user_id;
    v_wish := new.wish_id;
    v_portfolio := new.id;
    v_action := 'PRIVATE_GALLERY_CREATED';
    v_count := pg_catalog.jsonb_array_length(new.photos);
    v_slug := null;
  elsif TG_TABLE_NAME = 'portfolio_publications' and TG_OP in ('INSERT','DELETE') then
    v_user := case when TG_OP='INSERT' then new.user_id else old.user_id end;
    v_portfolio := case when TG_OP='INSERT' then new.portfolio_id else old.portfolio_id end;
    v_action := case when TG_OP='INSERT' then 'PUBLIC_LISTING_CREATED' else 'PUBLIC_LISTING_REMOVED' end;
    v_count := case when TG_OP='INSERT' then pg_catalog.jsonb_array_length(new.photos)
                    else pg_catalog.jsonb_array_length(old.photos) end;
    v_slug := case when TG_OP='INSERT' then new.slug else old.slug end;
    select p.wish_id into v_wish
      from public.portfolios p
      where p.id=v_portfolio and p.user_id=v_user;
    if v_wish is null then
      raise exception 'RECEIPT_PARENT_NOT_FOUND' using errcode='P0001';
    end if;
  else
    raise exception 'UNSUPPORTED_RECEIPT_EVENT';
  end if;

  insert into public.work_receipts
    (user_id,wish_id,portfolio_id,action,photo_count,public_slug,source)
  values (v_user,v_wish,v_portfolio,v_action,v_count,v_slug,'database_event');
  return null;
end $$;

revoke all on function private.record_work_receipt() from public,anon,authenticated;
create trigger record_created_private_gallery
  after insert on public.portfolios
  for each row execute function private.record_work_receipt();
create trigger record_created_public_listing
  after insert on public.portfolio_publications
  for each row execute function private.record_work_receipt();
create trigger record_removed_public_listing
  after delete on public.portfolio_publications
  for each row execute function private.record_work_receipt();

-- Preserve truthful evidence for previously existing rows.
-- Reconstructed receipts never imply an independent external URL check.
insert into public.work_receipts
  (user_id,wish_id,portfolio_id,action,photo_count,source,recorded_at)
select p.user_id,p.wish_id,p.id,'PRIVATE_GALLERY_CREATED',
  pg_catalog.jsonb_array_length(p.photos),'existing_record_backfill',p.created_at
from public.portfolios p;

insert into public.work_receipts
  (user_id,wish_id,portfolio_id,action,photo_count,public_slug,source,recorded_at)
select pub.user_id,p.wish_id,pub.portfolio_id,'PUBLIC_LISTING_CREATED',
  pg_catalog.jsonb_array_length(pub.photos),pub.slug,'existing_record_backfill',
  pub.published_at
from public.portfolio_publications pub
join public.portfolios p on p.id=pub.portfolio_id and p.user_id=pub.user_id;
