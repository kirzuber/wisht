-- JINN-F02-001: one private Jinn per verified person and a generic first-deed
-- payload on the existing wish record. Existing vertical wish rows remain valid.
create table public.jinns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'Jinn' check (char_length(name) between 1 and 60),
  created_at timestamptz not null default now(),
  unique (id, user_id)
);
alter table public.jinns enable row level security;
revoke all on public.jinns from public, anon, authenticated;
grant select, insert on public.jinns to authenticated;
create policy "verified owner reads Jinn" on public.jinns for select to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
create policy "verified owner creates Jinn" on public.jinns for insert to authenticated
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);

alter table public.wishes
  add column jinn_id uuid,
  add column first_artifact jsonb,
  add column first_deed jsonb,
  add column deed_history jsonb not null default '[]'::jsonb,
  add column updated_at timestamptz not null default now(),
  add column revision integer not null default 1;
alter table public.wishes
  add constraint wish_jinn_owned foreign key (jinn_id, user_id) references public.jinns(id, user_id),
  add constraint first_artifact_object check (first_artifact is null or jsonb_typeof(first_artifact) = 'object'),
  add constraint first_deed_prepared check (first_deed is null or
    (jsonb_typeof(first_deed) = 'object' and first_deed->>'status' = 'PREPARED')),
  add constraint deed_history_array check (jsonb_typeof(deed_history) = 'array' and jsonb_array_length(deed_history) <= 20
    and not jsonb_path_exists(deed_history, '$[*] ? (@.status != "PREPARED")')),
  add constraint wish_revision_positive check (revision > 0);
create policy "verified owner updates first wish work" on public.wishes for update to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false)
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
grant update (first_artifact, first_deed, deed_history, updated_at, revision) on public.wishes to authenticated;
