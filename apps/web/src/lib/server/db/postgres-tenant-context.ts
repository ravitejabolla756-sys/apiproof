import type { DatabaseAdapter } from './types.js';

export class PostgresTenantContextError extends Error {
  constructor(public readonly code: 'TENANT_CONTEXT_INVALID' | 'TENANT_MEMBERSHIP_REQUIRED') {
    super(code);
    this.name = 'PostgresTenantContextError';
  }
}

/**
 * Runs a protected operation with a transaction-local PostgreSQL tenant context.
 *
 * The user and workspace identifiers must come from server-side authentication
 * and workspace authorization. PostgreSQL custom settings are defense in depth;
 * they are not an independent identity provider for an application role.
 */
export async function withPostgresTenantContext<T>(
  db: DatabaseAdapter,
  userId: string,
  workspaceId: string,
  operation: (tx: DatabaseAdapter) => Promise<T>,
): Promise<T> {
  if (!userId.trim() || !workspaceId.trim()) {
    throw new PostgresTenantContextError('TENANT_CONTEXT_INVALID');
  }

  return db.transaction(async (tx) => {
    if (tx.engine !== 'postgres') return operation(tx);

    const membership = await tx.queryOne<{ role: string }>(
      `SELECT role
       FROM workspace_members
       WHERE workspace_id = ? AND user_id = ?
       FOR SHARE`,
      [workspaceId, userId],
    );
    if (!membership) throw new PostgresTenantContextError('TENANT_MEMBERSHIP_REQUIRED');

    await tx.execute(
      `SELECT set_config('app.user_id', ?, true),
              set_config('app.workspace_id', ?, true)`,
      [userId, workspaceId],
    );

    return operation(tx);
  });
}
