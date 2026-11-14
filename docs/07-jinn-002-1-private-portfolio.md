# JINN-002.1 — Private Portfolio Builder

Status: **Implementation ready for PR verification.** Do not merge without passing CI and owner acceptance.

## User outcome
Someone who wishes to become a photographer can select “Build my portfolio,” upload 3–15 photographs, and receive a **real private gallery** stored in Supabase. Jinn performs basic technical image checks and removes exact duplicate files. Users edit the gallery before any publication (not yet supported).

## Smallest solution
- React client processes photos locally. The original files remain on the user's device.
- Optimized 1600-pixel WebP preview copies (metadata stripped via canvas) are uploaded directly into a **private** Supabase Storage bucket. This avoids API binary-upload limits and a custom backend.
- One owner-protected `public.portfolios` table stores metadata and the curated photo list as JSONB. No workers, image AI provider, queue or vector DB.
- On-device technical scoring estimates resolution, exposure, contrast and detail. Select up to 8 by score; **not** a claim of artistic curation.
- Preview photos use one-hour signed URLs generated through authenticated owner-scoped Storage access. The same verified user can reopen a private portfolio on another device using email OTP. Different users cannot access one another's previews.
- User can edit title/introduction, toggle featured photos, save changes, reload private drafts and delete the whole portfolio.

## Accepted behaviors
- [ ] Onboarding stays free and does not create account records for visitors.
- [ ] Saving a wish or starting a persistent portfolio requires email OTP verification; no anonymous account is created by either action.
- [ ] Supabase browser session survives reloads and automatically refreshes.
- [ ] Returning users can sign back in with email on another device.
- [ ] Signed-in users can see saved wishes and portfolios from the My wishes header without creating new accounts.
- [ ] Saved wishes expand to show the chosen mission and current (planned) status; an owner can delete a wish.
- [ ] Saved portfolios reopen and refresh temporary image links after authentication.
- [ ] Sign out clears the local session and leaves the page ready for public wish exploration.
- [ ] Supabase restrictive RLS policy rejects existing anonymous session tokens, including direct API requests.
- [ ] User selects `build-portfolio` and sees a functioning upload path, not a disabled action.
- [ ] 3–15 JPEG/PNG/WebP source images. Input files capped at 20 MB, preview outputs capped at 6 MB.
- [ ] Exact duplicate files omitted; first-pass ranking reproducible.
- [ ] Optimized previews stored privately under `userId/portfolioId/photoId.webp`.
- [ ] Gallery exists in `public.portfolios` and can reload via its private bookmark.
- [ ] Editing featured photos / title / introduction persists and reloads.
- [ ] Delete removes all stored preview images and the DB record.
- [ ] Private RLS and storage owner policy verified; no public bucket or public asset URL.
- [ ] No false claim of external publication; no wish consumed or payment charged.
- [ ] GitHub CI typecheck/tests/build passes; Netlify deploys only after merge to `main`.
- [ ] Owner manually accepts desktop/mobile layout and actual upload flow.

## Boundaries
No heavy account dashboard or additional session tables. No vision-model aesthetic ranking, gallery URL ingestion, image editing, multi-device identity, public publication, monitoring, external sending or payment. “Portfolio exists” means a saved private draft; “published” is explicitly out of scope.

## Security notes
A verified email account is mandatory for any persistent user content. Anonymous Auth is not permitted for new writes.  Image byte caps apply to source files; bucket MIME and size limits apply to WebP previews. RLS restricts DB rows and Storage paths to `auth.uid()`. Do not enable public policies or introduce a service-role key into browser code. For a public pilot, add verified-account conversion, per-user quotas, moderation policies and lifecycle cleanup.

## Validation commands
```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```
Use “I want to be a photographer” → Build my portfolio → On my device → Build my private portfolio. Test at least three distinct photographs. Confirm file records, reload, editor changes and delete. Validate `auth.uid()` isolation separately with two anonymous browser sessions.

## Deployment contract
Only merged `main` gets a Netlify production build. `netlify.toml` skips non-production builds through an `ignore` command. GitHub Actions still checks pull requests. No auto-merge.

## Coordinated release — authentication cutover
1. Configure **both** Supabase Confirm signup and Magic Link/OTP email templates with `{{ .Token }}`: new accounts can receive Confirm signup while returning accounts receive Magic Link/OTP. The default confirmation URL sends users back to the homepage without restoring mission state. Confirm the email provider delivers codes, preferably using a test email first.
2. Validate the feature branch UI locally, including email OTP verification and re-access to private portfolio.
3. Merge the feature PR to `main` only after acceptance; Netlify deploys `main` automatically.
4. Apply `supabase/migrations/20261114190000_require_verified_users.sql` promptly as a coordinated cutover. Existing anonymous sessions can no longer read/write new content. Consider applying just before merge if a brief old-UI interruption is acceptable.
5. Optionally disable Anonymous Sign-ins in Supabase Auth settings. This alone is insufficient because existing anonymous JWTs remain valid until expiry; restrictive policies enforce the actual boundary.
6. Existing anonymous data and storage may remain. Inspect aggregate counts and obtain explicit approval before any cleanup; do not delete on merge.

**Important:** supabase-js passwordless email defaults to sending a magic link; our inline code form needs **both** email templates to contain `{{ .Token }}`. We cannot change this template through the current Supabase app connector; use the Supabase dashboard.

## OTP length regression
Supabase `wisht-dev` sends eight-digit codes. The initial UI accepted only six, truncating the value and causing `Token has expired or is invalid`. The code form now accepts 6–10 numeric digits (the full value from the email). Test against a newly issued eight-digit code before merging this PR. No secret code is committed.

## 002.1 continuation — My wishes (same PR)
Wisht uses the Supabase browser client session (with persistent storage and token refresh); no custom session table is needed. The signed-in header shows My wishes and Sign out. My wishes loads the existing `wishes` and `portfolios` records filtered by authenticated user ID under RLS; saved wishes remain explicitly PLANNED rather than falsely showing work as complete. Clicking a portfolio opens its private gallery and reissues signed image URLs. A returning user can sign into a second browser using the same email OTP and see the same records. No new migration for session continuity. Before merging, validate the OTP path, page refresh, another device, sign-out and owner-isolation. Legacy anonymous records remain separate from email accounts.
