import { getOrCreateUser, getSupabase } from './supabaseClient';

/** Explicit private save; uses the same browser-bound session as portfolios. */
export async function saveWish(input: { aspiration: string; kind: string; missionId: string; answer: string }): Promise<void> {
  const user = await getOrCreateUser();
  const { error } = await getSupabase().from('wishes').insert({
    user_id: user.id, aspiration: input.aspiration, kind: input.kind,
    mission_id: input.missionId, answer: input.answer, status: 'PLANNED'
  });
  if (error) throw error;
}
