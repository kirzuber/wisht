-- JINN-F03-001 fresh-environment baseline. Never apply this to an existing
-- legacy project with `db push`; its separate, approval-gated cutover is in
-- supabase/cutover/. Historical migrations are preserved unchanged in
-- supabase/legacy-migrations/.

create table public.jinns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Jinn' check (char_length(name) between 1 and 60),
  is_primary boolean not null default false,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);
create unique index jinns_one_primary_per_owner on public.jinns(user_id) where is_primary;
create index jinns_owner_created on public.jinns(user_id, created_at);

create table public.wishes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  primary_jinn_id uuid not null,
  title text not null check (char_length(title) between 2 and 100),
  original_intent text not null check (char_length(original_intent) between 2 and 280),
  state text not null default 'active' check (state in ('draft','active','paused','completed')),
  wish_context jsonb not null default '{}'::jsonb check (jsonb_typeof(wish_context) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint wishes_primary_jinn_owner foreign key (primary_jinn_id, user_id)
    references public.jinns(id, user_id) on delete restrict
);
create index wishes_owner_updated on public.wishes(user_id, updated_at desc);

create table public.deeds (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null,
  user_id uuid not null,
  operation text not null check (char_length(operation) between 2 and 80),
  input jsonb not null default '{}'::jsonb check (jsonb_typeof(input) = 'object'),
  receipt jsonb not null check (jsonb_typeof(receipt) = 'object'),
  status text not null check (status in ('PROPOSED','PREPARED','BLOCKED','AWAITING_APPROVAL','RUNNING','COMPLETED','FAILED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wish_id, user_id),
  constraint deeds_wish_owner foreign key (wish_id, user_id)
    references public.wishes(id, user_id) on delete cascade,
  constraint prepared_receipt_matches check (status <> 'PREPARED' or receipt->>'status' = 'PREPARED')
);
create index deeds_wish_history on public.deeds(wish_id, created_at, id);

create table public.artifacts (
  id uuid primary key default gen_random_uuid(),
  wish_id uuid not null,
  user_id uuid not null,
  origin_deed_id uuid,
  component_type text not null check (component_type = 'structured_draft'),
  content jsonb not null check (
    jsonb_typeof(content) = 'object'
    and content ?& array['title','sourceNote','sections','unknowns','nextDeed','boundary']
    and jsonb_typeof(content->'sections') = 'array'
    and jsonb_typeof(content->'unknowns') = 'array'
  ),
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, wish_id, user_id),
  constraint artifacts_wish_owner foreign key (wish_id, user_id)
    references public.wishes(id, user_id) on delete cascade,
  constraint artifacts_origin_owner foreign key (origin_deed_id, wish_id, user_id)
    references public.deeds(id, wish_id, user_id) on delete restrict
);
create index artifacts_wish_updated on public.artifacts(wish_id, updated_at desc);

alter table public.jinns enable row level security;
alter table public.wishes enable row level security;
alter table public.deeds enable row level security;
alter table public.artifacts enable row level security;
revoke all on public.jinns, public.wishes, public.deeds, public.artifacts from public, anon, authenticated;
grant select, insert on public.jinns to authenticated;
grant update (name, settings, updated_at) on public.jinns to authenticated;
grant select, insert, delete on public.wishes to authenticated;
grant update (title, state, wish_context, updated_at) on public.wishes to authenticated;
grant select, insert on public.deeds to authenticated;
grant select, insert on public.artifacts to authenticated;
grant update (content, origin_deed_id, version, updated_at) on public.artifacts to authenticated;

create policy "owner reads jinns" on public.jinns for select to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
create policy "owner creates jinns" on public.jinns for insert to authenticated
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
create policy "owner updates jinns" on public.jinns for update to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false)
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);

create policy "owner reads wishes" on public.wishes for select to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
create policy "owner creates wishes" on public.wishes for insert to authenticated
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
create policy "owner updates wishes" on public.wishes for update to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false)
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
create policy "owner deletes wishes" on public.wishes for delete to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);

create policy "owner reads deeds" on public.deeds for select to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
create policy "owner records prepared deeds" on public.deeds for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'PREPARED'
    and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);

create policy "owner reads artifacts" on public.artifacts for select to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
create policy "owner creates artifacts" on public.artifacts for insert to authenticated
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);
create policy "owner updates artifacts" on public.artifacts for update to authenticated
  using ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false)
  with check ((select auth.uid()) = user_id and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false);

-- SECURITY INVOKER RPCs use the caller's table grants and RLS. Each operation
-- is atomic; a failed deed or artifact write cannot leave a half-saved wish.
create function public.create_wish_with_deed(p_jinn_id uuid, p_intent text, p_artifact jsonb, p_receipt jsonb)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_wish uuid; v_deed uuid;
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then
    raise exception 'Verify your email to save your work.';
  end if;
  if p_intent is null or char_length(p_intent) not between 2 and 280
    or jsonb_typeof(p_artifact) <> 'object' or p_receipt->>'status' <> 'PREPARED' then
    raise exception 'Invalid first Deed payload.';
  end if;
  insert into public.wishes(user_id, primary_jinn_id, title, original_intent, state, wish_context)
    values(v_user, p_jinn_id, left(p_intent, 100), p_intent, 'active',
      jsonb_build_object('sourceNote', coalesce(p_artifact->>'sourceNote','')))
    returning id into v_wish;
  insert into public.deeds(wish_id, user_id, operation, input, receipt, status)
    values(v_wish, v_user, 'AI_FIRST_DRAFT',
      jsonb_build_object('original_intent', p_intent, 'source_note', coalesce(p_artifact->>'sourceNote','')),
      p_receipt, 'PREPARED') returning id into v_deed;
  insert into public.artifacts(wish_id, user_id, origin_deed_id, component_type, content)
    values(v_wish, v_user, v_deed, 'structured_draft', p_artifact);
  return v_wish;
end $$;

create function public.correct_artifact(p_artifact_id uuid, p_expected_version integer, p_content jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_wish uuid; v_version integer;
begin
  if v_user is null or jsonb_typeof(p_content) <> 'object' then
    raise exception 'Invalid artifact correction.';
  end if;
  update public.artifacts set content = p_content, version = version + 1, updated_at = now()
    where id = p_artifact_id and user_id = v_user and version = p_expected_version
    returning wish_id, version into v_wish, v_version;
  if v_wish is null then raise exception 'This artifact changed in another session or is unavailable.'; end if;
  update public.wishes set wish_context = jsonb_build_object('sourceNote', coalesce(p_content->>'sourceNote','')),
    updated_at = now() where id = v_wish and user_id = v_user;
  return v_version;
end $$;

create function public.append_prepared_deed(p_wish_id uuid, p_artifact_id uuid, p_expected_version integer,
  p_artifact jsonb, p_receipt jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_previous jsonb; v_deed uuid; v_version integer;
begin
  if v_user is null or jsonb_typeof(p_artifact) <> 'object' or p_receipt->>'status' <> 'PREPARED' then
    raise exception 'Invalid follow-up Deed payload.';
  end if;
  select content into v_previous from public.artifacts
    where id = p_artifact_id and wish_id = p_wish_id and user_id = v_user and version = p_expected_version
    for update;
  if v_previous is null then raise exception 'This artifact changed in another session or is unavailable.'; end if;
  if p_artifact->>'sourceNote' is distinct from v_previous->>'sourceNote' then
    raise exception 'The next Deed must use the saved source note.';
  end if;
  insert into public.deeds(wish_id, user_id, operation, input, receipt, status)
    values(p_wish_id, v_user, 'AI_FOLLOW_UP_DRAFT', jsonb_build_object('previous_artifact', v_previous),
      p_receipt, 'PREPARED') returning id into v_deed;
  update public.artifacts set content = p_artifact, origin_deed_id = v_deed, version = version + 1,
    updated_at = now() where id = p_artifact_id and user_id = v_user
    returning version into v_version;
  update public.wishes set updated_at = now() where id = p_wish_id and user_id = v_user;
  return v_version;
end $$;

revoke all on function public.create_wish_with_deed(uuid,text,jsonb,jsonb) from public, anon, authenticated;
revoke all on function public.correct_artifact(uuid,integer,jsonb) from public, anon, authenticated;
revoke all on function public.append_prepared_deed(uuid,uuid,integer,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_wish_with_deed(uuid,text,jsonb,jsonb) to authenticated;
grant execute on function public.correct_artifact(uuid,integer,jsonb) to authenticated;
grant execute on function public.append_prepared_deed(uuid,uuid,integer,jsonb,jsonb) to authenticated;
