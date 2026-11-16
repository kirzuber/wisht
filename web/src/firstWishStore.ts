import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { logWishOperation, WishPersistenceError } from './wishDiagnostics';
import type { Artifact, DeedReceipt } from '../../api/src/firstDeed';
import { ensurePrimaryJinn } from './jinnStore';

export type WishSummary = { id: string; aspiration: string; updated_at: string; state: string; jinn_id: string };
export type FirstWishRow = {
  id: string;
  aspiration: string;
  first_artifact: Artifact;
  first_deed: DeedReceipt;
  deed_history: DeedReceipt[];
  revision: number;
  artifact_id: string;
  jinn_id: string;
  jinn_name: string;
  jinn_purpose: string;
};

export function listFirstWishes(): Promise<WishSummary[]> {
  return logWishOperation('list', async () => {
    const user = await getAuthenticatedUser();
    const { data, error, status } = await getSupabase().from('wish_records').select('id,original_intent,updated_at,state,primary_jinn_id')
      .eq('user_id', user.id).order('updated_at', { ascending: false });
    if (error) throw new WishPersistenceError('read wishes', error, status);
    return data.map(item => ({
      id: item.id, aspiration: item.original_intent, updated_at: item.updated_at, state: item.state,
      jinn_id: item.primary_jinn_id,
    }));
  });
}

export function loadFirstWish(id: string): Promise<FirstWishRow> {
  return logWishOperation('open', async () => {
    const user = await getAuthenticatedUser();
    const db = getSupabase();
    const wish = await db.from('wish_records').select('id,original_intent,primary_jinn_id')
      .eq('id', id).eq('user_id', user.id).maybeSingle();
    if (wish.error) throw new WishPersistenceError('read wish', wish.error, wish.status);
    if (!wish.data) throw new Error('This saved wish is unavailable.');

    // Never silently substitute a default Jinn for an unexpected missing assignment.
    const assigned = await db.from('jinns').select('id,name,settings')
      .eq('id', wish.data.primary_jinn_id).eq('user_id', user.id).maybeSingle();
    if (assigned.error) throw new WishPersistenceError('read assigned Jinn', assigned.error, assigned.status);
    if (!assigned.data) throw new Error('The Jinn assigned to this Wish is unavailable. Open My Jinns and retry.');

    const [artifacts, deeds] = await Promise.all([
      db.from('artifacts').select('id,content,version,origin_deed_id').eq('wish_id', id).eq('user_id', user.id)
        .order('updated_at', { ascending: false }).limit(1),
      db.from('deeds').select('id,receipt').eq('wish_id', id).eq('user_id', user.id)
        .order('created_at', { ascending: true }).order('id', { ascending: true }),
    ]);
    if (artifacts.error) throw new WishPersistenceError('read artifacts', artifacts.error, artifacts.status);
    if (deeds.error) throw new WishPersistenceError('read deeds', deeds.error, deeds.status);
    const artifact = artifacts.data[0];
    const current = deeds.data.find(deed => deed.id === artifact?.origin_deed_id) ?? deeds.data.at(-1);
    if (!artifact || !current) throw new Error('This saved wish has no prepared Deed.');

    return {
      id: wish.data.id,
      aspiration: wish.data.original_intent,
      first_artifact: artifact.content as Artifact,
      first_deed: current.receipt as DeedReceipt,
      deed_history: [
        ...deeds.data.filter(deed => deed.id !== current.id).map(deed => deed.receipt as DeedReceipt),
        current.receipt as DeedReceipt,
      ],
      revision: artifact.version,
      artifact_id: artifact.id,
      jinn_id: assigned.data.id,
      jinn_name: assigned.data.name,
      jinn_purpose: typeof assigned.data.settings?.purpose === 'string' ? assigned.data.settings.purpose : '',
    };
  });
}

export function saveFirstWish(wish: string, artifact: Artifact, receipt: DeedReceipt, selectedJinnId?: string): Promise<string> {
  return logWishOperation('save', async () => {
    await getAuthenticatedUser();
    // No selection means default; an explicit selection is enforced by the same-owner FK.
    const jinnId = selectedJinnId || (await ensurePrimaryJinn()).id;
    const { data, error, status } = await getSupabase().rpc('create_wish_with_deed', {
      p_jinn_id: jinnId, p_intent: wish, p_artifact: artifact, p_receipt: receipt,
    });
    if (error || typeof data !== 'string') throw new WishPersistenceError('create_wish_with_deed', error, status);
    return data;
  });
}

/** The database checks the artifact version and records a follow-up Deed atomically. */
export async function updateFirstWish(row: FirstWishRow, artifact: Artifact, receipt?: DeedReceipt): Promise<FirstWishRow> {
  await logWishOperation(receipt ? 'continue' : 'edit', async () => {
    await getAuthenticatedUser();
    const db = getSupabase();
    const step = receipt ? 'append_prepared_deed' : 'correct_artifact';
    const { error, status } = receipt ? await db.rpc(step, {
      p_wish_id: row.id, p_artifact_id: row.artifact_id, p_expected_version: row.revision,
      p_artifact: artifact, p_receipt: receipt,
    }) : await db.rpc(step, {
      p_artifact_id: row.artifact_id, p_expected_version: row.revision, p_content: artifact,
    });
    if (error) {
      if (error.code === 'P0001' && error.message.includes('changed')) {
        throw new Error('This wish changed in another session. Reload it before saving again.');
      }
      throw new WishPersistenceError(step, error, status);
    }
  });
  return loadFirstWish(row.id);
}

export function deleteFirstWish(id: string): Promise<void> {
  return logWishOperation('delete', async () => {
    const user = await getAuthenticatedUser();
    const { data, error, status } = await getSupabase().from('wish_records').delete()
      .eq('id', id).eq('user_id', user.id).select('id');
    if (error) throw new WishPersistenceError('delete wish', error, status);
    if (!data.length) throw new Error('This wish could not be deleted.');
  });
}
