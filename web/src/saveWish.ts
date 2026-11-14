import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { MAX_SAVED_WISHES, wishesRemaining } from './wishLimit';

const LIMIT_ERROR = 'Your three wishes are already saved. Open My wishes and delete one before saving another.';

/** Explicit private save; no anonymous session and no fourth saved wish. */
export async function saveWish(input: {
  aspiration: string; kind: string; missionId: string; answer: string;
}): Promise<void> {
  const user = await getAuthenticatedUser();
  const db = getSupabase();
  // Friendly early error; a database trigger performs authoritative concurrency-safe enforcement.
  const { count, error: readError } = await db.from('wishes')
    .select('id', { count: 'exact', head: true }).eq('user_id', user.id);
  if (readError) throw readError;
  if (wishesRemaining(count ?? MAX_SAVED_WISHES) === 0) throw new Error(LIMIT_ERROR);

  const { error } = await db.from('wishes').insert({
    user_id: user.id, aspiration: input.aspiration, kind: input.kind,
    mission_id: input.missionId, answer: input.answer, status: 'PLANNED'
  });
  if (error) {
    if (error.message.includes('WISH_LIMIT_REACHED')) throw new Error(LIMIT_ERROR);
    throw error;
  }
}
