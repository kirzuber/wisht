# JINN-002.2 — Publish My Portfolio

Status: IN REVIEW · feature branch `feature/jinn-002-2-publish-portfolio`.

## Outcome
A user with a saved, private photography gallery can choose to share selected optimized photos and their own title/introduction. Wisht shows the exact public subset before publication, asks for explicit approval, copies approved photos to public storage, creates a fixed published snapshot, and verifies the saved public URL. A user can unpublish and keep their private draft.

## Story boundaries
- **Publish:** owner-only action, requires a saved private portfolio, at least one selected photo, no unsaved edits, and explicit in-screen checkbox approval. Use only the saved private gallery metadata, not arbitrary client-supplied paths.
- **Public copy:** copy selected WebP previews from `portfolio-previews` to `portfolio-public`, not original photos. Do not expose unselected images, original filenames or other private fields.
- **Public page:** read-only, no sign-in, URL `/p/<16 hex digits>`. Public snapshot table is separate; SQL column-level SELECT grants exclude `user_id`.
- **Verification:** check public image GET after upload, then confirm the database snapshot. Display URL and an accurate receipt; no fabricated completion.
- **Unpublish:** remove public image copies and snapshot. Keep private gallery intact. Deleting private portfolio must unpublish it first.
- **Editing:** live page is a fixed snapshot. Changes to the private draft do not silently change the public page. Unpublish and publish again to update it.
- **No second wish:** publishing is part of completing the original portfolio mission.
- **No new infrastructure:** reuse Netlify SPA, Supabase DB/Auth/Storage and current browser app. No Netlify Functions, service key, worker, AI image model, or billing.

## Acceptance checklist
- [x] PR CI typecheck, tests and Vite build pass.
- [ ] Public URL from an anonymous browser loads ONLY approved pictures and text.
- [ ] A second account cannot change or delete another user's public gallery.
- [ ] Unselected private images never appear in public storage or public snapshot metadata.
- [ ] A changed private gallery cannot publish until saved.
- [ ] Unpublish disables the public gallery and removes public image copies; private gallery remains.
- [ ] Deleting a published private gallery also removes all public copies and the snapshot.
- [ ] Failed copy/database writes do not report success; cleanup is attempted and failures surfaced.
- [ ] Production deployment only after PR merge; `main` builds via Netlify.
- [ ] Owner visually approves desktop/mobile public page.

## Release and data caveats
The migration is checked into Git and **has been applied to `wisht-dev`** for local acceptance testing. Verified: private bucket remains private, public bucket is separate, anonymous public-title reads work while owner ID/private portfolio SELECT are denied, and a database trigger blocks deleting a published private draft without unpublishing. Do not merge until the UI is tested with real photographs. Public files can persist temporarily in CDN caches after deletion; do not promise immediate erasure of every cached copy. Before opening publishing to untrusted public users, add rate/quantity quotas and a content-abuse policy.

## Planned follow-up
JINN-003: genuine Work Receipt with persistent verification evidence and second wish opportunity discovery.
