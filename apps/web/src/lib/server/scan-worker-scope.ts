import { isLiveScanProtectionEnabled } from './founder-scan-authorization.js';

export interface ScanWorkerScopeOptions {
  repositoryId?: string | undefined;
}

export function buildWorkerScope(
  engine: 'postgres' | 'sqlite',
  options: ScanWorkerScopeOptions,
  founderUserId: string | null,
  startIndex: number,
): { sql: string; params: string[]; nextIndex: number } {
  const postgres = engine === 'postgres';
  const params: string[] = [];
  let nextIndex = startIndex;
  const filters: string[] = [];

  if (options.repositoryId) {
    filters.push(postgres
      ? `github_scan_requests.repository_id = $${nextIndex++}`
      : 'github_scan_requests.repository_id = ?');
    params.push(options.repositoryId);
  }

  if (isLiveScanProtectionEnabled()) {
    filters.push(postgres
      ? `EXISTS (SELECT 1 FROM workspace_members owner_member WHERE owner_member.workspace_id = github_scan_requests.workspace_id AND owner_member.role = 'owner' AND owner_member.user_id = $${nextIndex++})`
      : `EXISTS (SELECT 1 FROM workspace_members owner_member WHERE owner_member.workspace_id = github_scan_requests.workspace_id AND owner_member.role = 'owner' AND owner_member.user_id = ?)`);
    if (founderUserId) params.push(founderUserId);
  }

  return {
    sql: filters.length > 0 ? ` AND ${filters.join(' AND ')}` : '',
    params,
    nextIndex,
  };
}
