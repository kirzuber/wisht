-- JINN-002.1: one private draft table and one private image bucket.
-- Optimized WebP previews only. Original files stay on the user's device.
create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'My photography' check (char_length(title) between 1 and 100),
  introduction text not null default '' check (char_length(introduction) <= 600),
  photos jsonb not null default '[]'::jsonb check (jsonb_typeof(photos) = 'array'),
  status text not null default 'PRIVATE' check (status = 'PRIVATE'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index portfolios_by_owner on public.portfolios (user_id, created_at desc);
alter table public.portfolios enable row level security;
create policy "portfolio owner read" on public.portfolios for select to authenticated using ((select auth.uid()) = user_id);
create policy "portfolio owner create" on public.portfolios for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "portfolio owner edit" on public.portfolios for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "portfolio owner delete" on public.portfolios for delete to authenticated using ((select auth.uid()) = user_id);
grant select, insert, update, delete on public.portfolios to authenticated;
revoke all on public.portfolios from anon;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('portfolio-previews','portfolio-previews',false,6291456,array['image/webp']::text[])
on conflict (id) do nothing;

-- Never use a public bucket. Storage paths are owner UUID / portfolio UUID / asset UUID.webp.
create policy "portfolio images owner upload" on storage.objects for insert to authenticated
with check (bucket_id = 'portfolio-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.extension(name) = 'webp');
create policy "portfolio images owner read" on storage.objects for select to authenticated
using (bucket_id = 'portfolio-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text);
create policy "portfolio images owner delete" on storage.objects for delete to authenticated
using (bucket_id = 'portfolio-previews'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and owner_id = (select auth.uid())::text);
