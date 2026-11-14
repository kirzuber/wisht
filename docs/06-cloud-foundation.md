# CLOUD-001 — One Netlify app + Supabase + selective LLM

Status: feature branch, cloud setup incomplete.

## Topology
- One repo, one Netlify site: Vite `web/dist` + serverless `netlify/functions`. No Railway.
- Express API stays for local `npm run dev`; Netlify exposes the same `/api/interpret` endpoint, importing the same catalog.
- Separate Supabase project for Wisht, one `wishes` table with owner-only RLS and optional anonymous auth.
- Cheap LLM classifier called only for wishes not matched by the deterministic catalog. Model can select known kinds, never author new skills. No external actions.

## After PR merge
1. Connect the existing Netlify project `wisht-dev` to GitHub `kirzuber/wisht`, production branch `main`. `netlify.toml` configures build and functions.
2. Confirm Supabase organization. Create a **separate** project; do not reuse consulting-workbench-dev. Apply `supabase/migrations/20261114000000_create_wishes.sql` and verify RLS.
3. Enable Supabase Auth anonymous sign-in. Browser-bound anonymous sessions are not durable identities.
4. Netlify environment variables: server Functions scope `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default gpt-4o-mini); build scope `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Never expose a Supabase service role key to the client.
5. Validate locally: `npm install`, `npm run typecheck`, `npm test`, `npm run build`, `npx netlify dev`. Verify deployed `/api/health` and `/api/interpret`.

## Scope boundaries
- No scheduler, payments, file uploads, background work, broad account permissions, external writing, or agent actions yet.
- Only Save triggers account creation and database insertion. The content is sensitive; the UI discloses that unknown wishes may be processed by an AI provider.
- Implement stronger abuse mitigation before public launch; function IP rate limit is an initial guard only.
