import type { DatabaseAdapter } from './types.js';

/**
 * PostgreSQL worker authorization is intentionally a database-owned boundary.
 *
 * The HTTP HMAC proves that a caller may invoke the worker endpoint, but it is
 * not itself a tenant identity and must not be copied into a PostgreSQL GUC or
 * SQL parameter as a bearer claim. An approved deployment must provision the
 * zero-argument bridge below so its result is bound to the authenticated
 * database role/connection. Until then, PostgreSQL workers fail closed.
 */
export const TRUSTED_WORKER_BRIDGE = 'apiproof_security.has_trusted_worker_identity()';

export class PostgresWorkerAuthorizationError extends Error {
  constructor(public readonly code: 'WORKER_DATABASE_AUTH_UNAVAILABLE' | 'WORKER_DATABASE_AUTH_DENIED') {
    super(code);
    this.name = 'PostgresWorkerAuthorizationError';
  }
}

export async function assertWorkerDatabaseAuthorization(db: DatabaseAdapter): Promise<void> {
  if (db.engine !== 'postgres') return;

  const bridge = await db.queryOne<{ available: boolean }>(
    'SELECT to_regprocedure(?) IS NOT NULL AS available',
    [TRUSTED_WORKER_BRIDGE],
  );
  if (!bridge?.available) {
    throw new PostgresWorkerAuthorizationError('WORKER_DATABASE_AUTH_UNAVAILABLE');
  }

  const decision = await db.queryOne<{ allowed: boolean }>(
    `SELECT ${TRUSTED_WORKER_BRIDGE} AS allowed`,
  );
  if (!decision?.allowed) {
    throw new PostgresWorkerAuthorizationError('WORKER_DATABASE_AUTH_DENIED');
  }
}
