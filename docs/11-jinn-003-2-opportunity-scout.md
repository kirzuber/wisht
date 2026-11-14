# JINN-003.2 — Opportunity Scout
Status: IN REVIEW. Branch `feature/jinn-003-2-opportunity-scout`.

## What it does
After a user says "I want to be a photographer", Jinn can independently fetch a currently published source of potential photography calls, filter by interest (any/nature/portrait/open theme) and entry-cost preference (free listings by default), remove expired/duplicate items, and return at most five source-linked opportunities. It explains precisely why each was found. The user can run this without registration.

Only when the user chooses to keep results does Jinn require a verified account. It creates or reuses that user's **existing photography wish** (one of three root goals), stores the time-stamped shortlist in `opportunity_shortlists` and generates `OPPORTUNITY_SHORTLIST_SAVED` through a database trigger. Saved runs and links appear within My Wishes; the original private portfolio is not modified.

## Why the source
[Pixcontests](https://pixcontests.com/calendar) publicly advertises subscribable iCalendar feeds:
- Free-entry listings: `https://pixcontests.com/calendar/free.ics`
- All listings: `https://pixcontests.com/calendar/all.ics`

The adapter fetches only those allowlisted URLs, on demand, with a 7.5-second timeout and 2 MB response cap. It uses the feed's VEVENT deadline, summary and its linked Pixcontests listing. No arbitrary web crawling, SSRF to event URLs, paid API or LLM research loop. Netlify rate-limits the public endpoint to 6 requests/minute per IP and publishes a short-lived cache header.

**Evidence boundary:** a source-indexed, dated listing is not independently organizer-verified. Eligibility, final fees, photographic rights, organizer acceptance and changed deadlines must be confirmed at the organizer's official page before preparing or submitting anything. Results carry `organizerVerified:false`. Fewer than five matches (including zero) are valid. Source downtime must show an error, not a cached fabricated result.

## Data contract
- Scout response: source, feed URL, observation timestamp, filter parameters, up to five opportunities, listing URL/deadline/summary/fee caveat and explicit evidence status.
- Owner-owned `opportunity_shortlists` table with wish/owner composite FK and verified-account RLS; only photography wishes supported in this increment. At most one saved shortlist per wish per UTC day.
- Work Receipts extended with `OPPORTUNITY_SHORTLIST_SAVED`, `shortlist_id` and `opportunity_count`; no portfolio required for research. Receipts prove **a shortlist record was saved**, not that an organizer confirmed the listing.
- User can delete a saved shortlist; historical receipt remains but no longer references the deleted record. A wish cannot be deleted from the UI until its linked shortlists are removed.
- No source passwords, social profiles, service-role key, or personal data in public GET. Image uploads are not used in the scout.

## Acceptance
- [ ] GitHub CI: TypeScript, unit tests and build pass.
- [ ] The live public feed can be fetched from Mac/Netlify and produces only dated, linked candidates; no sources → no invented matches.
- [ ] Photography mission "Find places to show my work" opens the actual scout.
- [ ] A visitor can run the scan without signing in; auth is required only on Save.
- [ ] Saved shortlist attaches to the right photography wish and does not consume another wish slot.
- [ ] My Wishes shows saved shortlists, source links and the truthful Work Receipt.
- [ ] Another user cannot read, write or delete the owner's shortlist; direct client write cannot forge Work Receipts.
- [ ] A second save on the same UTC day returns a clear duplicate notice. Tomorrow's findings can be saved again.
- [ ] Failed network calls, 0 matches, expired dates, malformed ICS and unsupported genres are handled honestly.
- [ ] Only main deploys on Netlify after PR merge; no scheduler, paid search, or uncontrolled follow-up actions added.

## Product limitations before MVP
This is a **first public discovery skill**, not a fully autonomous monitored agent or a submission agent. The source is a third-party index; proof of organizer eligibility remains open. The shortlist save is performed with the user's verified Supabase session, so its DB receipt attests persistence, not independent server attestation of the exact feed contents. In a later story, we can move execution+evidence writes into a trusted backend once required.

## Next increment
JINN-003.3 prepares an application for one **independently verified** organizer open call using a user's existing public portfolio. JINN-003.4 adds bounded scheduling, fresh-source comparison and opt-in notifications. Design adapters for career and soccer sources without treating one photography calendar as a universal scout.
