# JINN-002.3 — Wish & Artifact Integrity

Status: IN REVIEW. Branch: `feature/jinn-002-3-wish-integrity`.

## Problem
Previously users could build/publish portfolios without saving any wish. Three wish slots counted saved mission cards rather than distinct goals, while two photography portfolios were displayed separately from all wishes.

## Product contract
- **Wish = lasting aspiration**, one of up to three unique roots per verified account.
- **Deeds = work toward the wish**; current runnable deed: build and publish photography portfolio. More deeds will be introduced in the next action stories. Do not represent an unexecuted mission as completed.
- **Portfolio = artifact** belonging to exactly one wish; one photography wish may have any number of portfolios (subject to future storage quotas).
- The user can explore without an account. When a gallery is actually created, Wisht automatically creates or reuses its photography wish after authentication; the user does not need to press both "Save wish" and "Build portfolio".
- A second portfolio creates no extra wish. A second action in a future story will be linked to the same root.
- My Wishes shows the root aspiration once, with linked galleries nested underneath.
- Deleting a wish that owns a portfolio is blocked until the user deletes its private galleries (which each unpublish first). No accidental cascading public-image deletion.
- Keep published slugs and existing gallery IDs unchanged.

## Database integrity
- `public.portfolios.wish_id` is NOT NULL.
- Composite foreign key `(wish_id,user_id)` → `public.wishes(id,user_id)` enforces the same owner and prevents orphaned galleries.
- A BEFORE INSERT/UPDATE trigger checks the parent's kind is `photography`; a soccer wish cannot own a photography gallery.
- Backward compatibility: if the previous deployed frontend omits `wish_id`, the INSERT trigger reuses or creates the owner's photography wish. This lets the new schema land before the UI deploy without breaking existing browser sessions.
- Migration links legacy galleries to the owner's photography root. For the current test database, the owner of two portfolios has no photography wish yet; both will be linked to one newly created root. The separate legacy anonymous test portfolio also receives its own parent (no deletion).
- `portfolio_publications.portfolio_id`, public slug and Storage paths remain unchanged.

## Acceptance checks
- [ ] Migration applied to wisht-dev and verified: no unlinked portfolios, FK and trigger present.
- [ ] Existing two verified-user portfolios now appear under a single photography wish, separate from soccer.
- [ ] Saved-wish count reflects goals (e.g., soccer + photography = 2/3).
- [ ] From a new photography mission, user can skip explicit saving; creating the first gallery auto-creates/reuses the correct wish.
- [ ] From My Wishes, create a second portfolio under the same photography root without consuming another wish.
- [ ] No portfolio can be inserted under another user's wish or a non-photography wish via REST.
- [ ] Attempting to delete a wish with linked galleries is rejected at the database level and explained in the UI.
- [ ] Existing public portfolios continue to open under their original URLs and can unpublish normally.
- [ ] CI typecheck, tests, build pass; user tests local UX before merge; only main deploys to Netlify.

## Deliberately deferred
A generic `wish_deeds` execution table, persistent multi-step Work Receipts, billing, a universal skill registry, automatic browser agents, public catalogue, and cleanup of unreachable legacy anonymous accounts. Introduce deeds as a separate table when a second executable mission needs it rather than building speculative entities now.

## Key risk
The current `wishes.mission_id` still records the *first chosen mission*, not a normalized list of all deeds. Display and entitlement now treat the wish as an aspiration root. The planned next story can add a lightweight deeds table to preserve each actual action and receipt.
