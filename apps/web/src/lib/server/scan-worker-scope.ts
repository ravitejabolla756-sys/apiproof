export interface ScanWorkerScopeOptions {
  repositoryId?: string | undefined;
}

export function buildWorkerScope(
  engine: 'postgres' | 'sqlite',
  options: ScanWorkerScopeOptions,
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

  return {
    sql: filters.length > 0 ? ` AND ${filters.join(' AND ')}` : '',
    params,
    nextIndex,
  };
}
