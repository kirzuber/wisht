# JINN-F02-001 — First Real Wish

## Architecture inspected

Wisht already uses React/Vite, an Express API for local development, matching Netlify Functions in hosting, server-side DeepSeek/OpenAI chat completions, Supabase email OTP, and PostgreSQL with owner-scoped RLS. Existing `wishes` rows enforce a three-wish limit; photography, career, and soccer flows keep their own specialized work. The Netlify configuration builds only `main` in production and ignores branch deploys.

## Implementation

- The home form starts a guest first-Deed path for an arbitrary wish. One optional AI clarification may precede a real AI draft. Long, sufficiently specific wishes skip the question. “I'm not sure” is valid; Russian controls offer “Не знаю.” Existing specialized tools remain available from home and saved wishes.
- `/api/first-deed` reuses the existing LLM credentials and provider choice. It caps input, model tokens, request rate (Netlify), and response size. A server validator allows only documents, dependency checklists, and question lists. A second grounding review rejects drafts with unsupported personal facts or false action claims; failure is shown as failure, never as a prepared result.
- A deterministic React renderer provides an editable source note, artifact sections, unknowns, one next Deed, and a PREPARED receipt. It sends no messages, publishes nothing, verifies no outside fact, and runs no background work. Mobile places the next Deed before the artifact.
- “Keep this wish” requests the existing verified email account only after the draft is visible. The migration adds one owner-scoped `jinns` row and generic JSONB artifact, receipt history, Jinn link, revision, and update time to the existing `wishes` table. RLS protects reads/writes/deletion. A correction uses optimistic revision matching; a subsequent Deed first reads the current artifact on the server with the authenticated owner's JWT. No other wish's content is included.
- A saved wish opens from My wishes or a `?wish=<id>` link after reload. The user can correct, save, continue, review receipt history, or delete. Unsaved drafts are labeled as session-only. Saving a wish does not create cross-wish memory.

## Verification

- `npm run typecheck`, `npm test` (88 passing), and `npm run build` passed.
- `npm run test:db` passed against a disposable PostgreSQL 17 container: migration syntax, owner and anonymous RLS, cross-owner read/edit/delete denial, fresh-connection restore, corrected artifact persistence, and deletion. The test does not touch the hosted Supabase project.
- Local browser flow with a live DeepSeek result passed for a synthetic garden wish; it showed owner lookup first, unsent draft state, edit fields, save gate, and mobile layout. Live API checks also produced a houseplant observation log, a Russian vague-goal starter, and a request to send invitations that remained an unsent PREPARED draft.
- The first authorized family-book live result invented sensory details. The prompt was tightened and a grounding review was added. A second authorized live check then asked for one memory and returned a source-based interview kit with unknowns, no invented scene, and a PREPARED receipt. Unit tests verify that “Grandma” corrected to “Aunt” is absent from the next-Deed input.

## Screenshots

- [Wish entry](../screenshots/first-wish-entry.jpg)
- [Garden first Deed](../screenshots/first-deed-garden.jpg)
- [Mobile garden first Deed](../screenshots/first-deed-garden-mobile.jpg)
- [Save gate](../screenshots/keep-wish-auth-gate.jpg)

## Limits before product acceptance

The migration is included in the PR and has not been applied to the hosted database. The local browser therefore verified the guest draft and save gate, while database persistence was verified in isolated PostgreSQL rather than through a real OTP session. The model grounding review reduces observed false facts but remains probabilistic. A signed-in browser test of save, logout/login, corrected follow-up and deletion should be run after the migration is applied in a review environment. This PR does not merge or deploy the feature.
