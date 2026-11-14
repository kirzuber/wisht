# JINN-003.4 — Autonomous Watch

Status: COMPLETE. Owner accepted local controls and production execution on November 14, 2026. Merged PR #9.

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

The project uses **only main for production**; scheduled functions do not execute on branch previews. Release sequence: (1) verify code and migration, (2) set server-only secret, (3) owner locally accepts watch controls, (4) merge into main, (5) check Netlify lists the Scheduled Function, use **Run now**, and verify a real database check record. Until step 5, retain story status IN REVIEW; if the deployment/runtime test fails, fix immediately or revert the merge. Do not claim autonomy from unit tests alone. If the secret setup isn't approved, keep this PR unmerged.

## Acceptance
- [x] CI TypeScript/test/build green.
- [ ] Migration \`supabase/migrations/20261115040000_autonomous_photo_watch.sql\` applied and constraints/RLS/claims verified without enabling a production watcher.
- [ ] Local UI: start seven-day watch under an existing photography wish; confirm next scheduled check, no extra wish slot.
- [ ] Pause/resume/cancel works; another account cannot read or control it; no automatic watching without opt-in.
- [x] Unit tests cover first baseline, new listings, changed deadline, repeated URL with UTM tracking, and source failure.
- [x] Netlify Functions runtime key configured; anonymous/authenticated database claim RPC access denied. Credential value not disclosed.
- [x] Owner accepted the live run; direct Supabase verification confirmed 1 successful production watch run and 1 corresponding Work Receipt, with 0 failures.
- [ ] User observes next check/findings in My Wishes; no unsolicited email or external submission.
- [x] Owner accepted local UI; PR #9 merged to main, Netlify published the scheduled function, and persisted production execution evidence was verified.

## Next
JINN-003.4.2 (optional): consented digest email with delivery-state receipts, timezone/quiet-hours controls, bounce handling and spending caps. MVP after watch can prove real unattended completion. Career and soccer will require their own permitted source adapters.

## Verified implementation state — November 14, 2026
GitHub Actions CI: https://github.com/kirzuber/wisht/actions/runs/43644683334 — all tests, TypeScript checks and build passed. The database migration was applied to `wisht-dev` and confirmed enabled RLS, three triggers, owner controls, read-only watch-run access, denied authenticated claim RPC and denied client writes to counters or watch runs. SQL rollback test created a watch for an existing photography wish, paused/resumed, atomically claimed it once, inserted one successful run with an associated `WATCH_CHECK_COMPLETED` receipt, confirmed a second same-day claim returned no jobs, cancelled it, and rolled back everything. Zero watches/runs/watch receipts remain. Supabase security advisor shows no new watch-related findings; four unrelated pre-existing advisories remain. Worker unit tests cover no opt-in watchers, a new listing, and honest source failure.

**Pre-merge checkpoint (historical):** Netlify scheduling, credential setup, and real execution were pending at the time this note was written. The closure evidence below supersedes those deployment blockers. Account-to-account browser isolation was not independently retested as part of story closure; database RLS and grants were tested.

## Story closure — November 14, 2026
The user accepted the local watch experience, approved merge/deploy, and confirmed the live server test passed. PR #9 was squash-merged as `d1bbb3853cda0ce1bd7addaf03102a9ba51dbe92`; Netlify production deployment `6af8dc140e2e18a09e71f6c4` is ready and registered the scheduled `daily-watch` function with cron `0 12 * * *`. The server-only `SUPABASE_SERVICE_ROLE_KEY` was confirmed present in Netlify without reading or exposing the credential. Direct Supabase query after acceptance confirmed **one active photography watch, 1 attempted check, 1 successful recorded run, 0 failed runs, 1 database-authored `WATCH_CHECK_COMPLETED` receipt**. These are independently observed persisted outcomes—not an assumption from a successful deployment. The story is COMPLETE. Delivery remains in-app only and indexed-source listings are not organizer-certified.
