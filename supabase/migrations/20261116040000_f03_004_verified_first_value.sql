-- JINN-F03-004: additive, server-only first-value save.
-- Supabase service_role key must remain in API/Netlify environment, NEVER the browser.
-- Apply in hosted Supabase only after Kirill separately authorizes the release.
-- Existing data and F03-002 follow-up RPCs are preserved.
create function public.create_verified_first_value(
  p_user_id uuid, p_jinn_id uuid, p_intent text, p_artifact jsonb, p_receipt jsonb)
returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_wish uuid; v_deed uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'Only the verified server may record a First-Value receipt.';
  end if;
  if not exists (select 1 from auth.users where id=p_user_id and email_confirmed_at is not null and is_anonymous is not true) then
    raise exception 'Verified account is required.';
  end if;
  if not exists (select 1 from public.jinns where id=p_jinn_id and user_id=p_user_id) then
    raise exception 'Selected Jinn is not owned by this account.';
  end if;
  if p_intent is null or char_length(p_intent) not between 2 and 280
      or jsonb_typeof(p_artifact)<>'object'
      or not (p_artifact ?& array['title','sourceNote','sections','unknowns','nextDeed','boundary','experience'])
      or p_artifact->'experience'->>'version'<>'1'
      or jsonb_typeof(p_artifact->'sections')<>'array'
      or jsonb_typeof(p_artifact->'unknowns')<>'array'
      or p_receipt->>'status'<>'PREPARED'
      or p_receipt->>'scope' is null then
    raise exception 'Invalid verified First-Value payload.';
  end if;
  insert into public.wish_records(user_id,primary_jinn_id,title,original_intent,state,wish_context)
    values(p_user_id,p_jinn_id,left(p_intent,100),p_intent,'active',
      jsonb_build_object('sourceNote',coalesce(p_artifact->>'sourceNote','')))
    returning id into v_wish;
  insert into public.deeds(wish_id,user_id,operation,input,receipt,status)
    values(v_wish,p_user_id,'AI_FIRST_DRAFT',
      jsonb_build_object('original_intent',p_intent,'source_note',coalesce(p_artifact->>'sourceNote','')),
      p_receipt,'PREPARED')
    returning id into v_deed;
  insert into public.artifacts(wish_id,user_id,origin_deed_id,component_type,content)
    values(v_wish,p_user_id,v_deed,'structured_draft',p_artifact);
  return v_wish;
end $$;

revoke all on function public.create_verified_first_value(uuid,uuid,text,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.create_verified_first_value(uuid,uuid,text,jsonb,jsonb) to service_role;
-- Earlier migrations intentionally revoked table rights from browser roles.
-- Service-only writes still need explicit DML grants in local/hosted projects;
-- BYPASSRLS alone does not grant INSERT or SELECT.
grant usage on schema public to service_role;
grant select on public.jinns to service_role;
grant insert on public.wish_records, public.deeds, public.artifacts to service_role;


-- Close the old client-controlled initial receipt path. Existing saved data
-- stays intact, and corrections/follow-ups continue through their own RPCs.
revoke execute on function public.create_wish_with_deed(uuid,text,jsonb,jsonb) from authenticated;
