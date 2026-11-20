# F04-001 trusted continuation evidence

## Scope and boundary

Branch `codex/f04-001-trusted-continuation` starts from `origin/main` at `57cac9f`. This slice adds a reviewed next Deed for a signed-in owner of a saved Wish. The browser can propose, edit the request, explicitly start, resolve an ambiguous save, and reopen each independent Artifact. It cannot set the actor, receipt, verification marker, recorded time, or saved status.

The authenticated API reads only that owner's Wish, assigned Jinn, latest Deed, latest source Artifact, and Wish-local context. An HMAC binds the reviewed plan to those IDs and revisions and the edit request. The service-role RPC locks and rechecks them before one transaction inserts the Deed and Artifact. A second server-derived fingerprint binds the request key to that approved action and source/context/Jinn snapshot. Identical retries return the same IDs; different signed actions with the same key return 409. New First Deeds snapshot the actual Jinn ID and name in the database insert trigger. Older Deeds without actor data display Unknown Jinn; they are not backfilled or attributed from the current assignment. Historical F03 receipts remain visibly unverified rather than receiving an inferred F04 marker.

## Verification

| Gate | Result |
| --- | --- |
| Typecheck, 71 API tests, production build | Pass |
| Disposable Docker Postgres: migration, owner RLS, forged marker denial, first-actor snapshot and legacy unknown, correction revisions, atomic save, identical replay, conflicting fingerprint, stale context/Jinn, two-account isolation, concurrent same key | Pass |
| Fresh isolated Supabase reset through all five migrations, security advisor warnings | Pass; no advisor findings |
| Deterministic local Auth/API/browser on ports 55321, 55322, 55324, 3301, 5573 | Pass; [machine evidence](deterministic-browser-evidence.json) |
| Approved real DeepSeek `deepseek-flash` run on the **synthetic** Sunday pancakes with Aunt case; isolated local Supabase only | Pass after grounding revision; [machine evidence](actual-provider-evaluation.json) |

The deterministic browser covers Grandma-to-Aunt source correction, a 150–250-word chapter, two independently reopenable/editable Artifacts, First and second Deed attribution after Jinn reassignment and rename, refresh and reauthentication, identical replay and lost-response recovery, a different signed action with the same key returning 409, simultaneous identical API requests producing one pair, forged fields, stale proposal, four locales, desktop/mobile, an unsent garden permission enquiry, and an unrelated hand-lettering Wish. Its model output is a loopback fixture, so it is wiring evidence rather than prose-quality evidence. Screenshots: [desktop history](desktop-history.png), [mobile next step](mobile-history.png), [mobile Artifact](mobile-artifact.png), [garden draft](garden-unsent-draft.png).

The real-model run saved one verified second Deed and independent second Artifact (IDs and receipt in the machine evidence), then reopened the second Artifact after sign-in and refresh. The primary chapter is 250 words; the separate guidance note is 94 words. The chapter uses the supplied Aunt memory and leaves maker, location, repetition, conversation, and sensory details explicitly open. [Rendered second Artifact](actual-provider-second-artifact.png). The final run used 12 model calls: 16,350 prompt tokens (8,704 cache hits, 7,646 misses) and 2,160 completion tokens. The estimated model cost is **US$0.002469** using [DeepSeek's published Flash off-peak token rates](https://api-docs.deepseek.com/quick_start/pricing/) checked on 2026-11-20; actual billing may differ. Browser timings for initial plan, initial prepare, first continuation proposal, edited proposal, and execution are recorded in the JSON.

The first real attempt exposed a content failure: the model inferred that Aunt made the pancakes and placed her in a kitchen. [First attempt evidence](actual-provider-first-attempt.json) is retained. The drafting and independent grounding prompts now explicitly reject implied maker, setting, repetition, and feelings. On the revised attempt the chapter keeps those details unknown. The initial browser runner also used a hidden textarea locator and then raced the local OTP handoff; those runner errors were corrected. A model reviewer remains fallible, so these checks do not prove all future prose is grounded.

## Release boundary

No hosted database was changed, and this branch must not be self-merged. A Netlify preview of earlier commit `9221c15` was published before the Senior Developer review; it does not include these fixes or a migrated staging database. The review-fix commit restores the production-only Netlify build rule, so it is not a new preview deployment. Before hosted rollout, reconcile the F03 migration history drift identified in issue #27 (local `20261116040000` / `20261116170000` versus hosted `20261116235703` / `20261116235708`), review migration and rollback readiness, and apply migrations through the normal controlled release. The local migration and tests do not authorize a hosted `db push`.
