# JINN-003.1 — Durable Work Receipts

Status: IN REVIEW. Branch: `feature/jinn-003-1-work-receipts`.

## Why
Wisht must compete with the effort needed to reach an outcome. Its proof of work cannot be a client-generated congratulatory panel or a promise to do something later.

## What counts as evidence
A Work Receipt is a **database-authored fact about a completed persistent operation**, attached to the same parent wish and portfolio.
- PRIVATE_GALLERY_CREATED: a private portfolio DB row was successfully inserted; show its photo *entries* count.
- PUBLIC_LISTING_CREATED: a public publication snapshot DB row was successfully inserted; show its approved photo *entries* count and retained slug.
- PUBLIC_LISTING_REMOVED: a publication snapshot DB row was successfully deleted; show a truthful removal event.
- Old currently-existing private galleries and active publications are backfilled as `existing_record_backfill`. Do **not** invent past unpublishing or historic external reachability checks.

Receipts do **not** independently prove that the public page is currently reachable, that each image passed artistic evaluation, or that a CDN has purged cached public files. The existing publication path independently performs HTTP GET checks of each public image *before* creating its snapshot, but those HTTP checks aren't persisted as server-verifiable evidence in this small story.

## Technical implementation
- One new `public.work_receipts` table.
- Exactly three Postgres AFTER INSERT/DELETE trigger hooks on existing authoritative tables.
- A function in the non-exposed `private` schema writes the receipts; clients have SELECT only, not INSERT/UPDATE/DELETE.
- User-specific read RLS requires the same verified account; no public receipts or access to another user's history.
- Each receipt references a wish by FK (cascade on wish deletion), retains a portfolio ID and creation/publish/unpublish action even if the portfolio is deleted later.
- My Wishes shows receipts under the parent wish; an individual portfolio shows its own history.
- No new API, queues, subscriptions, polling, LLM calls, payment, usage ledger or generic orchestration runtime.

## Acceptance
- [x] GitHub CI typecheck/tests/build passes.
- [x] Applied migration `20261114235000_work_receipts.sql` to `wisht-dev` without modifying existing portfolios or public URLs.
- [x] Existing private galleries (2 current records) were backfilled with explicitly marked reconstructed receipts. No current published listing was present at migration time, so no historical publication receipt was invented.
- [ ] Signed-in owner can read only own receipts; anonymous visitor cannot read receipts.
- [x] Verified SQL grants: authenticated cannot INSERT/UPDATE/DELETE receipts; anonymous cannot SELECT; authenticated cannot EXECUTE private receipt writer.
- [ ] Creating a new portfolio creates PRIVATE_GALLERY_CREATED record under the same wish.
- [x] SQL rollback test exercised publication insert, correctly capturing publication creation without retaining test data; owner-browser acceptance still required.
- [x] SQL rollback test exercised publication deletion and verified three action events in the same test transaction; owner-browser acceptance still required.
- [ ] My Wishes and portfolio editor show a calm receipt timeline with precise evidence wording.
- [ ] Production deploy still occurs only after PR merge to `main`.

## Scope of JINN-003.2
The next story will design the second autonomous real-world deed (Opportunity Scout). It should produce actionable, sourced work and an auditable receipt, not just generic recommendations. Do not add it to this PR.

## Verification evidence — November 14, 2026
GitHub Actions run: https://github.com/kirzuber/wisht/actions/runs/43634963605 (successful).
The database was checked for three enabled triggers, owner-only RLS, read-only client grants and no direct execution permission on the private receipt writer. A temporary portfolio was created, published, unpublished, and verified to produce all three receipts inside a database subtransaction; it was rolled back. Database still contained exactly two pre-existing reconstructed receipts after the test. Existing published records may be zero due to user tests before this migration; never backfill events not supported by current records.
