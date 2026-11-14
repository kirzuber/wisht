# JINN-004.2 — Soccer Opportunity Scout

Status: IMPLEMENTED IN FEATURE BRANCH — CI AND LOCAL ACCEPTANCE PENDING. Branch: `feature/jinn-004-2-soccer-scout`.

## Product intent
Third executable wish family after photography and career. A person says “I want to play soccer”; the Jinn finds genuine local organizations and documented ways to take a next step. This tests whether one wish → deed → evidence → saved artifact → receipt architecture extends to geographically specific, non-job opportunities. Keep the experience welcoming, especially to beginners and parents, rather than presenting a technical directory.

## First supported slice — Ontario, Canada
Start with **Ontario**, deliberately not a claimed global search. The city/municipality is explicitly entered by the user, never inferred from IP or browser precise location. The user chooses **recreational / competitive / beginner** and an **age group** (adult / youth, with an optional birth-year or age band only if required by a provider). Avoid collecting a child's name, contact details, date of birth, or other unnecessary personal information.

A user:
1. Enters “I want to play soccer” → **Find my team** → chooses their playing preference.
2. Enters city and adult/youth. Show a human explanation of Ontario-only coverage. Ask no account questions to browse.
3. Jinn checks supported, documented **official** Canada Soccer / Ontario Soccer directory and district/club pages for known organization identities. Return at most 5 distinct, relevant, source-linked clubs/leagues with city/region, program type *when stated*, evidence status, and official club / organization links. Return empty/unsupported honestly if the location has no supported evidence.
4. Distinguish clearly:
   - **Club exists in official directory** (identity/location supported)
   - **Program described on official club page** (program offered, but not necessarily open)
   - **Registration/tryout currently advertised** (only when a dated, official first-party page explicitly supports it)
   Never infer open enrollment from a club's existence or a stale page. A website home page is not an evidenced live registration offer.
5. Show a clear “Check with club” next step with exact official URLs where genuinely sourced. Do not fabricate contacts, opening dates, deadlines, available places, prices, eligibility, or invitation to a trial.
6. After verified sign-in, save a short club shortlist under the **same** soccer root wish (one slot among three), reopen under My wishes, and generate database-authored `SOCCER_SHORTLIST_SAVED` Work Receipt. The receipt proves only that a source-backed shortlist was saved, not acceptance, registration, tryout booking or organizer verification.

## Evidence strategy and adapter discipline
Research starting points:
- Canada Soccer official club directory: https://canadasoccer.com/clubs/club-directory/
- Ontario Soccer official club finder / district resources: https://ontariosoccer.sportngin.com/club
- Ontario Soccer club discovery announcement (historical, **not** evidence that today’s trial is open): https://www.ontariosoccer.net/news_article/show/1169773-ontario-soccer-launches-new-club-discovery-tool-in-collaboration-with-canada-soccer-to-further-enhance-pipo-2-0-rtp-marketing-campaign

**Mandatory source feasibility gate before building the UI**: Codex must determine whether there is a stable, permitted, server-fetchable directory endpoint or export and verify real example records, access restrictions, licensing/terms and actual city coverage. Do not scrape private authenticated pages, bypass bot protections, invent an API endpoint, or treat search-engine snippets as verified first-party offers.

If the official directory is JS-only/unsupported or does not permit programmatic retrieval, prefer an explicitly bounded **maintained allowlist** of actual Ontario clubs verified against official association and first-party websites, with source URL, last-checked timestamp, geographic coverage and stale-data rules. **Do not label this as a real-time all-Ontario search.** Provide explicit “supported areas only” messages and a link to the authoritative public directory as a fallback. No unreviewed AI-generated club records.

If a bounded allowlist is selected, verify several real examples from different towns, not just one neighbourhood. Include matching tests (city and immediate regional coverage only when grounded), link validation and stale-data / no-match tests. If a program/tryout status cannot be checked reliably, omit it or label “Confirm directly with club.”

No paid directory, maps API, external connector, headless-browsing infrastructure, generic arbitrary-URL crawler or new deployment platform in this story.

## AI boundary
The factual search must work with **zero LLM calls**. An LLM is not required for soccer v1. If reasoning genuinely helps, propose it only *after* a factual source adapter is shown to work, and never permit a model to invent or certify clubs/tryouts. Reuse existing API and deterministic filtering.

## Implementation expectations
- Reuse `JINN-004.1` patterns for public anonymous scout, owner-authenticated save, `My wishes` nested artifact and true database Work Receipt.
- One soccer root wish and multiple deeds/artifacts, no new saved wish per search; honor the three-wish entitlement and dedup logic.
- Add a `soccer_shortlists` Supabase migration with owner-RLS, same-owner soccer-kind wish FK/trigger validation, source-linked 1..5 entries, sensible dedup / rate limits and receipt trigger; no client receipt INSERT grants.
- Do not reuse career tables for soccer data. Keep the new provider adapter isolated, expose a bounded read-only endpoint, sanitize displayed external text and URLs, and provide timeout / error / empty states.
- Treat youth pathways carefully: avoid collecting identifying data on minors. No direct outreach, sign-up, registration or messaging, no agent browsing authenticated third-party accounts.
- Update copy in the soccer catalog and `My wishes` to accurately reflect **implemented** capabilities; other soccer missions (training-plan / watch-tryouts) remain planned and should not route to an unfinished function.
- Netlify deploys `main` only; PR checks and tests must pass before merge.

## Required automated tests
- Known supported city, unknown city, youth/adult and interest filters.
- Official-source provenance and unchanged valid link rendering; invalid or unverified URLs rejected.
- No invented club when source fails; stale data clearly identified; no claimed open trial from generic home page.
- Anonymous browse; authenticated save; owner RLS / cross-account denial; wish-kind/owner integrity; daily duplicate behavior if adopted.
- Exactly one legitimate `SOCCER_SHORTLIST_SAVED` receipt per successful save; client cannot forge receipt.
- No LLM call and no background scheduler required.
- Existing photography and career tests/build must remain green.

## Local owner acceptance
1. Soccer wish → Find my team → Ontario city → beginner/recreational/competitive and adult/youth → real source-backed clubs.
2. Open each displayed official club/directory URL. Verify source identity, city, and any asserted registration status.
3. Try unsupported city, no matches, invalid input, and upstream unavailable; confirm honesty and useful fallback.
4. Save one shortlist; verify one soccer wish, persistence across reload, My wishes links, and truthful receipt.
5. Confirm no accidental third-party registration, no impersonation, no contact or external actions.

## Stop point
This is the **last planned feature story before the MVP pause**. After user acceptance and PR merge, STOP all feature work. Jointly assess:
- User-first aspiration-to-first-value journey for novice / older users
- Three-wish model and whether it is intuitive
- Generic cross-domain agent vs vertical-specific workflows
- Actual autonomy vs tool execution, evidence and consent boundaries
- How much AI is used, and whether that creates customer-perceived value
- Architecture and operational reliability, security, cost/unit economics
- Positioning, distribution, willingness to pay, and MVP go/no-go

Never count an implementation as complete until genuine source evidence, local browser acceptance, security verification, CI and owner approval are all recorded.

## Implementation record (November 14, 2026)
- First-party public program pages were independently researched for Burlington Soccer, Oakville Soccer Club, Erin Mills SC, Guelph Soccer, Toronto High Park FC and Ottawa South United. No claim of current registration availability is made. Club program links and source verification timestamps are in `api/src/soccerCatalogue.ts`.
- Kept this intentionally as a **curated static pilot catalogue**, not an automated live scan, and therefore zero model calls. Unlisted towns return honest no-match + Canada Soccer directory link.
- Implemented anonymous `/api/soccer-scout`, user-owned save via `soccer_shortlists`, `SOCCER_SHORTLIST_SAVED` database receipt, and return access through My Wishes. Added automated input and evidence tests.
- New source-backed records must be periodically reverified manually; the catalogue does NOT make claims about new 2027 enrollment, program eligibility or registration availability.
- Owner browser acceptance still pending; no merge or production deployment authorized until approval.
