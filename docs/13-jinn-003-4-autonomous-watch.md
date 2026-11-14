# JINN-003.4 — Autonomous Watch

Status: IN REVIEW. Branch: feature/jinn-003-4-autonomous-watch.

## Outcome
The verified user explicitly starts one seven-day photography Opportunity Watch under an existing photography wish. Once a day, Netlify's scheduled function checks the bounded existing public calendar, compares results with earlier successful checks, persists a true database check record, and shows any new or changed listings in My Wishes the next time the user visits.

## User contract
- **No automatic enrollment.** Creating a photography wish, saving a shortlist, or publishing a portfolio does not start a watch.
- One open watch (active or paused) per photography wish. User selects interest and free-entry preference.
- At most seven network checks per watch, no more than one due check per UTC day; all watches expire after seven days.
- **Pause**, **Resume**, **Cancel**, and remove stopped watch history. They are owner-controlled; other accounts and anonymous sessions have no access.
- In-app findings on return only. **No email, push, SMS, or external submission** is sent. Email opt-in requires a separate consent and delivery story.
- Every check is a public source listing lookup, **not** organizer/eligibility/fee verification.
- First successful check builds a baseline and does **not** call all existing listings “new.” Later checks distinguish new source listing URLs and changed title/deadline. No artificial alerts on retries.
- Source failure is recorded as failed, not an imaginary discovery; attempts are still charged against the fixed seven-check budget.

## Implementation
- New tables: owner-RLS \`photo_watches\` (seven-day bounded schedule, status, run count), server-authored \`photo_watch_runs\` (real checks and results).
- Composite wish/owner FK and photography-kind trigger; partial unique active/paused watch per goal. Parent wish deletion RESTRICTs while watch exists.
- RPC \`claim_due_photo_watches\` atomically reserves at most six due watchers, advances next due time and increments attempt count **before** any network call. Only \`service_role\` can invoke; anonymous/authenticated cannot.
- \`netlify/functions/daily-watch.mts\` runs at **12:00 UTC daily** with a hard 30s scheduled function execution window. Max six watches in two parallel groups of three; existing scanner has 7.5s timeout/2MB cap and no LLM calls. Runs are successful, failed, or absent (if paused/cancelled).
- Comparison key is normalized Pixcontests listing URL pathname. Query tracking params are ignored. One/day/run unique index prevents duplicate recorded checks.
- Each successful recorded run creates \`WATCH_CHECK_COMPLETED\` Work Receipt via existing private database writer. This attests source-check record persistence, NOT organizer verification, submission, or notification delivery.
- Frontend \`PhotoWatch\` under the photography wish displays the active state, status actions, last result, changes and history.
- No new infrastructure providers, no paid APIs, no browser scraping or generic orchestration.

## Production secret and release dependency (DO NOT SKIP)
Netlify currently has **no server-only Supabase credential** configured. Scheduled functions need a server-only \`SUPABASE_SERVICE_ROLE_KEY\` scoped to Netlify **Functions/runtime** and the safe \`SUPABASE_URL\` (the existing \`VITE_SUPABASE_URL\` is an acceptable non-secret URL fallback). This secret must **never** be put in \`VITE_\`, client source, Git, local screenshots, or runtime logs. The function fails closed when credentials are absent. Set this secret only through Netlify secure project environment settings, with a proper deployment context and redeploy.

The project uses **only main for production**; scheduled functions do not execute on branch previews. The scheduled job cannot be accepted as functioning until the server credential is set, PR merged, scheduled Function recognized by Netlify, and a real **Run now** or timed run produces a database check record for an opt-in test watch. Do not mark the story complete from unit tests alone. If the secret setup isn't approved, retain the branch in review and do not merge.

## Acceptance
- [x] CI TypeScript/test/build green.
- [ ] Migration \`supabase/migrations/20261115040000_autonomous_photo_watch.sql\` applied and constraints/RLS/claims verified without enabling a production watcher.
- [ ] Local UI: start seven-day watch under an existing photography wish; confirm next scheduled check, no extra wish slot.
- [ ] Pause/resume/cancel works; another account cannot read or control it; no automatic watching without opt-in.
- [x] Unit tests cover first baseline, new listings, changed deadline, repeated URL with UTM tracking, and source failure.
- [ ] Server-only credential set in Netlify; no browser or anonymous access to key or claim RPC.
- [ ] A **real scheduled/Run now** Netlify check runs on production, produces persisted watch run, receipt and accurate findings.
- [ ] User observes next check/findings in My Wishes; no unsolicited email or external submission.
- [ ] Publish only after PR merge and end-to-end owner acceptance.

## Next
JINN-003.4.2 (optional): consented digest email with delivery-state receipts, timezone/quiet-hours controls, bounce handling and spending caps. MVP after watch can prove real unattended completion. Career and soccer will require their own permitted source adapters.

## Verified implementation state — November 14, 2026
GitHub Actions CI: https://github.com/kirzuber/wisht/actions/runs/43644683334 — all tests, TypeScript checks and build passed. The database migration was applied to `wisht-dev` and confirmed enabled RLS, three triggers, owner controls, read-only watch-run access, denied authenticated claim RPC and denied client writes to counters or watch runs. SQL rollback test created a watch for an existing photography wish, paused/resumed, atomically claimed it once, inserted one successful run with an associated `WATCH_CHECK_COMPLETED` receipt, confirmed a second same-day claim returned no jobs, cancelled it, and rolled back everything. Zero watches/runs/watch receipts remain. Supabase security advisor shows no new watch-related findings; four unrelated pre-existing advisories remain. Worker unit tests cover no opt-in watchers, a new listing, and honest source failure.

**Not yet validated:** Netlify scheduled-function runtime, credential setup, daily timed invocation, account-to-account browser isolation, and production read-back after actual unattended execution. The production secret is currently absent from Netlify. Do not merge before that activation gate is resolved.
