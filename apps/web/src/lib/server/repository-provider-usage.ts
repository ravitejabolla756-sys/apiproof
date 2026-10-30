import type { DatabaseAdapter } from './db/types.js';

/**
 * Replaces the provider evidence for one completed repository snapshot.
 * Failed or incomplete scans never call this helper, so the previous index
 * remains available for rescan routing.
 */
export async function replaceRepositoryProviderUsage(
  db: DatabaseAdapter,
  input: {
    repositoryId: string;
    workspaceId: string;
    scanId: string;
    observedAt: string;
    providerIds: readonly string[];
  },
): Promise<void> {
  const providerIds = [...new Set(input.providerIds.map((providerId) => providerId.trim()).filter(Boolean))].sort();
  await db.execute('DELETE FROM repository_provider_usage WHERE repository_id = ?', [input.repositoryId]);
  for (const providerId of providerIds) {
    await db.execute(`
      INSERT INTO repository_provider_usage (
        repository_id, workspace_id, provider_id, last_scan_id, last_seen_at, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [input.repositoryId, input.workspaceId, providerId, input.scanId, input.observedAt, input.observedAt, input.observedAt]);
  }
}

