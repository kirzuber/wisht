# JINN-I18N-001 — Four-language product foundation

**Status:** draft PR #22, not merged, not deployed. No hosted migration or data change.

## User-facing contract

The product supports **English (`en`), Russian (`ru`), French (`fr`), and Spanish (Spain, `es` / `es-ES`)**. A labeled selector remains visible in the top navigation on guest, authentication, My Jinns, Wish and Deed screens. The first visit negotiates the browser's language; an explicit selection is saved in localStorage under `wisht:ui-language:v1` and survives reload and sign-out on this device.

Changing the UI language immediately updates product labels, inline help, dates, buttons, validation fallback messages, dialogs, accessibility labels, and CSS-generated section badges. It **does not** retranslate the user's Wish, source notes, corrections or saved draft Artifacts; those are user-authored or historically generated work and remain unchanged. Existing Deed receipts are displayed through localized descriptions, while internal status and operation identifiers stay stable English machine values.

When a new clarification, first Deed, or follow-up Deed is requested, the selected locale is explicitly sent in the `locale` JSON request field. Backend input validation accepts only the four IDs. A legacy caller that omits locale defaults to English. The server's controlled system instructions, grounding reviewer and safe fallback worksheets use that locale regardless of the Wish text's language. User-provided source notes stay verbatim; JSON schema field names remain English.

The selected locale is a device preference, **not a shared Jinn persona setting** and not an automatic translation feature. Each Wish retains its independent context. No new memory/translation jobs, extra model calls from switching the selector, or paid translation service is introduced.

## Engineering

- `api/src/locale.ts`: supported IDs, browser negotiation and controlled model language instruction.
- `api/src/starterWorksheet.ts`: safe, explicitly authored fallback in each language.
- `web/src/i18n.tsx`: React language context, UI translations, pluralization, error fallback and local date formatting.
- `web/src/App.tsx`, `AuthGate.tsx`, `MyWishes.tsx`, `FirstWish.tsx`: react to the selected language.
- `api/src/firstDeed.ts`: validates `locale`, uses it in clarify/prepare/continue/review and rejects mismatched explicit language markers.
- `web/src/jinnExperience.css`: localized CSS pseudo-element section labels.
- `api/test/localization.test.ts`: locale negotiation, safe interpolations, Russian plural forms, explicit prompt locale, worksheet behavior and API rejection.
- `scripts/test-local-i18n.mjs`: browser smoke on all four languages (Vite and local Supabase only) with deterministic AI fixtures; captures desktop/mobile, asserts locale propagation, original source preservation, language preference persistence and localized OTP.

Run `npm run typecheck && npm test && npm run test:db && npm run build`. For local browser: start local Supabase, `npm run dev`, then `npm run test:local-i18n`; automated CI for PR #22 does this in a disposable local environment.

## Known boundaries / follow-up

1. **Model language compliance:** prompts specify the target locale and reviewer checks it. The AI may still produce occasional mixed-language text; an output language marker is a contract, not definitive proof. French/Spanish/Russian native-speaker copy and real-model E2E acceptance remain product/reality-check work.
2. **Device-scoped preference:** a different browser/device negotiates its own locale. Cross-device account-level synchronization and per-Wish immutable drafting locale are not built. Product can decide those semantics later, without rewriting historic artifacts.
3. **Third-party errors:** unexpected raw Supabase/provider errors are deliberately shown as localized generic recovery text; the diagnostic codes remain in internal logs.
4. **F03-002 Deed execution:** new screens and action APIs must use `useLocale` and the same server locale contract. Translating a UI string must never imply an action was executed.
5. **Retired legacy verticals:** this PR localizes the active generic product, not the disabled photography/career/soccer experiences.

No merge, deployment, or hosted SQL changes were made by this story.
