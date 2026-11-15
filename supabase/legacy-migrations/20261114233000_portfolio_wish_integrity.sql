-- JINN-002.3. Each portfolio belongs to exactly one photography wish,
-- and the wish must belong to the SAME user. No existing portfolio ID, image
-- path, public slug, or published snapshot changes in this migration.
--
-- Compatibility: older deployed clients that omit wish_id are handled by the
-- INSERT trigger, so schema can be applied before the new frontend is merged.

alter table public.portfolios add column wish_id uuid;

-- Preserve every legacy portfolio. For each owner with a gallery but without
-- a photography wish, establish ONE root wish. This includes inaccessible
-- legacy anonymous test accounts; cleanup of those accounts is separate.
insert into public.wishes (user_id,aspiration,kind,mission_id,answer,status)
select owners.user_id,
       'I want to build my photography portfolio',
       'photography',
       'build-portfolio',
       'existing-gallery',
       'PLANNED'
from (select distinct user_id from public.portfolios) owners
where not exists (
  select 1 from public.wishes w
  where w.user_id=owners.user_id and w.kind='photography'
);

-- A photography wish may have many portfolios. Never attach a gallery to
-- an unrelated goal such as soccer.
update public.portfolios p set wish_id=(
  select w.id from public.wishes w
  where w.user_id=p.user_id and w.kind='photography'
  order by w.created_at,w.id limit 1
)
where p.wish_id is null;

do $verify$
begin
  if exists(select 1 from public.portfolios where wish_id is null) then
    raise exception 'UNLINKED_LEGACY_PORTFOLIO';
  end if;
end $verify$;

alter table public.wishes add constraint wishes_id_user_unique unique(id,user_id);
alter table public.portfolios
  add constraint portfolios_wish_owner_fk
  foreign key (wish_id,user_id)
  references public.wishes(id,user_id)
  on delete restrict;
alter table public.portfolios alter column wish_id set not null;
create index portfolios_by_wish on public.portfolios(wish_id,created_at desc);

create or replace function private.require_photography_wish()
returns trigger
language plpgsql security invoker set search_path=''
as $$
declare
  linked_kind text;
begin
  -- Compatibility for the previous UI, which omitted wish_id. Only create a
  -- root if the verified user has none. Normal new UI supplies wish_id.
  if new.wish_id is null then
    select w.id into new.wish_id
    from public.wishes w
    where w.user_id=new.user_id and w.kind='photography'
    order by w.created_at,w.id limit 1;

    if new.wish_id is null then
      insert into public.wishes(user_id,aspiration,kind,mission_id,answer,status)
      values(new.user_id,'I want to build my photography portfolio',
             'photography','build-portfolio','portfolio-creation','PLANNED')
      returning id into new.wish_id;
    end if;
  end if;

  select kind into linked_kind
  from public.wishes
  where id=new.wish_id and user_id=new.user_id;
  if linked_kind is distinct from 'photography' then
    raise exception 'PORTFOLIO_REQUIRES_PHOTOGRAPHY_WISH'
      using errcode='P0001',
      detail='Portfolio and its parent photography wish must have the same owner.';
  end if;
  return new;
end $$;

revoke all on function private.require_photography_wish() from public;
create trigger require_photography_wish
before insert or update of wish_id,user_id on public.portfolios
for each row execute function private.require_photography_wish();
