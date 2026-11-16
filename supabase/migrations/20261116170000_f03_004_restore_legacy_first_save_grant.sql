-- F03-004 compatibility repair for already-initialized LOCAL Foundation DBs.
-- The earlier Draft F03-004 migration revoked legacy first-save EXECUTE.
-- Changing that already-recorded SQL file does not replay it: this additive
-- migration restores old-client compatibility during the expand-only rollout.
-- Intended for hosted projects only as part of an explicitly approved release.
-- This is non-destructive, idempotent and contains no data changes.
grant execute on function public.create_wish_with_deed(uuid,text,jsonb,jsonb)
  to authenticated;
