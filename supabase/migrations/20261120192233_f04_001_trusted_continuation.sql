-- F04-001: Wish-local confirmed context and server-verified, independent work.
-- Additive only. Hosted application requires separate approval and Issue #27 reconciliation.
alter table public.deeds add column request_key uuid;
alter table public.deeds add column verified_followup boolean not null default false;
alter table public.deeds add column verified_first boolean not null default false;
alter table public.deeds add column actor_jinn_id uuid;
alter table public.deeds add column actor_jinn_name text;
create unique index deeds_owner_request_key on public.deeds(user_id, request_key) where request_key is not null;

create function public.guard_wish_context_revision() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare v_old integer; v_new integer;
begin
  if new.wish_context is distinct from old.wish_context then
    v_old:=coalesce((old.wish_context->>'revision')::integer,0);
    v_new:=coalesce((new.wish_context->>'revision')::integer,0);
    if v_new<>v_old+1 or char_length(coalesce(new.wish_context->>'sourceNote',''))>500
      or jsonb_typeof(coalesce(new.wish_context->'confirmedFacts','[]'::jsonb))<>'array'
      or jsonb_array_length(coalesce(new.wish_context->'confirmedFacts','[]'::jsonb))>6
      or jsonb_typeof(coalesce(new.wish_context->'unknowns','[]'::jsonb))<>'array'
      or jsonb_array_length(coalesce(new.wish_context->'unknowns','[]'::jsonb))>6 then
      raise exception 'Invalid Wish context revision.';
    end if;
    if exists(select 1 from jsonb_array_elements(
      coalesce(new.wish_context->'confirmedFacts','[]'::jsonb) ||
      coalesce(new.wish_context->'unknowns','[]'::jsonb)) value
      where jsonb_typeof(value)<>'string' or char_length(value #>> '{}') not between 1 and 180) then
      raise exception 'Invalid Wish context detail.';
    end if;
  end if;
  return new;
end $$;
create trigger guard_wish_context_revision before update on public.wish_records
  for each row execute function public.guard_wish_context_revision();

create function public.guard_verified_followup() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and (old.verified_followup, old.request_key, old.actor_jinn_id, old.actor_jinn_name)
    is distinct from (new.verified_followup, new.request_key, new.actor_jinn_id, new.actor_jinn_name) then
    raise exception 'Verified Deed attribution is immutable.';
  end if;
  if tg_op = 'UPDATE' and old.verified_first is distinct from new.verified_first then
    raise exception 'Verified First Deed marker is immutable.';
  end if;
  if tg_op = 'INSERT' and current_user = 'service_role' and new.operation = 'AI_FIRST_DRAFT' then
    new.verified_first := true;
  end if;
  if tg_op = 'INSERT' and (new.verified_followup or new.verified_first or new.request_key is not null
      or new.actor_jinn_id is not null or new.actor_jinn_name is not null)
      and current_user <> 'service_role' then
    raise exception 'Only the verified server may issue a continuation.';
  end if;
  return new;
end $$;
create trigger guard_verified_followup before insert or update on public.deeds
  for each row execute function public.guard_verified_followup();

create function public.guard_artifact_correction() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if current_setting('wisht.artifact_correction',true) is distinct from '1'
    or new.origin_deed_id is distinct from old.origin_deed_id
    or new.wish_id is distinct from old.wish_id or new.user_id is distinct from old.user_id
    or new.version<>old.version+1 then
    raise exception 'Artifact corrections must use the versioned owner RPC.';
  end if;
  return new;
end $$;
create trigger guard_artifact_correction before update on public.artifacts
  for each row execute function public.guard_artifact_correction();

-- Ordinary corrections may edit any Artifact, but only an explicit source-note
-- change updates approved context. Preserve every other context key.
create or replace function public.correct_artifact(p_artifact_id uuid, p_expected_version integer, p_content jsonb)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_wish uuid; v_version integer; v_previous jsonb;
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true)
    or jsonb_typeof(p_content) <> 'object'
    or jsonb_typeof(p_content->'sourceNote')<>'string'
    or char_length(p_content->>'sourceNote')>500 then
    raise exception 'Invalid artifact correction.';
  end if;
  select wish_id into v_wish from public.artifacts where id=p_artifact_id and user_id=v_user;
  if v_wish is null then raise exception 'This artifact changed in another session or is unavailable.' using errcode='40001'; end if;
  perform 1 from public.wish_records where id=v_wish and user_id=v_user for update;
  select content into v_previous from public.artifacts
    where id=p_artifact_id and user_id=v_user and version=p_expected_version for update;
  if v_previous is null then raise exception 'This artifact changed in another session or is unavailable.' using errcode='40001'; end if;
  if p_content->>'sourceNote' is distinct from v_previous->>'sourceNote' then
    update public.wish_records set wish_context = wish_context || jsonb_build_object(
      'sourceNote',coalesce(p_content->>'sourceNote',''),
      'sourceNoteConfirmed',true,
      'revision',coalesce((wish_context->>'revision')::integer,0)+1,
      'lastCorrection',jsonb_build_object('artifactId',p_artifact_id,'at',now())), updated_at=now()
      where id=v_wish and user_id=v_user;
  end if;
  perform set_config('wisht.artifact_correction','1',true);
  update public.artifacts set content=p_content, version=version+1, updated_at=now()
    where id=p_artifact_id and user_id=v_user and version=p_expected_version returning version into v_version;
  return v_version;
end $$;

create function public.set_trusted_wish_context(p_wish_id uuid, p_expected_revision integer,
  p_facts jsonb, p_unknowns jsonb, p_confirm_source boolean)
returns integer language plpgsql security invoker set search_path = '' as $$
declare v_user uuid := auth.uid(); v_context jsonb; v_revision integer;
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true)
    or jsonb_typeof(p_facts)<>'array' or jsonb_array_length(p_facts)>6
    or jsonb_typeof(p_unknowns)<>'array' or jsonb_array_length(p_unknowns)>6
    or exists(select 1 from jsonb_array_elements(p_facts || p_unknowns) value
      where jsonb_typeof(value)<>'string' or char_length(value #>> '{}') not between 1 and 180) then
    raise exception 'Invalid confirmed context.';
  end if;
  select wish_context into v_context from public.wish_records
    where id=p_wish_id and user_id=v_user for update;
  if v_context is null then raise exception 'Wish unavailable.' using errcode='42501'; end if;
  v_revision:=coalesce((v_context->>'revision')::integer,0);
  if v_revision<>p_expected_revision then raise exception 'Wish context changed in another session.' using errcode='40001'; end if;
  update public.wish_records set wish_context=v_context || jsonb_build_object(
      'confirmedFacts',p_facts,'unknowns',p_unknowns,'sourceNoteConfirmed',p_confirm_source is true,
      'revision',v_revision+1,
      'lastCorrection',jsonb_build_object('at',now())),updated_at=now()
    where id=p_wish_id and user_id=v_user;
  return v_revision+1;
end $$;
revoke all on function public.set_trusted_wish_context(uuid,integer,jsonb,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.set_trusted_wish_context(uuid,integer,jsonb,jsonb,boolean) to authenticated;

create function public.create_verified_continuation(
  p_user_id uuid,p_wish_id uuid,p_source_artifact_id uuid,p_source_version integer,
  p_context_revision integer,p_expected_actor_id uuid,p_latest_deed_id uuid,p_request_key uuid,
  p_artifact jsonb,p_draft_source text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_wish public.wish_records%rowtype; v_source public.artifacts%rowtype;
  v_existing public.deeds%rowtype; v_deed uuid; v_artifact uuid; v_actor_name text;
  v_latest uuid; v_receipt jsonb;
begin
  if current_user <> 'service_role' then raise exception 'Only the verified server may save a continuation.'; end if;
  if p_request_key is null or p_draft_source not in ('model','repaired_model')
    or jsonb_typeof(p_artifact)<>'object' or p_artifact->'experience'->>'version'<>'1'
    or not (p_artifact ?& array['title','sourceNote','sections','unknowns','nextDeed','boundary','experience']) then
    raise exception 'Invalid continuation payload.';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id and email_confirmed_at is not null and is_anonymous is not true) then
    raise exception 'Verified account is required.';
  end if;
  select * into v_wish from public.wish_records where id=p_wish_id and user_id=p_user_id for update;
  if not found then raise exception 'Wish unavailable.' using errcode='42501'; end if;
  select * into v_existing from public.deeds where user_id=p_user_id and request_key=p_request_key;
  if found then
    if v_existing.wish_id<>p_wish_id then raise exception 'Request key belongs to another Wish.'; end if;
    select id into v_artifact from public.artifacts where origin_deed_id=v_existing.id and wish_id=p_wish_id;
    return jsonb_build_object('deedId',v_existing.id,'artifactId',v_artifact,'receipt',v_existing.receipt,'replayed',true);
  end if;
  select * into v_source from public.artifacts where id=p_source_artifact_id
    and wish_id=p_wish_id and user_id=p_user_id for update;
  if not found or v_source.version<>p_source_version then
    raise exception 'Source Artifact changed. Review again.' using errcode='40001';
  end if;
  if coalesce((v_wish.wish_context->>'revision')::integer,0)<>p_context_revision
    or v_wish.primary_jinn_id is distinct from p_expected_actor_id
    or (coalesce(v_wish.wish_context->>'sourceNote','')<>''
      and v_wish.wish_context->>'sourceNoteConfirmed' is distinct from 'true')
    or p_artifact->>'sourceNote' is distinct from coalesce(v_wish.wish_context->>'sourceNote','') then
    raise exception 'Wish context changed. Review again.' using errcode='40001';
  end if;
  select id into v_latest from public.deeds where wish_id=p_wish_id and user_id=p_user_id
    order by created_at desc,id desc limit 1;
  if v_latest is distinct from p_latest_deed_id then
    raise exception 'A newer Deed exists. Review again.' using errcode='40001';
  end if;
  select name into v_actor_name from public.jinns where id=v_wish.primary_jinn_id and user_id=p_user_id;
  if v_actor_name is null then raise exception 'Assigned Jinn unavailable.' using errcode='40001'; end if;
  v_receipt:=jsonb_build_object('status','PREPARED','operation','AI prepared a private follow-up draft',
    'recordedAt',now(),'scope','Private draft only. Nothing sent or externally verified.',
    'draftSource',p_draft_source,'verified',true);
  insert into public.deeds(wish_id,user_id,operation,input,receipt,status,request_key,
    verified_followup,actor_jinn_id,actor_jinn_name)
    values(p_wish_id,p_user_id,'AI_FOLLOW_UP_DRAFT',jsonb_build_object(
      'source_artifact_id',p_source_artifact_id,'source_version',p_source_version,
      'context_revision',p_context_revision),v_receipt,'PREPARED',p_request_key,
      true,v_wish.primary_jinn_id,v_actor_name) returning id into v_deed;
  insert into public.artifacts(wish_id,user_id,origin_deed_id,component_type,content)
    values(p_wish_id,p_user_id,v_deed,'structured_draft',p_artifact) returning id into v_artifact;
  update public.wish_records set updated_at=now() where id=p_wish_id;
  return jsonb_build_object('deedId',v_deed,'artifactId',v_artifact,'receipt',v_receipt,'replayed',false);
end $$;
revoke all on function public.create_verified_continuation(uuid,uuid,uuid,integer,integer,uuid,uuid,uuid,jsonb,text)
  from public,anon,authenticated;
grant execute on function public.create_verified_continuation(uuid,uuid,uuid,integer,integer,uuid,uuid,uuid,jsonb,text) to service_role;
revoke execute on function public.append_prepared_deed(uuid,uuid,integer,jsonb,jsonb) from authenticated;
grant update (updated_at) on public.wish_records to service_role;
grant update (content) on public.artifacts to service_role;
grant update (content,version,updated_at) on public.artifacts to authenticated;
