import { getAuthenticatedUser, getSupabase } from './supabaseClient';
import { wishesRemaining } from './wishLimit';

export type PortfolioWishContext = {
  wishId?: string;
  aspiration?: string;
  missionId?: string;
  answer?: string;
};
export type WishLink = { wishId: string; created: boolean };

type RootWish = { id: string; kind: string; aspiration: string };

async function findOwnerWishes(): Promise<RootWish[]> {
  const user = await getAuthenticatedUser();
  const { data, error } = await getSupabase().from('wishes')
    .select('id,kind,aspiration').eq('user_id', user.id);
  if (error) throw error;
  return data || [];
}

function chooseParent(wishes: RootWish[], context: PortfolioWishContext): RootWish | undefined {
  if (context.wishId) {
    const found = wishes.find(w => w.id === context.wishId);
    if (!found || found.kind !== 'photography') {
      throw new Error('Choose your own photography wish before building a portfolio.');
    }
    return found;
  }
  return wishes.find(w => w.kind === 'photography');
}

/** Preflight without persisting a wish; nothing saved until the user supplies photos. */
export async function checkPhotographyWishAvailable(context: PortfolioWishContext): Promise<void> {
  const roots = await findOwnerWishes();
  if (chooseParent(roots, context)) return;
  if (wishesRemaining(roots.length) < 1) {
    throw new Error('All three wishes are in use. Free a wish slot before creating a photography goal.');
  }
}

/** A portfolio is an artifact, never a wish. Reuse the same root for all photo deeds. */
export async function ensurePhotographyWish(context: PortfolioWishContext): Promise<WishLink> {
  const user = await getAuthenticatedUser();
  const roots = await findOwnerWishes();
  const found = chooseParent(roots, context);
  if (found) return { wishId: found.id, created: false };
  if (wishesRemaining(roots.length) < 1) {
    throw new Error('Your three wishes are already in use. Delete an unused wish to continue.');
  }
  const db = getSupabase();
  const { data, error } = await db.from('wishes').insert({
    user_id: user.id,
    aspiration: context.aspiration?.trim() || 'I want to build my photography portfolio',
    kind: 'photography',
    mission_id: context.missionId || 'build-portfolio',
    answer: context.answer || 'portfolio-creation',
    status: 'PLANNED'
  }).select('id').single();
  if (error) {
    // Concurrent creation in another tab may have saved the same photo wish.
    if (error.message.includes('WISH_ALREADY_EXISTS')) {
      const refreshed = (await findOwnerWishes()).find(w => w.kind === 'photography');
      if (refreshed) return { wishId: refreshed.id, created: false };
    }
    if (error.message.includes('WISH_LIMIT_REACHED')) {
      throw new Error('All three wish slots are already occupied.');
    }
    throw error;
  }
  if (!data) throw new Error('Could not confirm your new photography wish.');
  return { wishId: data.id as string, created: true };
}

/** Best-effort rollback for a root created just before a failed first portfolio save.
 * FK RESTRICT refuses deletion if any other artifact has already attached to it.
 */
export async function rollbackUnusedWish(link: WishLink | null): Promise<void> {
  if (!link?.created) return;
  const { error } = await getSupabase().from('wishes').delete().eq('id', link.wishId);
  if (error) console.warn('New wish could not be removed after failed portfolio upload', error.message);
}
