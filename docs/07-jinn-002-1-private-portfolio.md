# JINN-002.1 — Private Portfolio Builder

Status: **Implementation ready for PR verification.** Do not merge without passing CI and owner acceptance.

## User outcome
Someone who wishes to become a photographer can select “Build my portfolio,” upload 3–15 photographs, and receive a **real private gallery** stored in Supabase. Jinn performs basic technical image checks and removes exact duplicate files. Users edit the gallery before any publication (not yet supported).

## Smallest solution
- React client processes photos locally. The original files remain on the user's device.
- Optimized 1600-pixel WebP preview copies (metadata stripped via canvas) are uploaded directly into a **private** Supabase Storage bucket. This avoids API binary-upload limits and a custom backend.
- One owner-protected `public.portfolios` table stores metadata and the curated photo list as JSONB. No workers, image AI provider, queue or vector DB.
- On-device technical scoring estimates resolution, exposure, contrast and detail. Select up to 8 by score; **not** a claim of artistic curation.
- Preview photos use one-hour signed URLs generated through authenticated owner-scoped Storage access. Other browsers cannot access the portfolio unless signed into the same anonymous identity (not supported yet).
- User can edit title/introduction, toggle featured photos, save changes, reload private drafts and delete the whole portfolio.

## Accepted behaviors
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
No vision-model aesthetic ranking, gallery URL ingestion, image editing, multi-device identity, public publication, monitoring, external sending or payment. “Portfolio exists” means a saved private draft; “published” is explicitly out of scope.

## Security notes
Anonymous Auth is adequate for an invitation-only experiment, **not** long-lived identity recovery. Image byte caps apply to source files; bucket MIME and size limits apply to WebP previews. RLS restricts DB rows and Storage paths to `auth.uid()`. Do not enable public policies or introduce a service-role key into browser code. For a public pilot, add verified-account conversion, per-user quotas, moderation policies and lifecycle cleanup.

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
