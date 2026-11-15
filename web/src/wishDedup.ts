/** One wish is a goal, not one of several missions attached to that goal.
 * The current catalog provides a small, explicit goal taxonomy; avoid pretending to do
 * unrestricted semantic inference. Never merge broad personal/creative categories by kind.
 */
export type SavedWishIdentity = { id?: string; aspiration: string; kind: string };

export const GOAL_FAMILIES = ['photography', 'soccer', 'career', 'independence', 'finance'] as const;

export function normalizedWish(text: string): string {
  return text.toLocaleLowerCase('en').normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

/** Exact text OR the same supported aspiration family, regardless of chosen mission.
 * Unknown, creative and sensitive personal requests use strict textual matching only.
 */
export function matchingWish<T extends SavedWishIdentity>(
  incoming: Pick<SavedWishIdentity, 'aspiration' | 'kind'>,
  saved: T[]
): T | undefined {
  const normalized = normalizedWish(incoming.aspiration);
  const meaningfulFamily = GOAL_FAMILIES.some(kind => kind === incoming.kind);
  return saved.find(existing =>
    normalizedWish(existing.aspiration) === normalized
      || (meaningfulFamily && existing.kind === incoming.kind)
  );
}

export function duplicateWishGroups<T extends SavedWishIdentity>(saved: T[]): T[][] {
  const seen = new Set<number>();
  const groups: T[][] = [];
  for (let index = 0; index < saved.length; index++) {
    if (seen.has(index)) continue;
    const group: T[] = [saved[index]];
    for (let j = index + 1; j < saved.length; j++) {
      if (seen.has(j)) continue;
      if (matchingWish(saved[index], [saved[j]])) {
        seen.add(j);
        group.push(saved[j]);
      }
    }
    if (group.length > 1) groups.push(group);
  }
  return groups;
}
