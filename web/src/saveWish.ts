import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { matchingWish } from './wishDedup';
import { MAX_SAVED_WISHES, wishesRemaining } from './wishLimit';

export class WishAlreadySavedError extends Error {
  constructor(public readonly existingAspiration?: string) {
    super('You already have a wish for this goal. Open My wishes to continue with it instead of saving another.');
    this.name = 'WishAlreadySavedError';
  }
}

const LIMIT_ERROR = 'Your three wishes are already saved. Open My wishes and delete one before saving another.';

/** Check for an existing aspiration before the three-wish limit; DB trigger is authoritative. */
export async function saveWish(input: {
  aspiration: string; kind: string; missionId: string; answer: string;
}): Promise<void> {
  const user = await getAuthenticatedUser();
  const db = getSupabase();
  const { data: existing, error: readError } = await db.from('wishes')
    .select('id,aspiration,kind').eq('user_id', user.id);
  if (readError) throw readError;

  const found = matchingWish(input, existing || []);
  if (found) throw new WishAlreadySavedError(found.aspiration);
  if (wishesRemaining(existing?.length ?? MAX_SAVED_WISHES) === 0) {
    throw new Error(LIMIT_ERROR);
  }

  const { error } = await db.from('wishes').insert({
    user_id: user.id, aspiration: input.aspiration, kind: input.kind,
    mission_id: input.missionId, answer: input.answer, status: 'PLANNED'
  });
  if (error) {
    if (error.message.includes('WISH_ALREADY_EXISTS')) throw new WishAlreadySavedError();
    if (error.message.includes('WISH_LIMIT_REACHED')) throw new Error(LIMIT_ERROR);
    throw error;
  }
}
