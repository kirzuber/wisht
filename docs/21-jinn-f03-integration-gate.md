# JINN-F03 — Single integration and release gate

Status: **integration candidate only; no authorization to merge or deploy.**
Target: one consolidated PR from `mira/f03-safe-live-persistence` to `main`.
Scope: F02 first-Deed UX + F03 generic runtime + additive `wish_records` fix. PRs #17 → #18 → #19 → #20 form a linear commit chain; do not merge intermediate incompatible heads into an auto-deploying `main`.

## Confirmed read-only evidence (15 November 2026)

- Git history: candidate branch descends from `main` without divergence.
- `wisht-dev`, project `qtegdpscfsbvuczvlgfw`, is healthy. Migration `20261115224928_f03_additive_generic_wish_records` appears in hosted history.
- Hosted `jinns`, `wish_records`, `deeds`, and `artifacts` exist with RLS enabled; they were empty at audit. Legacy `public.wishes` had 5 rows, `portfolios` 2, `portfolio_publications` 1. Legacy data is NOT migrated into new Wishes.
- `create_wish_with_deed`, `correct_artifact`, `append_prepared_deed` are `SECURITY INVOKER`. Their EXECUTE grants exclude `anon` and allow `authenticated`. Table SELECT grants exclude `anon`.
- Previous green Verify workflow on `650af84`: typecheck, unit tests, disposable database tests, build. A new regression seeds legacy `wishes` + composite-FK portfolios + publication + policy + trigger before the additive migration; **CI success on the updated head must be checked separately**.
- Kirill accepted the local user journey (sign-in, generic Wish list, first Deed, save and reopen). Browser evidence and deterministic fixture limitations are described in `docs/20-jinn-f03-foundation-reset.md`.

These observations do **not** establish the current code works against hosted Supabase via an authenticated browser.

## Required release gates (all blocking until evidenced)

1. **Integration integrity.** Compare candidate HEAD to `main`; no unexpectedly diverging commits, unreviewed files, or missing F03 fixes. Green Verify on exact HEAD: `npm run typecheck`, `npm test`, `npm run test:db`, `npm run build`. Verify the populated-legacy coexistence assertions actually ran.
2. **Deployment configuration.** Inspect Netlify build context and actual variables before release. The frontend and Netlify Function must use the same intended Supabase project. The publishable key can be exposed; **never** expose any `service_role`/secret key in Vite/browser variables. Confirm live provider credentials remain server-side and OTP callbacks match the deployed origin.
3. **Hosted acceptance with explicit founder approval.** On an approved controlled release/preview, verify real DeepSeek first-Deed response and vague-intent fallback; verified-email sign-in; initial save → list → reopen; edit → refresh → correction persisted; follow-up PREPARED Deed; sign-out → sign-in → reopen; deletion; second-owner access denial. Log exact environment/commit and actual HTTP/database results. Do not run `npm run dev` against hosted: the local-start guard is intentionally pinned to the local Supabase URL. No hosted test data may be created/deleted without approval.
4. **Legacy/public link disposition.** The legacy publication and storage objects still exist, but F03 app retires `/p/*` and specialized routes. Explicitly approve retirement/redirect/temporary compatibility before merge; retaining database rows alone does not keep old URLs functional.
5. **Abuse/cost protection.** Guest `/api/first-deed` invokes the paid LLM. Confirm an effective provider/edge rate limit and spending controls before broad public exposure; app-level code currently has no durable per-visitor limiter. Avoid claiming public launch readiness without this evidence.
6. **Receipt semantics.** Current `PREPARED` entries represent private drafts only. Client-supplied receipt fields and mutable follow-up artifact lineage are **not** trustworthy real-world execution history. Track remediation in JINN-F03-002; do not describe the current release as an action-executing agent.
7. **Founder signoff.** Kirill explicitly authorizes merge and deployment as separate actions after reviewing the above evidence. If `main` auto-deploys, a merge is effectively a deployment trigger and must not occur early.

## Authorized integration preparation (no deployment)

- Add and run the legacy-coexistence regression in CI.
- Make the additive path the sole current guidance; quarantine archive/rollback SQL as future, separately approved retirement material.
- Retarget PR #20 directly to `main` (or open one equivalent aggregate PR from the **same candidate head**), keeping historic PR #17–#19 for traceability. Do not merge or close them prematurely.
- Keep this gate linked in the PR description; request founder review before any merge/deploy.

## Rollback strategy for a future release

Since the additive database tables coexist with legacy tables, an application rollback should restore the previously deployed app version while **leaving the additive tables and legacy data intact**. Do not run `supabase/cutover/rollback-legacy.sql` for this release; that script addresses an older archive-and-rename design and would introduce unnecessary risk. Record the original deploy ID and retest old-user access and published URLs if compatibility has been explicitly retained.
