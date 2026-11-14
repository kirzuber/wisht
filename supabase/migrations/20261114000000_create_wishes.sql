create table if not exists public.wishes (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 aspiration text not null check(char_length(aspiration) between 2 and 280),
 kind text not null check(kind in ('photography','career','soccer','independence','finance','creative','personal','unsupported')),
 mission_id text not null,
 answer text not null,
 status text not null default 'PLANNED' check(status='PLANNED'),
 created_at timestamptz not null default now()
);
create index if not exists wishes_user_created_idx on public.wishes(user_id,created_at desc);
alter table public.wishes enable row level security;
create policy "owner reads wishes" on public.wishes for select to authenticated using ((select auth.uid())=user_id);
create policy "owner adds wishes" on public.wishes for insert to authenticated with check ((select auth.uid())=user_id);
create policy "owner deletes wishes" on public.wishes for delete to authenticated using ((select auth.uid())=user_id);
grant select,insert,delete on public.wishes to authenticated;
revoke all on public.wishes from anon;
