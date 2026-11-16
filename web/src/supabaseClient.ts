import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { WishPersistenceError } from './wishDiagnostics';

let instance: SupabaseClient | undefined;
export function getSupabase(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error('Private storage is not configured yet.');
  if (!instance) instance = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  return instance;
}

export function isVerifiedAccount(user: Pick<User, 'is_anonymous' | 'email' | 'email_confirmed_at'> | null): boolean {
  return !!user && user.is_anonymous === false && !!user.email && !!user.email_confirmed_at;
}

/** No implicit account creation. Anonymous Supabase identities are rejected. */
export async function getAuthenticatedUser(): Promise<User> {
  const { data: { user }, error } = await getSupabase().auth.getUser();
  if (error && error.name !== 'AuthSessionMissingError' && error.status !== 401 && error.status !== 403) {
    throw new WishPersistenceError('verify account', error, error.status);
  }
  if (error || !isVerifiedAccount(user)) {
    const signInRequired = new Error('Verify your email to save or open your wishes.');
    signInRequired.name = 'WishSignInRequired';
    throw signInRequired;
  }
  return user!;
}
