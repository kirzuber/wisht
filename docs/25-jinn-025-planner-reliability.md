# JINN-025 planner reliability

## Root cause

[Issue #25](https://github.com/kirzuber/wisht/issues/25) records different failures at planning and Artifact preparation. Netlify confirmed HTTP 422 `experience_plan_invalid` for request `01M7KKDF6SY9JHVB305XF22RDD` at 2026-11-17 01:54:46 UTC on the PR #30 deployment. That request has no field-level telemetry. The nearby `required_copy_invalid` event does not establish which field failed in that request.

I reproduced **five planning 422s in 12 new synthetic Wishes** on the deployed planner (commit `0b18b05`, planner unchanged at current main `3d357fc`). All 28 DeepSeek calls returned HTTP 200, `finish_reason=stop`, and parseable JSON. The required fields below exceeded their caps after trimming, with no excess whitespace or formatting to remove. The normalizer correctly retained the authored meaning. Strict validation then rejected the result, and both attempts failed before feasibility review.

| Reproduction | First candidate | Repair candidate |
| --- | --- | --- |
| RU learning B04 | `firstOutcome` 209/200 and `deed.result` 235/220 | `deed.result` 339/220 |
| EN career B05 | `firstOutcome` 262/200 and `deed.result` 397/220 | `deed.result` 297/220 |
| EN learning B09 | `deed.result` 350/220 | `firstOutcome` 226/200 |
| RU organization B10 | `deed.result` 247/220 | `firstOutcome` 208/200 |
| RU travel B12 | `deed.result` 260/220 | `deed.result` 232/220 |

The PR #30 response contract asked the model to stay “within the stated limits” without giving numerical caps for these fields. The planner now states the exact limits from the same constants used by strict validation. The existing single repair receives the failing field, reason, and cap. The diagnostic contains only allowlisted metadata. This path does not clip prose, change strict inbound/saved validation, add model attempts, or bypass feasibility or grounding. DeepSeek JSON mode covers syntax, while field limits and semantic checks are enforced in the app. [DeepSeek JSON Output](https://api-docs.deepseek.com/guides/json_mode/)

## Live verification

The holdout used 24 previously unused synthetic Wishes (12 EN / 12 RU) across planning, creative writing, learning, home, work, communication, decisions, travel and community. It used the configured `deepseek-flash` provider through the app request handler, including parsing, normalization, feasibility, preparation, grounding and local receipt signing. Every optional answer was skipped. Signed preparation is distinct from saving. The 24 holdout Wishes were not saved. The independent Playwright test below exercises real local Auth and persistence.

| Metric | Baseline, 12 (planning only) | Fixed holdout, 24 |
| --- | ---: | ---: |
| Plan valid on first attempt | 3/12 | 24/24 |
| Plan valid eventually | 7/12 | 24/24 |
| First Deed valid on first attempt | — | 23/24 |
| First Deed valid eventually, with signed proof | — | 24/24 |
| Technical HTTP 422 | 5 | 0 |
| Grounding rejections | — | 1 draft attempt, recovered; 0 terminal |
| Plan latency median / p95 | 5.08 / 6.39 s | 3.14 / 3.88 s |
| Preparation latency median / p95 | — | 7.26 / 9.00 s |
| Plan + prepare median / p95 | — | 10.35 / 12.88 s |

In a separate matched run of the 12 baseline Wishes, the corrected planner passed all 12 on the first attempt, with zero 422s. Planning median / p95 was 3.34 / 3.87 seconds. The matched run cost **$0.005408** over 24 calls.

The Russian tool-return note H02 failed the first grounding review with `promise_unfulfilled` and passed the one bounded repair. No fallback worksheets were returned. Latencies are wall-clock measurements in the local request handler, with nearest-rank p95. EN passed 12/12 end to end on first attempt, while RU passed 11/12 on first attempt and 12/12 eventually.

Provider cost uses DeepSeek-reported token counts, including failed and retry calls, at published USD peak rates for the test window (02:01–02:11 UTC on November 17, 2026). Baseline planning was **$0.008331** over 28 calls (19,456 cached input, 8,892 uncached input, 4,622 output tokens). Holdout was **$0.050738 total**, about **$0.002114 per Wish**, over 98 calls (55,424 cached input, 66,631 uncached input, 25,347 output). Combined cost for baseline, matched, and holdout runs was **$0.064477**. These are usage-derived charges before any account credits or balance adjustments. [DeepSeek pricing](https://api-docs.deepseek.com/quick_start/pricing/)

**Substantive usefulness remains a separate acceptance gate.** The holdout produced concrete work such as a fictional radio opening, a practice exercise with answer keys, and an editable note asking about class instructions. Inspection also found failures that HTTP 200 and the grounding verdict missed. B23 thanked a supplier for sending a sample the Wish never said had arrived. B14 asserted specific team editing practices that were not supplied. The repaired H02 invented a reason for needing the tool and a prior favor. B19 conflated reheating safety with texture and did not make its safety score a hard veto. H07 surfaced an internal question ID, and H12 still depended on multiple walking stops despite the requested alternative to a long walking tour. These are examples from a manual inspection, not an independent product acceptance score. The narrow planner fix leaves the reviewers unchanged.

## Unsaved Artifact

PR #29 was open during incident triage but is now merged at `3d357fc`. Netlify reports that its production deploy `6afbb49181fadbcac06c5806` was published at 2026-11-17 01:57:55 UTC. There is no new frontend change in this PR.

Playwright used the same deterministic model fixture and real local Supabase Auth and Postgres on each revision. On the PR #30 revision (`0b18b05`), the prepared reader disappeared after changing locale and waiting one second. On current main plus the planner fix, the same text stayed visible after waiting, switching RU and back to EN, and refreshing the authenticated session. No extra plan request ran. Keep, verified save, reload and reopen then passed, along with the existing edit, reauthentication and owner-isolation assertions.

Typecheck, 66 automated tests, disposable database tests, build, and the current-main browser regression passed. No production requests were sent for evaluation. No deployment, hosted database writes or merges were performed in this investigation.
