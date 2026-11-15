# JINN-UX-02 — Focused Scout Results

Status: IN REVIEW. This is a presentation-only change. Do not merge until owner accepts.

## User problem
After a short opening, each Scout displayed its whole search form, a stack of up to five long cards, technical details, evidence blocks, and receipts. Users had to scroll through too much before seeing the next practical action.

## Scope
- Photography, Career and Soccer Scouts share the same **single-result focus** interaction:
  - After search, collapse the search form into a one-line summary with **Change search**.
  - Display **one source-ordered item** at a time, with Previous / Next and position indicator; no claim that first means best.
  - Keep the source link and next useful external action prominent.
  - Put lengthy provider evidence and secondary listing notes into accessible native **details** disclosures.
  - Keep all raw returned matches in memory and persist the **entire** source-backed shortlist on Save, not just the currently viewed result; label Save all N.
  - Collapse Work Receipts after successful save, while keeping a clear My Wishes button.
- Show truthful empty / error states and disclose when source verification is limited.
- Existing Supabase tables, RLS, receipts, source adapters, AI opt-in and user consent are unchanged.
- No extra LLM call, no new infrastructure, no changes to My Wishes layout in this story.

## Acceptance
1. Soccer: search Burlington, view the first club; a city with multiple records allows Previous / Next. Check official links. Change search restores form. Save retains full shortlist.
2. Career: search remote roles, view one role with Next; optional AI notes remain tied to correct listing; source/application links work. Save preserves all jobs.
3. Photography: search public calendar, navigate one listing at a time and inspect deadline/source. Change photography topic, search again and verify navigator resets. Saving keeps all matches.
4. For all: no match displays an honest message and allows changing the search; work evidence is expandable. Saved Work Receipt remains available without dominating the screen.
5. Mobile widths: no horizontal scrolling or clipped actions. Keyboard tab and screen reader labels for Previous / Next must be usable.
6. CI typecheck / tests / build pass, local owner acceptance before merge.

## Design limits
This is a *presentation* refinement, not a ranking or recommendation system. Search provider order is preserved. Users should not infer that one source-listed club or job is the most suitable. Browse and save do not equal external application, registration or organizer verification.
