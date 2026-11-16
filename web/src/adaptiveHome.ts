import type { JinnIdentity } from './jinnStore';

/**
 * A default system Jinn is a storage convenience, not evidence that the person
 * intentionally configured an assistant. Never hide named choices from an owner.
 */
export type HomeMode = 'guest' | 'fresh' | 'named' | 'multiple';
export type HomeSelection = { id: string; ownerId: string } | null;
export type HomeDecision = {
  mode: HomeMode;
  selected: JinnIdentity | null;
  requiresRecovery: boolean;
};

export function resolveAdaptiveHome(
  ownerId: string | null,
  jinns: JinnIdentity[],
  wishCount: number,
  explicit: HomeSelection,
  rememberedId: string | null,
): HomeDecision {
  if (!ownerId) return { mode: 'guest', selected: null, requiresRecovery: false };

  const requested = explicit?.id || rememberedId;
  const invalidOwner = !!explicit && explicit.ownerId !== ownerId;
  const invalidChoice = !!requested && !jinns.some(jinn => jinn.id === requested);
  const requiresRecovery = invalidOwner || invalidChoice;
  const primary = jinns.find(jinn => jinn.is_primary) ?? jinns[0] ?? null;
  const selected = requiresRecovery ? null : jinns.find(jinn => jinn.id === requested) ?? primary;
  const systemOnly = jinns.length === 1 && primary?.is_primary && primary.name === 'Jinn'
    && !primary.purpose && wishCount === 0 && !requested;

  return {
    mode: jinns.length > 1 ? 'multiple' : systemOnly || jinns.length === 0
      ? 'fresh' : 'named',
    selected,
    requiresRecovery,
  };
}

/** Only explicitly selected Jinns get remembered; a default is never written. */
export function lastChosenJinn(ownerId: string): string | null {
  try { return window.localStorage.getItem(`wisht:selected-jinn:${ownerId}`); }
  catch { return null; }
}
export function rememberChosenJinn(ownerId: string, jinnId: string): void {
  try { window.localStorage.setItem(`wisht:selected-jinn:${ownerId}`, jinnId); }
  catch { /* Private browsing may deny storage; the visible current choice still works. */ }
}
export function clearChosenJinn(ownerId: string): void {
  try { window.localStorage.removeItem(`wisht:selected-jinn:${ownerId}`); }
  catch { /* Recovery still works without local storage. */ }
}
