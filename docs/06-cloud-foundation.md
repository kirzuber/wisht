# CLOUD-002 — Verification and inexpensive model routing

## Verified infrastructure (November 2026)
- GitHub `main` merged CLOUD-001; Netlify production deployment reported **ready** with `health` and `interpret` Functions.
- Separate Supabase project `wisht-dev` (`qtegdpscfsbvuczvlgfw`, Canada Central), `public.wishes` created, owner-only RLS enabled; security advisor no findings.
- Netlify site `wisht-dev` serves the production UI at https://wisht-dev.netlify.app.
- GitHub Actions Verify workflow is the CI gate for installing, typechecking, testing, and building frontend + API.
- **Not yet proven:** live HTTP smoke POST to `/api/interpret`, anonymous sign-in, and actual browser save/read flow. Do not claim these have passed until tested.

## Netlify configuration
Set in [Netlify site](https://app.netlify.com/projects/wisht-dev) → Environment variables:
- Build scope: `VITE_SUPABASE_URL=https://qtegdpscfsbvuczvlgfw.supabase.co`
- Build scope: `VITE_SUPABASE_PUBLISHABLE_KEY` = copy public publishable key from [Supabase API keys](https://supabase.com/dashboard/project/qtegdpscfsbvuczvlgfw/settings/api-keys)
- Functions scope (secret): `DEEPSEEK_API_KEY` = user-owned DeepSeek API key.
- Functions scope: `LLM_PROVIDER=deepseek`, `LLM_MODEL=deepseek-flash` (model optional).
- Alternative Functions scope: `LLM_PROVIDER=openai`, `OPENAI_API_KEY` and `OPENAI_MODEL=gpt-4o-mini`.
- Redeploy after changing build or Functions environment variables.

Supabase → Authentication → Providers → enable Anonymous Sign-ins. Be aware that anonymous users use Postgres `authenticated` role; owner RLS still applies.

## Reproducible checks
```bash
npm install
npm run typecheck
npm test
npm run build
npx netlify dev
```
```bash
curl -fsS https://wisht-dev.netlify.app/api/health
curl -fsS -X POST https://wisht-dev.netlify.app/api/interpret -H 'Content-Type: application/json' -d '{"wish":"I want to become a photographer"}'
```
Expected: health says `status:ok`, interpret returns `route:catalog` and `execution.status:NOT_STARTED`. An unknown aspiration routes via DeepSeek only when its API key is configured; otherwise it returns `fallback`. Inspect browser Save after setting Supabase build variables and enabling Anonymous Sign-ins; query `public.wishes` for a new row and confirm another anonymous account cannot read it.

## Release blockers and cautions
- Netlify connector currently refuses environment-variable writes (403); use Netlify UI and do not commit secrets.
- Local authoring container cannot reach npm registry; rely on GitHub Actions and your Mac for full npm/runtime checks.
- No true authenticated session persistence between devices; anonymous sign-in is prototype-only.
- No paid external actions, scheduled jobs, universal agent or mission execution. Only stored mission plans.
- Before public pilot: privacy notice for potential third-party LLM classification, provider data policy, cost caps, abuse protection, and user-accessible wish deletion UX.
