# Product stories — Git is the source of truth

## JINN-001 — The Wish Experience — COMPLETE
Aspiration → supported mission reveal → one contextual question → explicit work contract. Does not fabricate actions. UI and routing are deployed.

## CLOUD-001 / CLOUD-002 — Infrastructure and LLM verification — COMPLETE
Netlify hosts React UI and API Functions; Supabase owns private data; selective DeepSeek/OpenAI classification; GitHub Actions validates typechecks/tests/build. Detailed results: docs/06-cloud-foundation.md.

## JINN-002.1 — Private Portfolio Builder — IN REVIEW
As a first-time photographer, I can supply real photos and receive a private, editable, saved gallery; the system performs transparent technical checks and does not claim artistic evaluation or publication.

Acceptance and non-goals: docs/07-jinn-002-1-private-portfolio.md.

### JINN-002.1 continuation — Returning-user experience — IN REVIEW
Keep the Supabase session across reloads. Provide one compact My wishes view showing all the current verified user's saved wishes and private portfolios, and allow sign-out, wish deletion and reopening of private drafts from another device. No new tables, no dashboard, no external actions.

## JINN-002.2 — Publish My Portfolio — LATER
After inspecting the exact gallery preview, user grants explicit publication consent; create a verified hosted URL and support unpublish. Do not use original photos or publish previews without approval.

## JINN-003 — Work Receipt and Second Wish — LATER
Persist verification evidence and action status for completed work; next photography mission searches for relevant, source-verified public opportunities.

## Deliberately deferred
Generic multi-agent orchestration, autonomous messaging, universal browser actions, payments, notification campaigns, account discovery by email, expensive vision models, vector DB and new deployment services.

## Three-wish entitlement — JINN-002.1 increment — IN REVIEW
Limit each verified account to three saved wish cards. Enforce in Supabase and UI, preserve existing over-limit test data, keep portfolios separate, and don't restrict free anonymous exploration. Later product iteration may organize multiple deeds under one top-level dream.
