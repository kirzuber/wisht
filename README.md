# Wisht — Three wishes. Real work.

Wisht is an early wish-to-action prototype. **Only photography private portfolio creation is executable.** Other mission cards remain plans, not performed actions.

## Run locally

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

Open http://localhost:5173. Vite proxies `/api` to Express at http://localhost:3001.

Use `web/.env.local` for `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` (public, **not** the Supabase secret key). For the local Express LLM classifier, export `LLM_PROVIDER=deepseek`, `DEEPSEEK_API_KEY`, and optional `LLM_MODEL=deepseek-flash` into the shell before `npm run dev`. Never commit secrets.

## Current action — JINN-002.1

“I want to be a photographer” → Build my portfolio → On my device → Build my private portfolio.

Upload 3–15 JPEG/PNG/WebP photos. Wisht processes previews locally, skips exact duplicates, picks an initial technically ranked selection, saves optimized WebP previews in private Supabase Storage, and opens a gallery you can edit, bookmark, reload and delete. The original files stay on your device. No image is published or automatically shared.

The feature requires `supabase/migrations/20261114180000_private_portfolio.sql`, already applied to `wisht-dev`. **Do not apply** `20261114190000_require_verified_users.sql` until the matching email sign-in UI is deployed; it blocks legacy anonymous sessions, including on current `main`.

**Auth setup**: Supabase → Authentication → Email Templates → **both Confirm signup and Magic Link / OTP**: include `{{ .Token }}` in the email template body so Wisht's six-digit code form works. Example:

```html
<h2>Your Wisht verification code</h2>
<p>Enter this code in Wisht: {{ .Token }}</p>
```

First-time `signInWithOtp` requests can send the Confirm signup template; returning users receive Magic Link / OTP. The existing confirmation link returns to the Wisht homepage and does not preserve the in-progress mission. Prefer entering the six-digit code in the open Wisht screen. The email provider must be enabled and able to send messages. Default Supabase mail delivery is rate-limited and suitable only for early tests. Supabase → Authentication → Providers → **disable Anonymous Sign-ins** after the UI and RLS migration are deployed. Prior anonymous content isn't automatically deleted or transferred to new verified identities; review it separately before any cleanup.

## Deployment

One Netlify project serves Vite and serverless API Functions. **Only main is built/deployed by Netlify**: `netlify.toml` ignores branch and PR preview builds. GitHub Actions validates each PR. Never merge a feature branch until CI and owner acceptance pass.

## Documentation

- `docs/01-product-manifesto.md` — product principles
- `docs/02-foundation-architecture.md` — baseline architecture
- `docs/03-stories.md` — current backlog
- `docs/06-cloud-foundation.md` — deployed infrastructure
- `docs/07-jinn-002-1-private-portfolio.md` — first real action and acceptance criteria

No Railway, scheduler, public hosting, payment, third-party posting or autonomous tool chain has been added.
