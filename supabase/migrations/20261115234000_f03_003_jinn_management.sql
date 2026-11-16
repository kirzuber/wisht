-- JINN-F03-003: allow a verified owner to reassign their own Wish and
-- remove only empty, non-primary Jinns. No legacy data or F03 records are rewritten.
-- The original composite owner FK on wish_records enforces same-owner Jinn assignment.
grant update (primary_jinn_id) on public.wish_records to authenticated;
grant delete on public.jinns to authenticated;

create policy "owner deletes empty non-primary jinns"
  on public.jinns for delete to authenticated
  using (
    (select auth.uid()) = user_id
    and coalesce((select (auth.jwt()->>'is_anonymous')::boolean), true) is false
    and is_primary = false
    and not exists (
      select 1 from public.wish_records w where w.primary_jinn_id = public.jinns.id
    )
  );

-- Purpose is an optional, non-executable note; it does not change LLM behavior
-- or grant access to any other Wish. Keep it bounded at the persistence boundary.
alter table public.jinns add constraint jinns_purpose_bounded check (
  not (settings ? 'purpose')
  or (jsonb_typeof(settings->'purpose') = 'string'
      and char_length(settings->>'purpose') <= 160)
);
