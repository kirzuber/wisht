# Agent Action Lab — initial candidates

The user's wish is unlimited; the execution skill catalog is not. Avoid a list of 15 impressive-looking half-capabilities.

| Candidate skill | Evidence of *actual work* | Permission | First investment |
|---|---|---|---|
| Build private photo portfolio | Real private gallery from supplied images | Read supplied; create private | **JINN-002** |
| Publish owned page | Verified user-approved hosted URL, reversible | Per-action publish | **JINN-002** |
| Photography opportunity scout | Source-checked exhibition/contest opportunities | Public read | JINN-003 |
| Career opportunity scout | Verified job URLs, dedupe, match rationale | Public read | Follow-on |
| Tailored job application | Real editable resume/application files | User file read | Follow-on |
| 10-day job watch | Time-stamped new matches, actual monitored sources | Public read + scheduling opt-in | Follow-on |
| Soccer club scout | Real verified clubs/official registration links | Public read; region | Test routing |
| Practice schedule | Real downloadable calendar file | Create private | Follow-on |
| Independent offer page | Editable page then approved publication | Private create / exact publish | Reuse portfolio publisher |
| Public profile to portfolio | User-confirmed GitHub/public URL backed by permitted API facts | User-provided public read | Follow-on |

## Differentiation gate

The Jinn must reduce effort between *wanting something* and obtaining a **verifiable** result. An LLM paragraph doesn't satisfy this. A cached public opportunity with a valid registration path can. A shareable hosted page, after approval, certainly can.

## Experiment fixtures

- “I want to be a photographer” → supported skill menu → photo location question → planned portfolio contract.
- “I want a new career” → supported menu → career direction question → planned sourcing contract.
- “I want to play soccer” → club/plan/watch menu → level question → planned action.
- “I want to be independent” → offers personal offer/scout/public presence.
- “I want to be a millionaire” → no wealth promises or investing actions.
- “I want to be a woman” → discreet private exploratory assistance; no assumed medical transition, profiling or disclosure.
- “I want to be a king” → playful leadership or fictional creative artifact.
- “I want to be a frog” → fun original creative artifact or legitimate nature research.
- Arbitrary fantasy → no fabricated capabilities or mock completed work.

## Work Receipt contract — upcoming

`mission_id`, `status` (FOUND / CREATED / PREPARED / EXECUTED / VERIFIED / FAILED), `started_at`, `completed_at`, `skill_id`, `cost_usd`, `evidence`, `artifacts`, `external_action_ids`, `approval_history`, `explicit_non_actions`.

Nothing is a “completed mission” until verified by the owning tool/skill.
