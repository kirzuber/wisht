-- JINN-002.2 — Explicit public snapshot, never expose the owner's private draft.
-- Only selected optimized WebP copies become public. Unselected files remain private.
create table public.portfolio_publications (
  portfolio_id uuid primary key references public.portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-f0-9]{16}$'),
  title text not null check (char_length(title) between 1 and 100),
  introduction text not null default '' check (char_length(introduction) <= 600),
  photos jsonb not null check (jsonb_typeof(photos) = 'array' and jsonb_array_length(photos) between 1 and 8),
  published_at timestamptz not null default now()
);
create index portfolio_publications_by_owner on public.portfolio_publications(user_id);
alter table public.portfolio_publications enable row level security;

-- Publicly readable snapshot, deliberately separate from private portfolios.
create policy "anyone can view a published gallery" on public.portfolio_publications
for select to anon, authenticated using (true);

create policy "verified owner may publish owned draft" on public.portfolio_publications
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean),true) is false
  and exists (
    select 1 from public.portfolios private_draft
    where private_draft.id = portfolio_id and private_draft.user_id = (select auth.uid())
  )
);

create policy "verified owner may unpublish" on public.portfolio_publications
for delete to authenticated
using (
  (select auth.uid()) = user_id
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean),true) is false
);

-- A client can read only public snapshot fields, never its owner's UUID.
revoke all on public.portfolio_publications from anon, authenticated;
grant select (portfolio_id, slug, title, introduction, photos, published_at)
on public.portfolio_publications to anon, authenticated;
grant insert (portfolio_id, user_id, slug, title, introduction, photos)
on public.portfolio_publications to authenticated;
grant delete on public.portfolio_publications to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('portfolio-public','portfolio-public',true,6291456,array['image/webp']::text[])
on conflict(id) do nothing;

create policy "verified owner uploads approved public images" on storage.objects
for insert to authenticated
with check(
  bucket_id='portfolio-public'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and storage.extension(name)='webp'
  and coalesce((select (auth.jwt() ->> 'is_anonymous')::boolean),true) is false
  and exists(
    select 1 from public.portfolios draft
    where draft.id::text=(storage.foldername(name))[2]
    and draft.user_id=(select auth.uid())
  )
);
create policy "owner may inspect own public images" on storage.objects
for select to authenticated
using (
  bucket_id='portfolio-public'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and owner_id=(select auth.uid())::text
);
create policy "owner may remove published images" on storage.objects
for delete to authenticated
using(
  bucket_id='portfolio-public'
  and (storage.foldername(name))[1]=(select auth.uid())::text
  and owner_id=(select auth.uid())::text
);

-- Prevent bypassing the UI to delete a private draft while its public copies
-- still exist. The UI first removes public assets and publication, then draft.
create or replace function private.require_unpublish_before_private_delete()
returns trigger language plpgsql security invoker set search_path=''
as $$
begin
  if exists(select 1 from public.portfolio_publications pub where pub.portfolio_id=old.id) then
    raise exception 'UNPUBLISH_BEFORE_DELETE'
      using errcode='P0001',
      detail='Remove public image copies and publication before deleting the draft.';
  end if;
  return old;
end $$;
revoke all on function private.require_unpublish_before_private_delete() from public;
create trigger require_unpublish_before_private_delete
before delete on public.portfolios
for each row execute function private.require_unpublish_before_private_delete();
