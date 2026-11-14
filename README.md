# Wisht — Three wishes. Real work.

Wisht is an early wish-to-action prototype. **Photography portfolio creation and user-approved publication are executable.** Other mission cards remain plans, not performed actions.

## Run locally

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Express at http://localhost:3001.

Use `web/.env.local` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (public, **not** the Supabase secret key). For the local Express LLM classifier, export `LLM_PROVIDER=deepseek`, `DEEPSEEK_API_KEY`, and optional `LLM_MODEL=deepseek-flash` into the shell before `npm run dev`. Never commit secrets.

## Current action — JINN-002.1

“I want to be a photographer” → Build my portfolio → On my device → Build my private portfolio.

Upload 3–15 JPEG/PNG/WebP photos. Wisht processes previews locally, skips exact duplicates, picks an initial technically ranked selection, saves optimized WebP previews in private Supabase Storage, and opens a gallery you can edit, bookmark, reload and delete. The original files stay on your device. No image is published without an explicit review and approval.

The feature requires `supabase/migrations/20261114180000_private_portfolio.sql`, already applied to `wisht-dev`. The verified-account migration `20261114190000_require_verified_users.sql` is applied; legacy anonymous sessions are blocked from user-content writes.

**Auth setup**: Supabase → Authentication → Email Templates → **both Confirm signup and Magic Link / OTP**: include `{{ .Token }}` in the email template body so Wisht's verification-code form works. Example:

```html
<h2>Your Wisht verification code</h2>
<p>Enter this code in Wisht: {{ .Token }}</p>
```

First-time `signInWithOtp` requests can send the Confirm signup template; returning users receive Magic Link / OTP. The existing confirmation link returns to the Wisht homepage and does not preserve the in-progress mission. Enter the **complete code** in the open Wisht screen. Some Supabase projects generate eight-digit codes; the UI accepts numeric OTPs from 6 to 10 digits. Never truncate the email code. The email provider must be enabled and able to send messages. Default Supabase mail delivery is rate-limited and suitable only for early tests. Supabase → Authentication → Providers → **disable Anonymous Sign-ins** after the UI and RLS migration are deployed. Prior anonymous content isn't automatically deleted or transferred to new verified identities; review it separately before any cleanup.

**OTP input validation:** `web/src/AuthGate.tsx` accepts 6–10 numeric digits; project email currently sends eight digits. If you see “expired or invalid,” check the full code and request a fresh one.\n\n## Returning to your work

Wisht keeps the Supabase browser session through reloads and refreshes it automatically. The top bar shows **My wishes** and **Sign out** for verified users, or **Sign in** for visitors. After login, **My wishes** loads saved aspirations and private portfolios from owner-protected tables. You can expand a planned wish, delete it, or reopen a portfolio. Signing in with the same email on another device gives access to the same account data, though individual signed image URLs are temporary and refreshed on opening the portfolio.

Exploring wishes still requires no account and writes no persistent user data. Earlier **anonymous** test records do not belong to newly verified email accounts and are not migrated automatically.

## Three-wish limit

Each saved mission card occupies **one of three slots** in a verified account. Exploring new ideas never requires sign-in or consumes a slot. Portfolios are artifacts, not additional wishes. After three are saved, the app explains the limit and offers deletion of a saved wish. The database enforces the cap even against direct API calls and concurrent requests; a frontend count provides an early friendly message. Legacy over-limit records are preserved rather than silently deleted.

Migration: `supabase/migrations/20261114210000_three_saved_wishes.sql` — already applied to the separate `wisht-dev` database. No existing records were removed.

## Duplicate wishes

A saved mission is provisionally one wish. Before storing it, Wisht checks whether the user has the same aspiration already. Different wording and mission choices are matched using the existing supported intent category (soccer, photography, career, independence or finance); other categories are checked for identical normalized text. Existing duplicates remain visible with a warning and can be removed manually; they are never deleted without consent. Database trigger migration: `supabase/migrations/20261114220000_prevent_duplicate_wishes.sql` — already applied to `wisht-dev`. Verified using a rejected same-goal insert, with no test data inserted.

This is a deliberately narrow goal model, not unrestricted semantic search. Different career objectives may currently share a goal family; we will refine goal identity when we add multiple deeds per wish.

## Publishing — JINN-002.2

Private portfolios remain in `portfolio-previews`. The user previews selected photographs, approves publication explicitly, and clicks Publish. A separate `portfolio-public` Storage bucket holds **only approved WebP copies**, while `portfolio_publications` holds the public title, introduction and selected image paths. Public gallery URLs are `/p/<slug>`; visitors can open them without signing in. The private draft remains private. Unpublish removes public image copies and the public snapshot; deleting a private portfolio also unpublishes it first.

Migration: `supabase/migrations/20261114230000_published_portfolios.sql` was applied to `wisht-dev`, and JINN-002.2 was merged to `main` after acceptance. Public gallery pages are available on Netlify production. The share link created locally uses `localhost`; the real external URL becomes functional once merged to Netlify `main`.

Before a public pilot, add moderation/abuse controls, usage quotas, and clear wording about CDN caching after unpublish. Public files may remain cached briefly even after deletion. No service-role key, queue or publishing function is required.

## Wish and portfolio integrity — JINN-002.3

A wish is a root aspiration, not each mission. One photography wish can own multiple portfolio artifacts. The portfolio creator automatically creates or reuses this parent when the first gallery is successfully saved; the user need not separately press “Save wish.” My Wishes groups galleries under the parent. A composite FK `(wish_id,user_id)` and photography-kind trigger enforce ownership in Supabase, and a compatibility trigger links legacy inserts lacking `wish_id`. Existing published links are retained.

Migration: `supabase/migrations/20261114233000_portfolio_wish_integrity.sql` (**applied and verified in wisht-dev**). Detailed acceptance: `docs/09-jinn-002-3-wish-integrity.md`.

## Work Receipts — JINN-003.1

Database-origin history records three actions: private gallery DB creation, public listing DB creation, and public listing DB removal. Each receipt is attached to its parent wish and can be viewed in My Wishes or the portfolio editor. Records are generated by PostgreSQL triggers rather than a browser claim; verified users can read their own records but cannot forge, edit, or delete receipt rows. The current product does not claim that these events independently certify CDN erasure or ongoing URL reachability.

Migration: `supabase/migrations/20261114235000_work_receipts.sql` (**applied to wisht-dev; trigger, RLS and grants tested**); acceptance and limitations: `docs/10-jinn-003-1-work-receipts.md`.

## Opportunity Scout — JINN-003.2

`/api/scout?genre=any|nature|portrait|open&free=true|false` reads a publicly advertised Pixcontests iCalendar deadline feed and returns **up to five** future-dated, deduplicated listings. It is a bounded public-source scan: it does **not** independently verify organizer eligibility, fees or live submission status. If the feed is unavailable or contains no suitable listings, the Jinn displays an honest failure or empty result. No invented matches and no API key required.

The visitor can browse without signing in. Saving results creates/reuses one photography wish, inserts a user-owned `opportunity_shortlists` row and records a truthful `OPPORTUNITY_SHORTLIST_SAVED` Work Receipt. The same wish can own multiple portfolios and research shortlists. One saved shortlist per wish per UTC day prevents redundant research records; next-day runs can be saved again.

Migration: `supabase/migrations/20261115010000_opportunity_shortlists.sql` (**applied to wisht-dev**); story and acceptance: `docs/11-jinn-003-2-opportunity-scout.md`.

This is one reusable scout shape, with an initial photography-specific provider adapter. Career and soccer will need their own permitted, reliable sources. It is not yet a scheduled autonomous watch and it does not contact organizers or submit photographs.

## Submission preparation — JINN-003.3

From a saved photography opportunity in **My wishes**, choose **Prepare submission**. Wisht inspects only the known Pixcontests index page for an official organizer URL, shows its evidence limitation, and asks the user to review the organizer's actual entry rules. The owner chooses a saved portfolio and images, edits the factual statement and cover note, saves a private `submission_packages` draft, then downloads a ZIP containing the preparation brief and selected WebP previews. User-reviewed rules are **not independently certified**. No external submission occurs.

Database `submission_packages` enforces same-owner wish/shortlist/portfolio and matches the exact saved opportunity against its source shortlist. The `SUBMISSION_DRAFT_SAVED` Work Receipt records the successful database insert, not transmission. Deletion of a shortlist or portfolio with a linked draft is restricted; remove the draft first. No user-generated original high-resolution image is retained by this application: the ZIP provides **optimized WebP previews only**, which may not meet contest rules. Original files must be supplied by the photographer when required.

Migration: `supabase/migrations/20261115023000_submission_packages.sql` (**applied to wisht-dev; receipt and integrity verified**). Acceptance and evidence: `docs/12-jinn-003-3-submission-pack.md`. No new service, external organizer login, payment or unsolicited communication.

## Autonomous Watch — JINN-003.4

Opt-in seven-day photography watch under one wish, scheduled public-source rechecks with baseline/new/changed findings, user pause/resume/cancel, and database-authored Work Receipts. Results are **in-app only**. No unsolicited email and no organizer contact. Source checks use existing zero-LLM Pixcontests scanner; max seven attempts per watch and six due watches processed per scheduled invocation.

Migration: `supabase/migrations/20261115040000_autonomous_photo_watch.sql` (**applied and verified in wisht-dev**); story details: `docs/13-jinn-003-4-autonomous-watch.md`.

**Production activation requires a new Netlify Functions-only `SUPABASE_SERVICE_ROLE_KEY` secret** (never a `VITE_` variable, never committed). Netlify Scheduled Functions run on published main only, at 12:00 UTC daily. Until the credential, published deployment, and first actual scheduled run are verified, this story stays IN REVIEW; the worker fails closed. No Netlify branch previews run a schedule.

## Career Opportunity Scout — JINN-004.1

`POST /api/career-scout` performs a bounded **remote-only** role search using the published Himalayas Jobs API. Supported region filters: Canada, United States and worldwide; search by target role/skill, up to five real indexed vacancies with original Himalayas listing and unchanged source-provided application URLs. Source credit is always displayed. Availability and eligibility remain unverified; no local or hybrid job promise is made. Public search requires no sign-in.

Optional opt-in AI fit analysis is available **only to verified signed-in users**. The frontend explicitly asks permission to send up to 650 characters of user-supplied experience plus five descriptions to DeepSeek/OpenAI in one short JSON response. It maps reasoning only to real returned job identifiers; if unavailable, it shows unassessed real jobs rather than inventing fit. Experience text is **not stored** in a shortlist. The server uses the published Supabase key to validate the user JWT, without exposing server secrets.

Saving findings creates or reuses one career root wish and a private owner-RLS `career_shortlists` record with source links, source timestamp, optional advisory AI fit, one saved list per UTC day. A database trigger writes `CAREER_SHORTLIST_SAVED` Work Receipt (persistence proof, not employer approval). Database migration `supabase/migrations/20261115061000_career_shortlists.sql` (**applied to wisht-dev; ownership/receipt checks verified**) and story details `docs/14-jinn-004-1-career-scout.md`.

## Deployment

One Netlify project serves Vite and serverless API Functions. **Only main is built/deployed by Netlify**: `netlify.toml` ignores branch and PR preview builds. GitHub Actions validates each PR. Never merge a feature branch until CI and owner acceptance pass.

## Documentation

- `docs/01-product-manifesto.md` — product principles
- `docs/02-foundation-architecture.md` — baseline architecture
- `docs/03-stories.md` — current backlog
- `docs/06-cloud-foundation.md` — deployed infrastructure
- `docs/07-jinn-002-1-private-portfolio.md` — first real action and acceptance criteria

No Railway, scheduler, public hosting, payment, third-party posting or autonomous tool chain has been added.
