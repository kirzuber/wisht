# Wisht — Three wishes. Real work.

**Prototype only:** understands and plans wishes, but does not execute external missions.

## Local

Node 22+ and npm:

```bash
npm install
npm run dev
npm test
npm run typecheck
npm run build
```

Open http://localhost:5173. The Vite dev server proxies /api to local Express port 3001. Run `npx netlify dev` for production-style function routing.

## Deployment

One Netlify site hosts `web/dist` and `netlify/functions`. Supabase is a **separate** project with one owner-protected `wishes` table. The optional LLM classifier runs server-side only, after deterministic catalog routing fails. No secrets in `VITE_` variables. Deployment and configuration instructions: [docs/06-cloud-foundation.md](docs/06-cloud-foundation.md).

Local server credentials: `OPENAI_API_KEY`, optional `OPENAI_MODEL` (default gpt-4o-mini). Web public configuration (web/.env.local): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`. If no Supabase is configured, the experience runs but Save is unavailable. If no AI key exists, deterministic wish routing still works.

## Boundaries

No mission execution, third-party writes, payments, file uploads, or scheduler. Saving requires an explicit click, uses anonymous Supabase Auth, and is browser-bound until durable sign-in is added. Handle private wishes carefully. Read `docs/` for product manifesto, architecture and stories.
