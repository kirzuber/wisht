# JINN-UX-03 — Next Meaningful Action

Status: IMPLEMENTED ON FEATURE BRANCH — CI AND OWNER ACCEPTANCE PENDING

## Product goal
After a **real, confirmed deed** Jinn briefly acknowledges the result and suggests one useful continuation. No lengthy checklist, no feature menu, no invented autonomy, and no additional login or model calls just to recommend the next step.

## Implemented transitions
| Confirmed deed | Suggested continuation | Execution boundary |
| --- | --- | --- |
| Photography shortlist saved | Prepare a submission draft for the currently viewed, already saved listing | In-app JINN-003.3; user reviews organizer rules and selects a gallery. No actual submission. |
| Career shortlist saved | Open the currently viewed source application page | Browser link to provider/employer; Jinn does not apply. |
| Soccer shortlist saved | Open the currently viewed club's official program page | Browser link; Jinn does not register the user or guarantee an open tryout. |
| Photography portfolio published | Find public photography opportunities linked to the same wish | In-app JINN-003.2; Jinn searches public listings, not organizer-verified opportunities. |

## Rules
- Suggestions appear only after successful Supabase shortlist insert or confirmed published gallery state. Never show a completed-deed suggestion from a mere anonymous search, failed save, or unexecuted mission plan.
- The photo shortlist flow keeps the inserted **shortlist ID**, the same parent wish ID and a selected **source opportunity ID**. This is required by the existing owner-verified SubmissionPrep route; no new data or permission bypass.
- All source-specific external URLs are those already present in the saved result set; these open new tabs. Do not assert an application, contact, or registration happened.
- A single, compact `NextDeed` panel offers one action; My Wishes remains available. No marketing or generic suggestions, more UI steps or artificial LLM calls.
- The mapping is deterministic in `web/src/nextDeedPolicy.ts`, with tests. No new database migration, LLM, automation, provider or infrastructure.

## Acceptance
1. Photography: run a real source search, save the shortlist with a verified account, view the suggestion, click **Prepare a submission draft**. Confirm the exact saved wish/shortlist/opportunity opens in the existing rules-review preparation journey. No submission occurs.
2. Career: save a shortlist, see one external application action for the currently viewed role; confirms outbound destination, not an application status.
3. Soccer: save a shortlist, see one official club-program link; no claim of places or registration availability.
4. Published photo gallery: reopen or publish a gallery and click **Find photography opportunities**. Confirm it opens the Scout under the same photography wish, without consuming a new slot.
5. A failed save, anonymous browse, empty source response, or preview-only work must never display a completed-deed suggestion.
6. Confirm Work Receipts and My Wishes still function; no automatic external action. Screen should remain brief on desktop and mobile.
7. CI typecheck, tests, build green. Owner browser acceptance **before** merge or production deployment.

## Intentionally deferred
Broader personalization, ranking next actions with an LLM, outreach and auto-application, external club registrations, email notifications, or multi-step orchestration. Review the user value of these suggestions before expanding.
