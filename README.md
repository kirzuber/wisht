# Wisht / Jinn

Jinn helps a person turn any Wish into a private, editable first Deed. This branch implements **JINN-F03-001**, a domain-neutral foundation reset on top of the existing React/Vite, Express/Netlify Functions, Supabase Auth/Postgres and server-side LLM stack.

## Local development

1. Use Node 22.9 or later and install dependencies with `npm install`.
2. Start Docker and the local Supabase stack with `npx supabase@3.1.0 start`. A fresh local stack applies the generic F03 migration automatically. Sign-in codes show up in Mailpit at `http://127.0.0.1:54324/`.
3. Set `LLM_PROVIDER` and the matching server-only AI key in the root `.env`. Use `.env.example` for the variable names.
4. From the repository root, run `npm run dev` and open `http://localhost:5173/`. Startup checks the local F03 schema and passes the local Supabase URL and publishable key to both Express and Vite, overriding any hosted values in the shell or env files. If the schema check fails on an older local database, inspect its migration state and preserve any local data you need before upgrading or recreating it. Startup does not reset the database.
5. Run `npm run typecheck`, `npm test`, `npm run test:db`, `bash scripts/rehearse-cutover.sh`, and `npm run build`. With local Supabase and Vite running, `npm run test:local-browser` exercises OTP/save/return/delete and captures screenshots; set `CHROME_PATH` if Chrome is outside the standard macOS/Linux locations. The browser test refuses a Vite bundle pointed at hosted Supabase.

The visitor can enter a wish and receive a private AI draft before sign-in. A verified email account can save, edit, reopen, continue, and delete the Wish. A structured allowlist renders document, checklist, and question sections. Every saved first or follow-up draft has an append-only Deed receipt marked `PREPARED`; no external action is implied.

Filter the browser console or dev terminal by `[Wisht]` for drafting, sign-in and Wish storage events. Errors include a code and HTTP status when available. Express also logs the provider status for rejected AI requests. Local sign-in codes appear in Mailpit, which is linked from the verification screen.

## Architecture

- `auth.users` owns `jinns`, `wish_records`, `deeds`, and `artifacts`. Foreign keys and RLS enforce same-owner access. The first Jinn is primary, while the schema allows additional Jinns later.
- A Wish stores generic intent and wish-local context. Deeds hold immutable input and action receipts. Artifacts hold editable content and an optimistic version. The workspace is a deterministic React projection of these records; no workspace table or arbitrary model-generated markup is used.
- Database functions save a first Deed atomically, apply an artifact correction, and append a follow-up Deed with a version and source-note check.
- The AI remains server-side. It proposes bounded drafts from user-supplied facts; a second grounding pass rejects unsupported personal claims. No browsing, sending, booking, publication, or cross-Wish memory is available.
- Legacy vertical runtime modules, scheduled watch, and domain-specific API functions are retired. Their SQL migration history is retained unchanged under `supabase/legacy-migrations` for audit and rollback planning.

**Hosted `wisht-dev` has the additive F03 tables** (`jinns`, `wish_records`, `deeds`, `artifacts`) installed alongside preserved legacy tables. PR #20 application changes must still be merged and released to make the new saved-Wish UI work there. Never run a blind hosted `db push` or archive/rename the legacy tables; their eventual retirement remains separately approval gated. See [the F03 report](docs/20-jinn-f03-foundation-reset.md).

### Local branch and schema alignment

For the safe non-destructive F03 integration, use branch `mira/f03-safe-live-persistence` (PR #20), not the older `codex/jinn-f03-001` branch. The generic schema is `public.wish_records`, and the legacy table `public.wishes` remains in hosted `wisht-dev` intentionally.

The development startup is **local-only**, using the Docker Supabase stack at `http://127.0.0.1:54321`; it does not connect to the hosted project. Run `npx supabase@3.1.0 start` first, then `npm run dev -- --check`. The check reports CLI failures and missing schema objects separately. If the local database predates the `wish_records` migration, inspect `npx supabase@3.1.0 migration list`. A local reset discards local data, and must be explicit; no automatic reset, no hosted reset or hosted `db push`.

## F03-003 development branch (review only)

The **Multi-Jinn Creation** story is in draft PR #21, branched from the F03 integration candidate. It is **not deployed**; PR #20 must be released separately before any F03-003 go-live.

- F03-003 adds `supabase/migrations/20261115234000_f03_003_jinn_management.sql`, a small additive migration that allows owner-only Wish reassignment and deletion of empty non-primary Jinns. **Do not apply this migration to hosted `wisht-dev` without Kirill's approval.**
- For a **fresh** disposable local Supabase project, `npx supabase@3.1.0 start` loads both canonical migrations. For an **existing local** stack, inspect `npx supabase@3.1.0 migration list` and apply only the pending migration with `npx supabase@3.1.0 migration up`. Local data should not be reset automatically.
- Verify `npm run dev -- --check`, then `npm run typecheck && npm test && npm run test:db && npm run build`.
- Run `npm run dev` in another terminal, then `npm run test:local-browser` (baseline regression) and `npm run test:local-jinns` (F03-003 browser acceptance); browser tests use **real local Supabase Auth/Postgres** with deterministic LLM fixtures and refuse a hosted Vite bundle. Screenshots are captured under `docs/evidence/f03-003/`.
- `My Jinns` allows create/rename, optional **descriptive-only** purpose, a per-Jinn Wish collection, a named companion in the Wish workspace, explicit reassignment, and deletion of only empty, nonprimary Jinns. Purpose does not modify LLM instructions, grant cross-Wish memory, or enable external action.
- Multi-Jinn does not change today's prepared-only Deed semantics. Artifact preservation per separate Deed and server-authoritative receipts belong to F03-002.

No merge, deployment, hosted SQL, or destructive action has been authorized for this story.
