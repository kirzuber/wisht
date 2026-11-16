import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { WishPersistenceError } from './wishDiagnostics';

export type JinnIdentity = {
  id: string;
  name: string;
  is_primary: boolean;
  purpose: string;
};

type JinnRow = {
  id: string;
  name: string;
  is_primary: boolean;
  settings: Record<string, unknown> | null;
};

export function toJinnIdentity(row: JinnRow): JinnIdentity {
  return {
    id: row.id,
    name: row.name,
    is_primary: row.is_primary,
    purpose: typeof row.settings?.purpose === 'string' ? row.settings.purpose : '',
  };
}

export function validateJinnIdentity(name: string, purpose: string): { name: string; purpose: string } {
  const cleanName = name.trim();
  const cleanPurpose = purpose.trim();
  if (!cleanName || cleanName.length > 60) throw new Error('Give your Jinn a name between 1 and 60 characters.');
  if (cleanPurpose.length > 160) throw new Error('Keep the purpose note under 160 characters.');
  return { name: cleanName, purpose: cleanPurpose };
}

/** Create a verified user's default companion on demand, including for existing accounts. */
export async function ensurePrimaryJinn(): Promise<JinnIdentity> {
  const user = await getAuthenticatedUser();
  const db = getSupabase();
  const find = () => db.from('jinns').select('id,name,is_primary,settings')
    .eq('user_id', user.id).eq('is_primary', true).maybeSingle();
  const found = await find();
  if (found.error) throw new WishPersistenceError('read primary Jinn', found.error, found.status);
  if (found.data) return toJinnIdentity(found.data);

  const created = await db.from('jinns').insert({ user_id: user.id, is_primary: true, name: 'Jinn' })
    .select('id,name,is_primary,settings').single();
  if (!created.error) return toJinnIdentity(created.data);

  // A concurrent tab might have created the default companion.
  if (created.error.code === '23505') {
    const concurrent = await find();
    if (concurrent.error) throw new WishPersistenceError('reload primary Jinn', concurrent.error, concurrent.status);
    if (concurrent.data) return toJinnIdentity(concurrent.data);
  }
  throw new WishPersistenceError('create primary Jinn', created.error, created.status);
}

export async function listJinns(): Promise<JinnIdentity[]> {
  const user = await getAuthenticatedUser();
  const { data, error, status } = await getSupabase().from('jinns')
    .select('id,name,is_primary,settings').eq('user_id', user.id)
    .order('created_at', { ascending: true });
  if (error) throw new WishPersistenceError('list Jinns', error, status);
  return data.map(toJinnIdentity);
}

export async function createJinn(name: string, purpose: string): Promise<JinnIdentity> {
  const valid = validateJinnIdentity(name, purpose);
  const user = await getAuthenticatedUser();
  const { data, error, status } = await getSupabase().from('jinns').insert({
    user_id: user.id, name: valid.name, settings: valid.purpose ? { purpose: valid.purpose } : {},
  }).select('id,name,is_primary,settings').single();
  if (error) throw new WishPersistenceError('create Jinn', error, status);
  return toJinnIdentity(data);
}

export async function renameJinn(jinn: JinnIdentity, name: string, purpose: string): Promise<JinnIdentity> {
  const valid = validateJinnIdentity(name, purpose);
  const user = await getAuthenticatedUser();
  const db = getSupabase();
  const before = await db.from('jinns').select('settings').eq('id', jinn.id)
    .eq('user_id', user.id).maybeSingle();
  if (before.error) throw new WishPersistenceError('read Jinn settings', before.error, before.status);
  if (!before.data) throw new Error('That Jinn is no longer available. Reload My Jinns.');

  // Preserve settings outside this story's descriptive purpose field.
  const settings: Record<string, unknown> = { ...(before.data.settings ?? {}) };
  delete settings.purpose;
  if (valid.purpose) settings.purpose = valid.purpose;
  const { data, error, status } = await db.from('jinns').update({
    name: valid.name, settings, updated_at: new Date().toISOString(),
  }).eq('id', jinn.id).eq('user_id', user.id)
    .select('id,name,is_primary,settings').maybeSingle();
  if (error) throw new WishPersistenceError('rename Jinn', error, status);
  if (!data) throw new Error('That Jinn is no longer available. Reload My Jinns.');
  return toJinnIdentity(data);
}

/** Only a non-primary Jinn with no assigned Wishes can be deleted. */
export async function deleteEmptyJinn(jinn: JinnIdentity): Promise<void> {
  if (jinn.is_primary) throw new Error('The default Jinn cannot be deleted.');
  const user = await getAuthenticatedUser();
  const { data, error, status } = await getSupabase().from('jinns').delete()
    .eq('id', jinn.id).eq('user_id', user.id).eq('is_primary', false).select('id');
  if (error?.code === '23503') throw new Error('Move this Jinn’s Wishes before deleting it.');
  if (error) throw new WishPersistenceError('delete Jinn', error, status);
  if (!data?.length) throw new Error('This Jinn could not be deleted. Check whether it still has Wishes.');
}

/** The database owner FK and RLS jointly prevent assigning another user's Jinn. */
export async function moveWishToJinn(wishId: string, targetJinnId: string): Promise<void> {
  const user = await getAuthenticatedUser();
  const { data, error, status } = await getSupabase().from('wish_records').update({
    primary_jinn_id: targetJinnId, updated_at: new Date().toISOString(),
  }).eq('id', wishId).eq('user_id', user.id).select('id');
  if (error?.code === '23503') throw new Error('That Jinn is unavailable for your account. Reload My Jinns.');
  if (error) throw new WishPersistenceError('assign Wish', error, status);
  if (!data?.length) throw new Error('This Wish is unavailable or belongs to another account.');
}
