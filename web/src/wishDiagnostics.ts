import { browserDiagnostic, diagnosticCode } from './browserDiagnostics';

const schemaCodes = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205']);

type Operation = 'list' | 'open' | 'save' | 'edit' | 'continue' | 'delete';

export class WishPersistenceError extends Error {
  readonly code?: string;

  constructor(readonly step: string, cause: unknown, readonly status?: number) {
    const code = diagnosticCode((cause as { code?: unknown } | null)?.code);
    const message = code && schemaCodes.has(code)
      ? 'This database is missing the Wish workspace schema. Use a local Supabase instance with the F03 migration or contact support.'
      : 'Wish storage could not complete the request. Please try again.';
    super(message);
    this.code = code;
  }
}

export async function logWishOperation<T>(operation: Operation, run: () => Promise<T>): Promise<T> {
  browserDiagnostic('info', `wish.${operation}.started`);
  try {
    const result = await run();
    browserDiagnostic('info', `wish.${operation}.succeeded`);
    return result;
  } catch (error) {
    if (error instanceof WishPersistenceError) {
      // Database messages/details can contain row values. Log only the diagnostic fields.
      browserDiagnostic('error', `wish.${operation}.failed`, {
        step: error.step,
        code: error.code,
        status: error.status,
        reason: error.code && schemaCodes.has(error.code) ? 'workspace schema unavailable' : 'database request failed',
      });
    } else if (error instanceof Error && error.name === 'WishSignInRequired') {
      browserDiagnostic('info', `wish.${operation}.sign_in_required`);
    } else {
      browserDiagnostic('error', `wish.${operation}.failed`, { reason: 'could not complete the operation' });
    }
    throw error;
  }
}
