# Jinn (working name) — Three wishes. Real work.

> Who do you want to be? Give the Jinn a wish. Get something genuinely useful done.

**Current milestone: JINN-001 — The Wish Experience.** This is a source-complete local vertical slice of *understanding → capability reveal → one question → mission contract*. **No autonomous missions are executed yet.** The app does not pretend to have searched, generated, contacted or published anything.

## Local setup

Requirements: Node.js 22+, npm 10+.

```bash
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to the Node API at **http://localhost:3001**.

```bash
npm run typecheck
npm test
npm run build
```

A small API health check is available at `http://localhost:3001/api/health`.

No cloud credentials, LLM keys, external integrations, database, Docker or account setup is necessary for this story. **Validation note:** The authoring container could not reach the npm registry (`EAI_AGAIN`), so npm install, full TypeScript typecheck and browser rendering were not verified here. A dependency-free TypeScript syntax pass and nine route test cases did pass. Run the commands above on your Mac to complete acceptance. Do not put secrets in `VITE_` variables (they are client-exposed).

## Repository layout

```text
api/           Express + TypeScript, deterministic intent router and capability catalog
web/           React + Vite + TypeScript, mobile-first wish experience
docs/          Product manifesto, architecture, stories, decisions, action catalog
```

## Current product behaviour

- Accepts any wish as text, with lightweight example prompts.
- Recognizes initial supported themes: photography, career, soccer, independence, finance; playful king/frog; private identity exploration.
- Handles unsupported wishes **honestly** rather than promising universal agent capabilities.
- Shows a concrete *planned* mission menu before asking the user's first contextual question.
- Asks exactly one small question for the selected mission and displays its execution contract.
- Displays **NOT EXECUTED** prominently. No false work receipts, no wish quota charged.
- No personal data persisted or sent to a third-party model in this version. Text is transmitted only to the local API.

## Roadmap

- **JINN-001 — The Wish Experience** (included): working UX and intent → mission routing.
- **JINN-002 — First Real Action** (next): photo upload, actual portfolio build, private preview, real verification; user-approved publication as a separately authorized step.
- **JINN-003 — Work Receipt + Second Wish**: action evidence, honest statuses, feedback, and a verified photography opportunity hunt.
- **CLOUD-001 — Infrastructure and Deployment**: planned **after JINN-001 acceptance**, with Netlify (web), Railway (API), Supabase (Auth/DB/Storage). See `docs/03-stories.md`.

## Important

This is a prototype, not a deployable production agent. No auth, persistence, storage, permissions engine, payment, upload scanning, or asynchronous executor exists yet. Do not open up to public traffic as a real agent until these are implemented.

GitHub repository creation, CI/CD, cloud resources, DNS and brand availability checks are intentionally left for the next step.
