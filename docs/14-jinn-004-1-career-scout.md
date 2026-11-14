# JINN-004.1 — Career Opportunity Scout

Status: IN REVIEW. Branch: feature/jinn-004-1-career-scout.

## Purpose
Prove that one wish/skill/receipt architecture works beyond photography, with an actual user-specific AI reasoning step. User aspiration: "I want a new career". Chosen deed: "Find my next opportunity."

## First supported journey
1. User chooses career opportunity scouting.
2. They provide a target role/specialty, country (CA/US/worldwide), and optionally a concise factual experience summary.
3. An indexed public remote-job source returns up to five actual candidate positions, with exact source link, unmodified application URL, company, location restrictions, employment type and salary when disclosed. No account is necessary to see them.
4. Optionally, the user **explicitly consents** to send their 650-character experience summary and excerpts of five job descriptions to the configured DeepSeek/OpenAI service for a bounded JSON fit assessment. Verified email sign-in is required before enabling this model call.
5. Jinn returns source-backed jobs and clearly marked advisory model reasoning. The user can save the shortlist to the existing or newly created career wish and later open it under My Wishes.
6. Saving generates a database-authored Work Receipt. No applicant account, outgoing message, job application, recruiter contact, or background monitoring is created.

## Real source
[Himalayas Remote Jobs API](https://himalayas.app/docs/remote-jobs-api):
- API: HTTPS GET https://himalayas.app/jobs/api/search with q, country or worldwide, sort=recent, page=1.
- No access key needed for limited public usage. Remote positions only. Data refreshed daily. Strict server-side URL/size/time bounds (8-second timeout; 2MB). Source outage and zero matches are honest errors/empty states.
- API terms: use exact applicationLink unchanged, credit Himalayas visibly and link to the original job on Himalayas, do not syndicate listings to other job aggregators. The UI observes those terms.
- All roles are **indexed** rather than independently employer-verified. Even before its expiry date a posting may close. Applicants must confirm the source is still open.
- The remote-only first source does NOT cover Toronto/hybrid/local government openings or the wider job market. A source adapter for local roles would be a later increment.

## Controlled AI use
- The ordinary source search runs without an LLM. One AI call is made **only if** the user selected and consented to analysis, entered at least 20 characters of experience, and proved an email-verified session with Supabase.
- Input: up to 650 user characters + at most five source job titles/descriptions; output only index-keyed fit labels (promising, possible, unclear) with short grounded explanation and uncertainty.
- API route validates all request sizes, checks JWT before the model call, IP rate-limits use via Netlify, and never exposes provider API keys to the browser.
- The model cannot add job records, dates, source links or credentials. If it fails, model fit remains **not assessed** while real source data is preserved.
- AI assessments are advisory. The app does not infer actual work eligibility, pay equivalence, skills or hiring decisions from model output. No personal experience profile is written to \`career_shortlists\`.

## Data and ownership
- \`public.career_shortlists\`: verified-account owner-RLS, same-owner wish FK, career-kind validation, 1..5 source-linked jobs, fresh fetched_at check and one saved shortlist per career wish per UTC day.
- Save reuses one career root among three wishes and never creates another wish for extra research.
- \`CAREER_SHORTLIST_SAVED\` Work Receipt is authored by a database trigger. Its factual claim is that an indexed job shortlist was saved, not that an employer validated a vacancy.
- User may delete saved career shortlists. Historic receipts remain. No job descriptions are published publicly.

## Acceptance
- [x] Automated TypeScript/test/build green.
- [ ] Live Himalayas API responds and yields real remote listings, or an honestly empty/error result.
- [ ] Anonymous search: enter career aspiration → Find next opportunity → role/country → source list.
- [ ] Opt-in AI: authenticated session required, explicit consent required, model returns advisory fit/no hallucinated job links; without consent no LLM call.
- [ ] Save: single career wish, one owner-owned shortlist/day, Work Receipt.
- [ ] My Wishes displays saved job source/application links; second user cannot access/modify entries.
- [x] Migration applied in wisht-dev and verified: enabled owner RLS, denied anonymous access/receipt writes, trigger and daily-uniqueness rollback test.
- [ ] No new watch/scheduler or automated job applications.
- [ ] PR reviewed/accepted locally before main merge.

## Following story and pause
JINN-004.2 Soccer Opportunity Scout will implement source-backed local soccer club/trial discovery with an equivalent evidence boundary. After that story is accepted, STOP feature delivery and review the holistic product, UX, architecture, AI scope, economics and MVP commercialization.

## Implemented and verified — November 14, 2026
- GitHub Actions CI after source URL normalization: https://github.com/kirzuber/wisht/actions/runs/43648286757 — passed TypeScript checks, tests and build.
- Supabase migration `20261115061000_career_shortlists.sql` applied to `wisht-dev`. Three owner-verified RLS policies enabled, anonymous direct read denied, authenticated receipt INSERT and receipt-writer EXECUTE denied. Both validation and database receipt triggers enabled.
- Rollback test on a verified account with an available wish slot: temporary career wish → one source-valid saved shortlist → exactly one `CAREER_SHORTLIST_SAVED` receipt with count 1 → duplicate same-day save rejected → full transaction rolled back. Post-test career shortlists and career receipts both zero. No original user data modified.
- Supabase security advisor: no new findings tied to career shortlists or its trigger; four prior project-level warnings remain.
- **Still unverified:** one genuine live Himalayas API fetch in the local application, consented DeepSeek fit on real descriptions, saved/reopened career shortlist in the browser, and another-account isolation by interactive login. User acceptance is required before merging PR #11.
