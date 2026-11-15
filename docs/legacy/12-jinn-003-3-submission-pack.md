# JINN-003.3 — Prepare Submission
Status: COMPLETE. User accepted functional behavior and authorized closure and merge on November 14, 2026. Implemented in PR #8.

## User outcome
After saving a real photography opportunity under a wish, the owner can choose one, inspect its indexed source for the organizer's official URL, review the official rules, select a saved private portfolio and 1–8 selected photos, edit a factual artist statement and cover note, and save a **private submission draft**. They can download a ZIP with the editable preparation brief and only those selected, optimized WebP previews. Saved drafts reopen under their parent wish.

**No automatic external submission.** No emails, portal navigation, organizer account creation or payment. The Work Receipt records only a successfully saved draft.

## Source trust and organizer rules
- `GET /api/opportunity-detail?listing=...` fetches **only** a strictly validated Pixcontests listing slug (`https://pixcontests.com/<slug>`), with a 7s timeout, redirect denial and 500KB cap. It may extract an external `Visit official page` link but NEVER fetches that external URL.
- The source observation is **index page reached**, not organizer verification. Deadlines in the shortlist are index-observed and can change. Organizer fees, age/location eligibility, rights, licensing, AI restrictions, and technical submission specs are **unknown** until the user checks the official organizer page.
- The user may enter the official HTTPS URL, paste actual requirements, and optionally confirm **I personally reviewed the organizer's rules**. The system stores that as **user-reviewed**, never "independently verified by Jinn".
- Drafts may be saved before user review, clearly marked as requiring further review. A draft cannot be mislabeled "submitted".
- Full independent organizer verification (safe remote fetching, extraction, provenance, version changes) is deferred. This is an explicit difference from the originally broad JINN-003.3 planning line.

## Prepared output
- Editable name, artist statement, cover note. Initial text derives exclusively from user portfolio title/introduction and opportunity title; no invented prizes, exhibitions, awards or biographies.
- Authenticated client downloads 1–8 currently owned WebP previews from private Supabase Storage and assembles a standard ZIP without new packages or external processing. Files are **previews at up to 1600px**, NOT original high-resolution JPEG/RAW entries. The exported Markdown README contains requirements source, user-claimed review status, selected-photo manifest, factual writing, and a preflight checklist.
- The package can be reviewed, edited, deleted and exported again. Changing source portfolio or opportunity creates a different draft.

## Data and integrity
- `public.submission_packages`: owner-scoped, photography wish, exactly one saved shortlist opportunity, exactly one owned portfolio, selected subset from that portfolio, editable draft text/rules, optional user confirmation, timestamps.
- Cross-user/cross-wish/source forgery blocked by composite parent FK and BEFORE INSERT/UPDATE verification against the saved shortlist `matches` and gallery `photos`. Immutable linkage after creation.
- RLS only grants the verified owner SELECT/INSERT/UPDATE/DELETE. Browser cannot forge receipts. Uniqueness prevents duplicate draft for same saved opportunity and gallery.
- Existing shortlist and portfolio deletion is RESTRICTED if linked to a submission draft; delete the draft first. Existing data and publication URLs remain unchanged.
- `private.record_work_receipt` now includes `SUBMISSION_DRAFT_SAVED`, `submission_id`, and the selected-photo count. It does not claim external transmission or organizer verification.
- No additional jobs, LLM calls, storage buckets, model keys or paid APIs.

## Acceptance checklist
- [x] CI: TypeScript, tests and build pass.
- [x] Migration applied to `wisht-dev` and verified. Owner RLS, no anonymous SELECT, Work Receipt trigger, source/portfolio integrity and immutable linkage passed transactional database tests. Prior records preserved.
- [ ] Open My wishes → photography → saved shortlist → Prepare submission.
- [ ] Choose a saved gallery and 1–8 selected images; original private photo access remains owner-scoped.
- [ ] Indexed-listing inspection offers the official organizer link when published; does not claim organizer eligibility verification.
- [ ] User can enter official rules URL and notes, confirm review, edit all wording, and save a private draft. Missing organizer rules keep clear warning.
- [ ] Reopen draft from My wishes; text, photo choices and review state persist.
- [ ] ZIP contains preparation Markdown and exactly approved WebP previews; no original resolution/format claims.
- [ ] New Work Receipt says `Private submission draft saved`, no claim of submission or accepted eligibility.
- [x] Transactional DB checks: source and portfolio matching, package receipt count, invalid user rule-review claim rejected, immutable identity enforced and shortlist delete restricted. Client receipt INSERT denied. Cross-account browser verification remains for local acceptance.
- [ ] No external submission or organizer emails; production deploy only after user accepts and PR merges.

## Future
JINN-003.4 will add a bounded autonomous watch after this first prep journey is validated. Separately, authoritative organizer-rule inspection with safe source-specific adapters is needed to move beyond user confirmation. We should not add unrestricted third-party browser crawling, and no product copy should call the eligibility/rights "verified" until that evidence exists.

## Verification evidence — November 14, 2026
CI: https://github.com/kirzuber/wisht/actions/runs/43642176913 — successful TypeScript checks, automated tests and Vite build. Supabase migration `20261115023000_submission_packages.sql` successfully applied to `wisht-dev`. RLS enabled; anonymous table SELECT absent; verified-owner CRUD policies and two triggers enabled. A temporary package created from the existing user's saved opportunity and selected private portfolio photo produced one `SUBMISSION_DRAFT_SAVED` Work Receipt with photo_count=1, rejected a false reviewed-by-user claim lacking official rules notes, rejected edits to source identity, blocked deleting its parent shortlist, then rolled back. One pre-existing shortlist and two private portfolios remain; zero persistent submission drafts or new receipts from the test. Supabase security advisor returned no new findings for submission_packages; four prior project warnings remain.

**Still pending:** live indexed-page inspection, organizer-link extraction, ZIP download review, and second-account isolation in a real browser. Do not merge the draft PR until the owner tests the full local journey.

## 003.3.1 — Calendar URL inspection compatibility fix
During local acceptance the user reported `Only a supported Pixcontests listing may be inspected` for every saved Scout entry. Root cause confirmed against actual `wisht-dev` `opportunity_shortlists.matches[*].sourceUrl` values: the feed appends `?utm_source=calendar&utm_medium=feed` to valid contest slugs, but our inspector rejected all query strings. `validatedListingUrl` now accepts HTTPS Pixcontests or www.Pixcontests listing slugs and **drops the entire query and fragment before making its server-side GET**, retaining strict host/path validation, no redirects, no fetches to organizer domains. Regression test uses the actual `people-virtual-3d-exhibition-2026` slug and feed-style tracking query, verifying that no supplied parameters reach the network call. Live organizer-page link extraction remains an outstanding owner-browser test; if the index temporarily returns HTTP 403 or HTML changes, the safe fallback is to visit the source link and paste the official organizer URL manually, not to bypass origin checks.

## Closure
The owner confirmed functional acceptance after the indexed-listing URL fix and approved merging PR #8. GitHub CI passed and the Supabase migration was already applied to wisht-dev. This approval does not constitute independent evidence of organizer eligibility or external submission. Historic unchecked granular acceptance items remain recorded as such.
