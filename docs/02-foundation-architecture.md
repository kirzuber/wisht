# Foundation Architecture — v0.1

**Baseline:** [Original architecture document](https://docs.google.com/document/d/1Zmt5GT-oJQryqhIOQn4OgMAakCijSIWQ8OwHI7NrGuc/edit) (November 13, 2026). This is the **Git-owned implementation view**. Edit here as new stories land.

## End-to-end mental model

```text
Open wish
  → intent routing (bounded category + supported catalog)
  → capability reveal
  → one contextual question
  → mission contract (scope, outcome, tools, budget, permissions)
  → [later: scheduled worker / real tool execution]
  → [later: verification + Work Receipt]
  → [later: approval + continuation]
```

A durable "agent" is persisted goal state + mission state + workflow policy + action history. It is not a continuously running language model.

## Intended production infrastructure — NOT implemented in JINN-001

| Concern | Choice | When |
|---|---|---|
| Mobile UI | React / Vite PWA, deployed to Netlify | Local now; cloud after first story |
| API and execution | Node.js / TypeScript, Railway | Local now; cloud after first story |
| Auth, DB and artifacts | Supabase Auth + PostgreSQL + Storage | After first story; only when real persistence/uploads exist |
| Background work | Lightweight scheduler → durable Postgres job queue, idempotency + retry | When first proactive skill is implemented |
| Reasoning | Cheap model with schema-constrained output, provider adapter | Introduce only where deterministic routing stops being sufficient |
| Public research | Approved public APIs / RSS / search + normalized shared cache | First verified scout skill |
| Notifications | In-app first; opt-in email/push later | When monitoring is real |
| Payments | One-off extra missions; not MVP | After value and cost are validated |

## Local JINN-001 deployment

```text
Browser (Vite :5173)
    │ /api via development proxy
    ▼
Node/Express (:3001)
    └── deterministic intent router + mission capability catalog
```

No LLM, DB, storage, scheduler or external tool calls. That is deliberate. It demonstrates UX, routing and mission contract cheaply. It **does not** demonstrate real autonomous actions yet.

## Skills: execution contract (future)

Each skill must publish:

- Inputs and why each is needed.
- Explicit output artifact/evidence contract.
- Allowed data sources, permission class, and source terms.
- Hard max duration, iterations, network/tool calls and money.
- Verification function, idempotency key, failure modes.
- User approval requirement and rollback/unpublish where supported.

`READ_PUBLIC`, `READ_USER_PROVIDED`, `CREATE_PRIVATE`, `MONITOR_PUBLIC`, `PUBLISH_OWN_PLATFORM`, and `WRITE_EXTERNAL` must remain distinct authorization classes. No autonomous financial/legal transactions in MVP.

## Privacy and truthfulness

- No silent lookup of private social identities using an email or full name. User must supply or confirm public profiles; permitted APIs only.
- No claims of action completion without evidence, provider receipts/IDs or artifact references.
- Default private, with explicit preview-and-approve for public publication.
- Isolate private goal data from shared public research, enforce RLS when DB arrives, and allow delete/revoke/pause.

## Cost design

1. Prefer ordinary code and shared research over individual LLM browsing loops.
2. Route to a low-cost model only if classification/creation requires semantic understanding.
3. No inference when idle. Event-driven, bounded jobs.
4. Enforce budget ceilings **in code**, not prompts: per call, mission, user and whole service.
5. Measure fully loaded cost per accepted, useful Work Receipt.

## Deliberate non-goals

No agent swarm, Kubernetes, vector database, heavy orchestration framework, user-wide data scraping, unattended account mutations, public release before security review, or billing in JINN-001.
