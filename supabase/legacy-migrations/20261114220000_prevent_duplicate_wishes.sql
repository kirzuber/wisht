-- JINN-002.1: prevent two saved wishes describing the same root aspiration.
-- Preserves legacy duplicate rows; checks all NEW inserts.
-- The catalog `kind` groups well-scoped goals (soccer, photography, career,
-- independence, finance); unknown, playful and sensitive goals use exact text match.
-- Reuses the existing advisory transaction lock to serialize concurrent writes.
create or replace function private.enforce_three_saved_wishes()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  existing_count integer;
  normalized_new text;
  already_saved boolean;
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(new.user_id::text, 30927)
  );

  normalized_new := pg_catalog.regexp_replace(
    pg_catalog.lower(pg_catalog.btrim(new.aspiration)),
    '[^[:alnum:]]+', '', 'g'
  );
  select exists (
    select 1 from public.wishes w
    where w.user_id = new.user_id
      and (
        pg_catalog.regexp_replace(
          pg_catalog.lower(pg_catalog.btrim(w.aspiration)),
          '[^[:alnum:]]+', '', 'g'
        ) = normalized_new
        or (
          new.kind in ('soccer','photography','career','independence','finance')
          and w.kind = new.kind
        )
      )
  ) into already_saved;

  if already_saved then
    raise exception 'WISH_ALREADY_EXISTS' using
      errcode = 'P0001',
      detail = 'This aspiration is already saved; use its existing missions.';
  end if;

  select count(*) into existing_count
  from public.wishes where user_id = new.user_id;

  if existing_count >= 3 then
    raise exception 'WISH_LIMIT_REACHED' using
      errcode = 'P0001',
      detail = 'An account may save at most three distinct wishes.';
  end if;
  return new;
end
$$;
