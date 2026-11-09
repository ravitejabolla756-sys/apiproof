export type RepositoryProjection = {
  id: string;
  owner: string;
  name: string;
  full_name: string;
  github_repository_id: string;
  default_branch: string;
  status: string;
  last_scan_at: string | null;
  created_at: string;
  findings_count: number;
  scans_count: number;
  last_scan_sha: string | null;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function optionalText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Validate the server-owned repository collection before filtering or rendering it. */
export function parseRepositoryCollection(payload: unknown): RepositoryProjection[] | null {
  if (!record(payload) || !Array.isArray(payload.repositories)) return null;
  const seen = new Set<string>();
  const repositories: RepositoryProjection[] = [];
  for (const item of payload.repositories) {
    if (!record(item)) return null;
    const id = text(item.id);
    const owner = text(item.owner);
    const name = text(item.name);
    const fullName = text(item.full_name);
    const githubRepositoryId = text(item.github_repository_id);
    const defaultBranch = text(item.default_branch);
    const status = text(item.status);
    const createdAt = text(item.created_at);
    if (!id || !owner || !name || !fullName || !githubRepositoryId || !defaultBranch || !status || !createdAt || !count(item.findings_count) || !count(item.scans_count) || seen.has(id)) return null;
    seen.add(id);
    repositories.push({
      id, owner, name, full_name: fullName, github_repository_id: githubRepositoryId, default_branch: defaultBranch, status,
      last_scan_at: optionalText(item.last_scan_at), created_at: createdAt, findings_count: item.findings_count, scans_count: item.scans_count,
      last_scan_sha: optionalText(item.last_scan_sha),
    });
  }
  return repositories;
}
