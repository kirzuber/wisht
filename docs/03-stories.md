# Product Stories — Git source of truth

## JINN-001 — The Wish Experience — SOURCE IMPLEMENTED; PACKAGE-INSTALL VERIFICATION PENDING

**As a first-time visitor**, I can write any aspiration, discover what Jinn can actually help accomplish, select a concrete mission and provide just one small piece of context—without registration or a generic chat flow.

Acceptance:
- [x] Minimal mobile-first opening with “Who do you want to be?” and unobtrusive suggestions.
- [x] Free-text input accepted; intent router uses supported capability registry.
- [x] Career, photographer, soccer, independence, financial, playful and private-sensitive route examples.
- [x] Capability revealed *before* first contextual question.
- [x] Exactly one question per selected mission; concise choice input.
- [x] Explicit deliverables, prerequisites and permission boundaries in the mission contract.
- [x] Unsupported wishes do not receive fabricated promises.
- [x] No fake completion / Work Receipt; zero wishes consumed.
- [x] API and router test sources, build and run scripts created; TypeScript syntax check and routing smoke tests passed.
- [ ] Full npm install, typecheck, browser visual review and build test (blocked in artifact environment: registry DNS unavailable).
- [ ] Human visual and interaction acceptance on laptop and mobile (owner review).

**Out of scope:** actual file upload, tools, public research, LLM, background job, Work Receipt and publish.

## JINN-002 — First Real Action — NEXT PRODUCT STORY

**As a photographer**, I can upload 5–15 photos and receive a real private portfolio page, verified for usable rendering. After reviewing it I may approve public publication under a hosted product URL.

Acceptance:
- Actual upload, constrained type/size and ownership; deletion option.
- Deterministic image dedupe/thumbnail generation, with a small-model or vision analysis only if justified.
- Real private artifact preview and basic human edits.
- Working publication operation behind exact user approval; verified URL and unpublish.
- Traced status, costs, errors and action evidence.
- No false claim that a portfolio is live before publication verification.

## JINN-003 — Work Receipt + Second Wish

**As a user**, I can inspect what actually happened and ask Jinn to take an appropriate next step; for photography, it can identify verified public portfolio opportunities.

Acceptance: structured receipt with source/artifact evidence, statuses, action ID/URL and costs; feedback/refinement; photography opportunity research on permitted source(s).

## CLOUD-001 — Cloud Infra and Deployment — AFTER JINN-001 acceptance

**As the owner**, I can deploy the independently tested UI and API using the agreed minimal stack, with CI/CD from merged main only.

Planned actions (not performed):
1. Create Netlify frontend and Railway API services.
2. Configure env and production API origin, HTTPS and strict CORS.
3. Add GitHub Actions checks for PRs; deploy only main merges.
4. Connect Supabase once the first real file/goal persistence story requires it; restrict service keys server-side.
5. Add smoke checks for `/api/health` and the onboarding flow.
6. No production deployment of autonomous write actions until permissions and verification exist.

## LATER — real agent engine

Persistent goal/mission state, job queue, opt-in monitoring, use-based billing, approved third-party integrations, user deletion and per-mission budget governor. These are architecture destinations, not near-term stories.


## CLOUD-001 — One deploy + private wish storage + selective LLM
One Netlify app hosts React and API functions. Supabase stores explicit saved wishes with owner RLS. LLM is used only for catalog-unsupported inputs, and can never invent a skill or run a mission. No Railway or background workers. See docs/06-cloud-foundation.md.
