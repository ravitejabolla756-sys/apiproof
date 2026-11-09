export type GitHubRepositoryPickerProjection = {
  connected: boolean;
  repositories: Array<{
    id: string;
    name: string;
    fullName: string;
    owner: string;
    private: boolean;
    defaultBranch: string;
  }>;
};

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate the workspace-scoped GitHub repository picker projection. */
export function parseGitHubRepositoryPickerResponse(value: unknown): GitHubRepositoryPickerProjection | null {
  if (!record(value) || typeof value.connected !== 'boolean' || !Array.isArray(value.repositories)) return null;
  const ids = new Set<string>();
  const repositories: GitHubRepositoryPickerProjection['repositories'] = [];
  for (const item of value.repositories) {
    if (!record(item) || !text(item.id) || !text(item.name) || !text(item.fullName) || !text(item.owner) || typeof item.private !== 'boolean' || !text(item.defaultBranch) || ids.has(item.id)) return null;
    ids.add(item.id);
    repositories.push({ id: item.id, name: item.name, fullName: item.fullName, owner: item.owner, private: item.private, defaultBranch: item.defaultBranch });
  }
  return { connected: value.connected, repositories };
}
