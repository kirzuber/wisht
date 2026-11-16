# JINN-F03-004 — Staged release, rollback, and acceptance gates

Status: **PR #24 DRAFT. NOT DEPLOYED.** This is an engineering release procedure, not approval to change hosted Supabase, deploy, or retire client access.

## Risk found in Product Owner review

Previous F03-004 migration revoked `authenticated` EXECUTE on `create_wish_with_deed` during the same release that introduced `create_verified_first_value`. That breaks old SPA sessions and `saveFirstWish` fallback in the new bundle. The migration is now an **expand-only** step. The current F03-004 UI uses the signed server path for new Experience Plan Artifacts; legacy/fallback users keep the previous save RPC until an independently authorized contract phase.

**Security trade-off:** During coexistence, older clients can still submit an unverified initial `PREPARED` receipt through the old RPC. The new path does not trust browser receipts, but the legacy API remains temporarily callable. This is an explicit deferred risk; do not report complete elimination until the contract phase has actually executed.

## Phase 0 — prerelease evidence (no hosted changes)

1. Obtain Founder approval to proceed beyond this Draft PR. Ensure exact-head CI + local Auth/Postgres/browser pass.
2. Real configured provider smoke: `node scripts/eval-first-value-live.mjs` against local API, with EN book/career/frog and RU family-story inputs. Review **actual** plans/Artifacts/latency, locale, usefulness, unsupported facts and repetition. Fixtures are *not* quality evidence.
3. Actual-provider browser: `node scripts/test-live-first-value-browser.mjs` after starting local `npm run dev` with real `DEEPSEEK_API_KEY`. It refuses the deterministic model fixture and hosted DB; records actual plan/Artifact, prepare/save/reopen and screenshots.
4. Confirm hosted service-role key and supported schema only after Founder explicitly authorizes release review. Never put privileged keys into Vite/frontend and never record secret contents in test artifacts.
5. Audit current production fallback behavior and preserve a retrievable Netlify deployment for rollback; ensure backups/migration history verified before changing hosted schema.

## Phase 1 — expand safely (Founder approval required)

1. Apply **only** `supabase/migrations/20261116040000_f03_004_verified_first_value.sql` as an approved hosted migration. It adds the service-only `create_verified_first_value` and its minimum grants. **It does not revoke `create_wish_with_deed`.** Validate existing Wish listing/read and correction, existing client first-save RPC, and new service-only RPC reachability (without inserting a hosted test Wish unless specifically authorized).
2. Publish the atomic Netlify web + Functions release from the reviewed merge commit. Do not attempt a pre-schema web deploy; new server saving depends on the first-value function.
3. Smoke the existing saved-Wish reopen/correction, existing client or controlled fallback save, new first-use plan/artifact, signed Keep/save and reopen, four locales, and Jinn selection. Existing browser sessions stay compatible during rollout.
4. Observe browser/API errors and measure legacy `create_wish_with_deed` usage. If the client or Function release must be rolled back, restore the previous Netlify deploy **without database rollback**: the expand-only schema is additive and leaves the legacy RPC operational. Do **not** execute contract SQL in this phase.

## Phase 2 — contract (separate release + separate Founder authorization)

Only after all shipped clients/fallback paths use verified saving, and active older sessions are no longer expected to save: remove remaining `saveFirstWish` fallback callers in a separate code release; monitor/verify retirement window; then execute the explicitly reviewed, manually applied `docs/release/f03-004-retire-legacy-first-save.sql` against the approved environment. It is NOT placed under `supabase/migrations` and MUST NOT be automatically applied. Verify authenticated can no longer call the legacy RPC; verified server saving and historical reopen/corrections remain functional.

If urgent compatibility rollback is approved, `docs/release/f03-004-restore-legacy-first-save.sql` restores authenticated grant; it **reopens legacy receipt spoofing risk**. Revert only via an approved emergency procedure.

## Verified isolated integration cases

- Standard database fixtures survive both F03 migrations and server-only first-value save.
- Authenticated legacy client can still create a Wish **after** expand; previously saved Wish can still receive owner correction after expand.
- Only service_role can call `create_verified_first_value`, and generated first-value receipt remains signed at API.
- Simulated contract/restore scripts run **only in disposable PostgreSQL CI**, proving both operations and permission rollback.
- Local Playwright exercises actual client `saveFirstWish` compatibility, original signed save, reload, edit, reauth, and different-account isolation.

## Freeze and genuinely blind acceptance

Only after real-provider evidence and rollout readiness pass:
- Freeze `api/src/experiencePlan.ts` schema + component registry, `api/src/firstDeed.ts` prompts/validator, `web/src/FirstValueExperience.tsx`, and the exact PR HEAD SHA; capture SHA-256 of source in evaluator evidence.
- The Product Owner/Reality Checker supplies an **unseen** Wish *after* freeze; it is never shared with engineering beforehand.
- Review real-model actions, useful immediate Artifact, provenance honesty, visual hierarchy, locale and willingness to continue. No special-case handlers.
- If a generic repair changes any frozen source file, revoke the freeze and require a **different unseen Wish**.

**Gate state:** expand-only compatibility and deterministic tests can pass without a real-provider quality approval. Real-model evidence, Founder blind test, and Founder explicit merge/deploy authorization remain distinct required gates.
