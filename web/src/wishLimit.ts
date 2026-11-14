/** Prototype entitlement: up to three saved mission cards per verified account. */
export const MAX_SAVED_WISHES = 3;

export function wishesRemaining(savedCount: number): number {
  return Math.max(0, MAX_SAVED_WISHES - Math.max(0, savedCount));
}
