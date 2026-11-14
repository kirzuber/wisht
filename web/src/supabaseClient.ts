import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';

let instance: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Private storage is not configured yet.');
  if (!instance) instance = createClient(url, key);
  return instance;
}

/** Anonymous sign-in is triggered only by Save or Build, never by opening the homepage. */
export async function getOrCreateUser(): Promise<User> {
  const supabase = getSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError') throw error;
  if (user) return user;
  const signedIn = await supabase.auth.signInAnonymously();
  if (signedIn.error) throw signedIn.error;
  if (!signedIn.data.user) throw new Error('Could not create a private session.');
  return signedIn.data.user;
}
