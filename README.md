# Wisht — Three wishes. Real work.

**Current scope:** a small wish-to-mission prototype. It selects supported missions but does **not** execute external actions.

## Local development

Node.js 22+ and npm 10+:

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
```

Open http://localhost:5173. Vite proxies /api to the local Express server at http://localhost:3001. For Netlify Functions emulation use `npx netlify dev`.

## Deployment

One Netlify site (React + TypeScript API Functions), one separate Supabase project `wisht-dev` (RLS-protected wish storage). Deployment status and exact settings: [docs/06-cloud-foundation.md](docs/06-cloud-foundation.md).

### LLM

Known aspirations are classified by deterministic catalog logic at no token cost. Unknown aspirations may be classified by one small external model, which can only choose existing skill categories. No model-generated tool execution.

Use `DEEPSEEK_API_KEY` and `LLM_PROVIDER=deepseek` (default `deepseek-flash`) **or** `OPENAI_API_KEY` and `LLM_PROVIDER=openai`. No API key means deterministic fallback. Never use `VITE_` for API secrets. Free-tier services require separate privacy and availability review before production.

### Supabase

Provide `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` at build time. Enable Anonymous Sign-ins in Supabase Auth. Only clicking **Save this wish** should start an anonymous session and insert a row. Browser-bound anonymous identities are not recoverable after cleared storage.

## Boundaries

No job monitoring, payments, publishing, long-running agents or real-world actions implemented yet. Keep sensitive wishes private, and do not present planned work as completed.
