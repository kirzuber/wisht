# JINN-F02-002 — Canva Experience Alignment

## Design source

The corrected four-page Canva concept, “Wisht / Jinn — F02 UX Concept (Corrected Copy — Review)” (design DAHbAZH7Elc), was inspected page by page. The preferred sequence is wish first, one optional Jinn question, an editable first draft, and a shared workspace whose cards vary with the wish. The visual system uses a warm paper surround, deep navy experience surfaces, lavender actions and rules, editorial serif headings, and a glowing Jinn companion. The comparison page's separate Jinn introduction is not part of the preferred flow.

## Implementation

- The welcome screen now starts with the wish prompt and keeps Jinn visible in a companion panel. The same illustrated Jinn appears in the conversation, first Deed, saved workspace, return view, and email gate.
- The conversation keeps the existing optional clarification and “I'm not sure” path. Working and error states still describe what happened accurately.
- The first Deed and return workspace use the same navy shell and generic card grammar. Document, checklist, questions, source note, unknowns, next Deed, receipt, history, correction, save, and deletion controls retain their existing behavior. Card spans respond to section type, not to book or garden keywords.
- The saved-wishes page uses the new welcome-back composition while preserving legacy portfolios, scouts, watches, shortlists, receipts, and their actions.
- The existing API, Supabase access rules, verified-email gate, and PREPARED action boundary were not changed.
- A transparent Jinn mascot was created with the built-in image generation tool using the corrected Canva page as a visual reference, then stored in [jinn-companion.png](../web/src/assets/jinn-companion.png). Prompt: isolate a friendly round lavender-peach glowing spirit with a curled tuft, small waving arms, warm lower-body light and violet stardust; transparent background; no UI or text.

## Verification

- npm run typecheck, npm test (89 passing), and npm run build.
- Browser checks at 1440 × 900 and 390 × 844: welcome, conversation, optional question, “I'm not sure,” editable garden artifact, book and bicycle artifacts, honest PREPARED receipt, and email gate.
- The local Vite session has no Supabase browser configuration. The save attempt correctly showed “Private storage is not configured yet”; persistence and owner boundaries remain covered by F02-001 database tests. A signed-in browser return flow needs a configured review environment with the F02-001 migration applied.

## Screenshots

| Experience | Before | After |
| --- | --- | --- |
| Welcome, desktop | [before](../screenshots/f02-002/before-welcome-desktop.jpg) | [after](../screenshots/f02-002/after-welcome-desktop.jpg) |
| Welcome, mobile | [before](../screenshots/f02-002/before-welcome-mobile.jpg) | [after](../screenshots/f02-002/after-welcome-mobile.jpg) |
| Garden first Deed, desktop | [before](../screenshots/first-deed-garden.jpg) | [after](../screenshots/f02-002/after-garden-workspace-desktop.jpg) |
| Garden first Deed, mobile | [before](../screenshots/first-deed-garden-mobile.jpg) | [after](../screenshots/f02-002/after-garden-workspace-mobile.jpg) |

Additional captures: [Jinn conversation](../screenshots/f02-002/after-conversation-desktop.jpg), [mobile clarification](../screenshots/f02-002/after-question-mobile.jpg), [book workspace](../screenshots/f02-002/after-book-workspace-desktop.jpg), [bicycle workspace](../screenshots/f02-002/after-bicycle-workspace-desktop.jpg), [mobile email gate](../screenshots/f02-002/after-auth-gate-mobile.jpg).
