# JINN-UX-01 — First-Use Experience (Review)

Status: IN REVIEW. Production is unchanged until owner acceptance and merge.

## User-facing contract
- Opening screen: **Make a wish.** One prompt, one primary action, and three small example suggestions. Do not show the three-wish quota or a progress wizard.
- Only executable missions are shown. Planned missions are neither selectable nor advertised as runnable.
- Career and Soccer each have one executable path: after wish interpretation enter the existing Scout directly, without mission-selection, preflight questionnaire or mission-contract pages.
- Photography has two executable paths: choose **Build my portfolio** or **Find places to show my work**. Choose only, then start existing work. Gallery creation still requires verified sign-in; public opportunity discovery does not.
- Unavailable wishes get one short, honest explanation and the option to try another wish. No fake completion or generic agent fallback.
- Existing Supabase authorization, action-specific consent, provider evidence, and Work Receipts remain unchanged. The app does not auto-publish, auto-apply or auto-register.
- Back returns to the relevant choice, My Wishes, or home, never to the removed mission-contract wizard.
- Keep the experience visually consistent with the existing brand. Avoid long lists of deliverables and explanation screens.

## Architecture boundary
Pure first-use routing in `web/src/firstUse.ts`; no new LLM, data model, API or platform. The server still owns the supported capability catalogue, and classification cannot grant a new executable capability.

## Acceptance (owner review)
1. Open home: concise question and one clear CTA; no wizard progress indicators.
2. Enter `I want to play soccer`: directly opens Soccer Scout, can browse without account, returns to home correctly.
3. Enter `I want a new career`: directly opens Career Scout, can browse without account.
4. Enter `I want to be a photographer`: exactly two selectable real deeds; photo scout opens immediately, portfolio sign-in remains respected.
5. Enter `I want to be independent` or unknown wish: honest unavailable message, not a list of promised future actions.
6. Existing My Wishes, portfolio opening, existing saved careers, soccer shortlists and auth flow are unaffected; no broken back path.
7. CI tests / typecheck / build green. No merge or deployment until owner acceptance.

## Follow-up after acceptance
Conduct observed novice/older-user first-use tests. Next UX increment, only if evidence supports it, should simplify the information density of each scout's input/result screens and continue-work action. Do **not** reopen all features in this PR.
