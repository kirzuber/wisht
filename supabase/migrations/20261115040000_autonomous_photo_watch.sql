-- JINN-003.4: opt-in, bounded photography watches; no default/background
-- work is started for existing users. The browser can own and control a watch,
-- but cannot create run evidence or invoke the privileged claim function.

create table public.photo_watches(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 wish_id uuid not null,
 genre text not null check(genre in ('any','nature','portrait','open')),
 free_only boolean not null default true,
 status text not null default 'active'
  check(status in ('active','paused','cancelled','completed')),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days',
 next_check_at timestamptz not null default now(),
 check_count int not null default 0 check(check_count between 0 and 7),
 last_check_at timestamptz,
 last_error text not null default '' check(length(last_error)<=280),
 constraint watch_owner_wish_fk foreign key(wish_id,user_id)
 references public.wishes(id,user_id) on delete cascade,
 constraint watch_time_limit check(expires_at<=created_at+interval '7 days 5 minutes')
);
create unique index one_open_watch_per_wish on public.photo_watches(wish_id)
 where status in ('active','paused');
create index due_photo_watches on public.photo_watches(next_check_at)
 where status='active';
alter table public.photo_watches enable row level security;
revoke all on public.photo_watches from anon,authenticated,public;
grant select,delete to authenticated;
grant insert(user_id,wish_id,genre,free_only) to authenticated;
grant update(status) on public.photo_watches to authenticated;
create policy "verified owner reads watches" on public.photo_watches
 for select to authenticated using (
  (select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false
 );
create policy "verified owner starts watches" on public.photo_watches
 for insert to authenticated with check (
  (select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false
 );
create policy "verified owner controls watches" on public.photo_watches
 for update to authenticated
 using ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false)
 with check ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);
create policy "verified owner deletes watch history" on public.photo_watches
 for delete to authenticated
 using ((select auth.uid())=user_id
  and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);

create or replace function private.validate_photo_watch()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare goal_kind text;
begin
 if tg_op='INSERT' then
  select w.kind into goal_kind from public.wishes w
   where w.id=new.wish_id and w.user_id=new.user_id;
  if goal_kind is distinct from 'photography' then
   raise exception 'WATCH_REQUIRES_PHOTOGRAPHY_WISH' using errcode='P0001';
  end if;
  if new.status<>'active' or new.check_count<>0 then
   raise exception 'WATCH_MUST_START_ACTIVE' using errcode='P0001';
  end if;
 else
  if (new.id,new.user_id,new.wish_id,new.genre,new.free_only,new.created_at,
      new.expires_at,new.check_count,new.next_check_at,new.last_check_at,new.last_error)
    is distinct from
     (old.id,old.user_id,old.wish_id,old.genre,old.free_only,old.created_at,
      old.expires_at,old.check_count,old.next_check_at,old.last_check_at,old.last_error) then
   -- Service-role system updates can modify counters, but client update
   -- grants only allow the status column; do not require counters immutable
   -- for trusted scheduler. This trigger fires only on status updates.
   if (new.id,new.user_id,new.wish_id,new.genre,new.free_only,new.created_at,new.expires_at)
      is distinct from
      (old.id,old.user_id,old.wish_id,old.genre,old.free_only,old.created_at,old.expires_at)
   then raise exception 'WATCH_IDENTITY_IMMUTABLE' using errcode='P0001';end if;
  end if;
  if old.status in ('cancelled','completed') and new.status<>old.status then
    raise exception 'WATCH_ALREADY_ENDED' using errcode='P0001';
  end if;
  if old.status='paused' and new.status='active' then
    if new.check_count>=7 or new.expires_at<=now() then
      raise exception 'WATCH_EXPIRED' using errcode='P0001';
    end if;
    new.next_check_at:=now();
  end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_photo_watch() from public,anon,authenticated;
create trigger validate_photo_watch
 before insert or update of status on public.photo_watches
 for each row execute function private.validate_photo_watch();

create table public.photo_watch_runs(
 id uuid primary key default gen_random_uuid(),
 watch_id uuid not null references public.photo_watches(id) on delete cascade,
 user_id uuid not null,
 wish_id uuid not null,
 checked_at timestamptz not null default now(),
 checked_day date not null default (now() at time zone 'UTC')::date,
 state text not null check(state in ('succeeded','failed')),
 matches jsonb not null default '[]'::jsonb
   check(jsonb_typeof(matches)='array' and jsonb_array_length(matches)<=5),
 new_matches jsonb not null default '[]'::jsonb
   check(jsonb_typeof(new_matches)='array' and jsonb_array_length(new_matches)<=5),
 error_message text not null default '' check(length(error_message)<=280),
 constraint watch_run_same_owner_fk foreign key (wish_id,user_id)
  references public.wishes(id,user_id) on delete cascade,
 constraint watch_run_unique_day unique(watch_id,checked_day)
);
create index photo_watch_runs_owner on public.photo_watch_runs(user_id,checked_at desc);
alter table public.photo_watch_runs enable row level security;
revoke all on public.photo_watch_runs from anon,authenticated,public;
grant select on public.photo_watch_runs to authenticated;
create policy "verified owner reads watch runs" on public.photo_watch_runs
 for select to authenticated
 using((select auth.uid())=user_id
 and coalesce((select (auth.jwt()->>'is_anonymous')::boolean),true)=false);

create or replace function private.validate_photo_watch_run()
returns trigger language plpgsql security invoker set search_path=''
as $$
declare linked record;
begin
 select user_id,wish_id into linked from public.photo_watches
  where id=new.watch_id;
 if linked.user_id is distinct from new.user_id or linked.wish_id is distinct from new.wish_id then
  raise exception 'WATCH_RUN_OWNER_MISMATCH' using errcode='P0001';
 end if;
 if new.state='failed' and (jsonb_array_length(new.matches)>0 or jsonb_array_length(new.new_matches)>0) then
  raise exception 'FAILED_WATCH_CANNOT_REPORT_RESULTS' using errcode='P0001';
 end if;
 if new.state='succeeded' and new.error_message<>'' then
  raise exception 'SUCCESS_CANNOT_REPORT_ERROR' using errcode='P0001';
 end if;
 return new;
end $$;
revoke all on function private.validate_photo_watch_run() from public,anon,authenticated;
create trigger validate_photo_watch_run before insert on public.photo_watch_runs
 for each row execute function private.validate_photo_watch_run();

-- Server-only claim: reserve due watches atomically before any network call.
-- This bounds each watch to <=7 attempts total, never more than one per day.
create or replace function public.claim_due_photo_watches(p_limit integer default 8)
returns setof public.photo_watches
language plpgsql security invoker set search_path=''
as $$
begin
 if p_limit<1 or p_limit>8 then
  raise exception 'WATCH_BATCH_LIMIT' using errcode='P0001';
 end if;
 update public.photo_watches set status='completed'
  where status='active' and (expires_at<=now() or check_count>=7);
 return query
 with claim as (
   select id from public.photo_watches
    where status='active' and next_check_at<=now()
     and expires_at>now() and check_count<7
     and not exists(
       select 1 from public.photo_watch_runs r
       where r.watch_id=public.photo_watches.id
       and r.checked_day=(now() at time zone 'UTC')::date
     )
    order by next_check_at,id
    limit p_limit for update skip locked
 )
 update public.photo_watches p
  set check_count=p.check_count+1,
   next_check_at=now()+interval '24 hours'
  from claim c where p.id=c.id
  returning p.*;
end $$;
revoke all on function public.claim_due_photo_watches(integer) from public,anon,authenticated;
grant execute on function public.claim_due_photo_watches(integer) to service_role;

-- Server/DB evidence, never client generated, for completed database-side runs.
alter table public.work_receipts add column watch_run_id uuid
 references public.photo_watch_runs(id) on delete set null;
alter table public.work_receipts drop constraint work_receipts_action_check;
alter table public.work_receipts add constraint work_receipts_action_check
 check(action in ('PRIVATE_GALLERY_CREATED','PUBLIC_LISTING_CREATED','PUBLIC_LISTING_REMOVED',
  'OPPORTUNITY_SHORTLIST_SAVED','SUBMISSION_DRAFT_SAVED','WATCH_CHECK_COMPLETED'));

create or replace function private.record_work_receipt()
returns trigger language plpgsql security definer set search_path=''
as $$
declare
 v_user uuid;v_wish uuid;v_portfolio uuid;v_action text;
 v_count integer:=0;v_slug text;v_shortlist uuid;
 v_opportunity_count integer:=0;v_submission uuid;v_watch_run uuid;
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
 elsif TG_TABLE_NAME='photo_watch_runs' and TG_OP='INSERT' and new.state='succeeded' then
  v_user:=new.user_id;v_wish:=new.wish_id;v_watch_run:=new.id;
  v_action:='WATCH_CHECK_COMPLETED';
  v_opportunity_count:=pg_catalog.jsonb_array_length(new.new_matches);
 else
  return null;
 end if;
 insert into public.work_receipts
  (user_id,wish_id,portfolio_id,shortlist_id,submission_id,watch_run_id,action,
   photo_count,opportunity_count,public_slug,source)
 values(v_user,v_wish,v_portfolio,v_shortlist,v_submission,v_watch_run,v_action,
  v_count,v_opportunity_count,v_slug,'database_event');
 return null;
end $$;
revoke all on function private.record_work_receipt() from public,anon,authenticated;
create trigger record_completed_photo_watch
 after insert on public.photo_watch_runs
 for each row execute function private.record_work_receipt();
