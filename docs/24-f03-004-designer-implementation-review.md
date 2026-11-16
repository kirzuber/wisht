# F03-004 — Designer reference review and implementation comparison

**Status:** Draft PR #24; no merge, no deployment. Engineering screenshot evidence uses an isolated local model fixture, **not a live DeepSeek quality evaluation**.

## Source deliverables reviewed

1. **[Visual interaction reference (Canva)](https://www.canva.com/d/_a2U8QfjK6iQtv6).** The directly shared `/d/` edit shortlink did not resolve via the connected Canva design lookup, so the matching six-page account design titled *Wisht/Jinn UX Demo — One Grammar, Any Wish* was inspected through Canva's page/content tools. It presents a Wish-first warm Jinn, one consequential choice, a proposed bounded Deed, a document-as-hero reveal, explicit save/return, and other-Wish compositions.
2. **[Generative Experience Grammar](https://docs.google.com/document/d/1Ufijwl3gpMnsEPApQ9W-5-LvwCBNwKHCsNwfaIe3tqY/edit)** — the model reasons about arbitrary Wishes, can ask 0–3 optional consequential questions, chooses a feasible outcome and a bounded composition, and never asserts unperformed external actions or invented personal facts.
3. **[Implementation Handoff](https://docs.google.com/document/d/1zDvnALLCXHoSFTej4dPdOeQUFRASamB_03ThE_KvdTY/edit)** — versioned safe component manifest, server authorization, read-first artifact, clear prepared versus saved state, cross-Wish isolation, and genuine independent blind acceptance only after freeze.

**Do not interpret the Canva book content as a runtime template.** The entire artifact is chosen by the LLM from the literal Wish, selected Jinn and optional answers, with generic document/checklist/question sections.

## Visual/interaction traceability

| Designer state | Implemented state | Actual screenshot |
| --- | --- | --- |
| A. Wish and one optional high-information question | Existing wish-first Jinn shell; plan-generated ChoiceChips with Other, Not sure and Skip, keyboard-accessible | `first-question-desktop.png` |
| B. Selected First Deed (proposed, no action yet) | AI-chosen outcome and private-draft boundary; explicit “Let Jinn prepare it” and “Change the plan” | `deed-proposal-desktop.png` |
| C. Reveal an immediately readable main Artifact | Model-composed ArtifactReader, editable on demand; visible “Based on your Wish” and “AI suggestion · Not verified” badges, collapsed supporting/source/receipt | `first-artifact-desktop.png`, `first-artifact-mobile.png` |
| D. Keep and reopen in the same account and Wish | Server-verified atomic save; saved badge follows acknowledged database write, edit/reload and re-auth verified | `saved-return-desktop.png` |
| E. Adaptation to other Wishes | Model chooses outcome, sections and safe component order from one registry, not user intent categories | Unit contract tests; **real-model output still pending** |

**Screenshot archive:** [GitHub Actions #43813645629 — jinn-browser-evidence](https://github.com/kirzuber/wisht/actions/runs/43813645629/artifacts/14201457114) (five actual browser screenshots, desktop and mobile). Capture includes no hosted user data; the demo text is an intentionally deterministic local fixture, and is **not** presented as an impressive live AI output.

### Design correction made after screenshot inspection

- The first question panel initially inherited dark-on-dark label styles, and the Artifact title inherited near-white text on an ivory card. Both are corrected with scoped styles; revised screenshots were inspected.
- The initial implementation prepared immediately after the question. The revised flow shows an explicit **proposed Deed** between optional question and generation, matching Canva's bounded execution decision.
- No new specialized workspace, table or Wish category was introduced. Existing navy/lavender, cream paper, glowing Jinn, typography, and one dominant artifact panel remain.
- The first user action remains a Wish. Secondary material and work receipt are collapsed; the source and suggestion labels are visible at first reveal. Mobile renders a single column.

## Frozen-candidate engineering boundary (not frozen until live-model gate)

- **Schema and component registry:** `api/src/experiencePlan.ts` — `version:1`, allowed `jinn_identity`, `choice_chips`, `deed_proposal`, `artifact_reader`, `source_status`, `supporting_section`, `work_receipt`, `next_deed`; allowlist only; no executable HTML/JS/actions.
- **AI prompts/grounding:** `api/src/experiencePlan.ts`, `api/src/firstDeed.ts` — explicit locale, capability manifest, unknowns and external-effect limitations.
- **Reader:** `web/src/FirstValueExperience.tsx` — trusted React registry, model supplies data and order, not code.
- **Persistence:** `api/src/firstDeed.ts` signed prepared work, `web/src/firstWishStore.ts` authenticated save, additive `supabase/migrations/20261116040000_f03_004_verified_first_value.sql`. Hosted migration **not applied**. New initial save RPC is service-only, old client-supplied first receipt path revoked at release. Preserve legacy Wish tables, RLS, historical Artifacts.
- **Tests:** `api/test/experiencePlan.test.ts`, `scripts/test-local-first-value.mjs` (local verified Auth/Postgres and model fixture), `scripts/eval-first-value-live.mjs` (real configured model evaluator; not yet executed).

## Scope boundaries and remaining acceptance gates

- No hardcoded book/career/frog/keys routing. No comparison grid, interactive tracker, creative fork, web browsing, image generation, export, scheduled jobs or outgoing communications; a structured readable artifact is the supported fallback.
- No automatic next-Deed execution or external side effects. Later F03-002 independent Artifact history remains separate.
- EN/RU/FR/ES interface copy and locale-specific AI contract are maintained; direct Ukrainian input is not automatically treated as Russian.
- **Engineering CI/browser gate:** passed on the cited commit. **Real-model gate:** still required to evaluate meaning, actual generated Artifact, 0–3 necessary questions, language compliance, latency and cost. No "WOW" or human acceptance claim from fixture screenshots.
- **Blind gate:** founder/reviewer chooses a completely unseen Wish **after** exact schema, prompts, registry and PR commit freeze. No bespoke patch against the blind Wish.
- **Release:** owner must explicitly authorize both merge and hosted migration/deployment, with a safe migration-to-code rollout order.

This report is evidence of visual and functional alignment, **not** an assertion that emotional first value has been achieved.
