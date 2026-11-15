# Wisht / Jinn

Jinn helps a person turn any Wish into a private, editable first Deed. This branch implements **JINN-F03-001**, a domain-neutral foundation reset on top of the existing React/Vite, Express/Netlify Functions, Supabase Auth/Postgres and server-side LLM stack.

## Local development

1. Install Node 22+ dependencies with `npm install`.
2. Start Docker and the local Supabase stack: `npx supabase start`. The checked-in `supabase/config.toml` includes a local email OTP template; messages appear at `http://127.0.0.1:54324`.
3. Put the **local** `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from `npx supabase status -o env` in `web/.env.local`. Export `LLM_PROVIDER` and a server-only DeepSeek or OpenAI key in the shell before starting the API. `.env.example` lists the variable names. Never use a hosted key for local acceptance tests.
4. From the repository root, run `node --env-file-if-exists=.env --env-file=web/.env.local --run dev` and open the Vite URL. This passes the local Supabase settings to both Vite and Express. Shell exports take precedence over the files, so clear any hosted `VITE_SUPABASE_*` exports first. Vite proxies `/api/first-deed` to Express.
5. Run `npm run typecheck`, `npm test`, `npm run test:db`, `bash scripts/rehearse-cutover.sh`, and `npm run build`. With local Supabase and Vite running, `npm run test:local-browser` exercises OTP/save/return/delete and captures screenshots; set `CHROME_PATH` if Chrome is outside the standard macOS/Linux locations. The browser test refuses a Vite bundle pointed at hosted Supabase.

The visitor can enter a wish and receive a private AI draft before sign-in. A verified email account can save, edit, reopen, continue, and delete the Wish. A structured allowlist renders document, checklist, and question sections. Every saved first or follow-up draft has an append-only Deed receipt marked `PREPARED`; no external action is implied.

For save and load failures, filter the browser console by `[Wisht] wish.`. Events show the operation, its outcome, and the database step, code and HTTP status when available. A schema error points to the F03 migration requirement.

## Architecture

- `auth.users` owns `jinns`, `wishes`, `deeds`, and `artifacts`. Foreign keys and RLS enforce same-owner access. The first Jinn is primary, while the schema allows additional Jinns later.
- A Wish stores generic intent and wish-local context. Deeds hold immutable input and action receipts. Artifacts hold editable content and an optimistic version. The workspace is a deterministic React projection of these records; no workspace table or arbitrary model-generated markup is used.
- Database functions save a first Deed atomically, apply an artifact correction, and append a follow-up Deed with a version and source-note check.
- The AI remains server-side. It proposes bounded drafts from user-supplied facts; a second grounding pass rejects unsupported personal claims. No browsing, sending, booking, publication, or cross-Wish memory is available.
- Legacy vertical runtime modules, scheduled watch, and domain-specific API functions are retired. Their SQL migration history is retained unchanged under `supabase/legacy-migrations` for audit and rollback planning.

**Hosted Supabase has not been cut over.** The fresh baseline migration in `supabase/migrations` is for new local projects only. Do not run `db push` against `wisht-dev`. The backup inventory, guarded transition SQL, rollback rehearsal, and approval gate are in [the F03 cutover report](docs/20-jinn-f03-foundation-reset.md). Production deployment must wait for a separately approved hosted data cutover.
