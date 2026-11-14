-- Enforce verified, recoverable identities before storing user content.
-- Supabase anonymous sign-ins use the 'authenticated' Postgres role.
-- Restrictive policies AND with existing owner policies to prevent bypass.
-- Apply in wisht-dev in coordination with deploying email OTP UI on main.

create policy "verified account required for wishes"
on public.wishes as restrictive for all to authenticated
using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

create policy "verified account required for portfolios"
on public.portfolios as restrictive for all to authenticated
using ((select (auth.jwt()->>'is_anonymous')::boolean) is false)
with check ((select (auth.jwt()->>'is_anonymous')::boolean) is false);

-- Restrict only Wisht's own storage bucket, leaving other buckets unaffected.
create policy "verified account required for portfolio images"
on storage.objects as restrictive for all to authenticated
using (
  bucket_id <> 'portfolio-previews'
  or (select (auth.jwt()->>'is_anonymous')::boolean) is false
)
with check (
  bucket_id <> 'portfolio-previews'
  or (select (auth.jwt()->>'is_anonymous')::boolean) is false
);
