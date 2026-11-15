export type SavedWish = {
  id: string;
  aspiration: string;
  kind: string;
  mission_id: string;
  answer: string;
  status: 'PLANNED';
  created_at: string;
  first_artifact?: unknown;
};

type ArtifactRow = { id: string; first_artifact: unknown };
type QueryResult<T> = { data: T[] | null; error: { message: string; code?: string } | null };

export function dataErrorMessage(cause: unknown, fallback: string): string {
  if (cause && typeof cause === 'object' && 'message' in cause) return String(cause.message);
  return typeof cause === 'string' ? cause : fallback;
}

export async function loadOptionalSavedRows<T>(label: string, query: PromiseLike<QueryResult<T>>): Promise<{ rows: T[]; warning: string | null }> {
  try {
    const result = await query;
    if (result.error) throw result.error;
    return { rows: result.data || [], warning: null };
  } catch (cause) {
    return { rows: [], warning: `${label} could not load: ${dataErrorMessage(cause, 'Unknown data error')}` };
  }
}

/** Existing wish rows stay readable while the F02-001 columns are unavailable. */
export async function loadSavedWishRows(
  baseQuery: () => PromiseLike<QueryResult<SavedWish>>,
  artifactQuery: (ids: string[]) => PromiseLike<QueryResult<ArtifactRow>>
): Promise<{ wishes: SavedWish[]; warning: string | null; artifactStatus: 'available' | 'migration-missing' | 'unavailable' }> {
  const base = await baseQuery();
  if (base.error) throw base.error;
  const wishes = base.data || [];
  if (!wishes.length) return { wishes, warning: null, artifactStatus: 'available' };

  try {
    const artifacts = await artifactQuery(wishes.map(wish => wish.id));
    if (artifacts.error) throw artifacts.error;
    const byId = new Map((artifacts.data || []).map(row => [row.id, row.first_artifact]));
    return { wishes: wishes.map(wish => ({ ...wish, first_artifact: byId.get(wish.id) })), warning: null, artifactStatus: 'available' };
  } catch (cause) {
    const detail = dataErrorMessage(cause, 'Unknown data error');
    const missingMigration = cause && typeof cause === 'object' && 'code' in cause && cause.code === '42703' && /first_artifact/.test(detail);
    return { wishes, warning: `First-Deed details could not load (check the F02-001 migration): ${detail}`,
      artifactStatus: missingMigration ? 'migration-missing' : 'unavailable' };
  }
}
