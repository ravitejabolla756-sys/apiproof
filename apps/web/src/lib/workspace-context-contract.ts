export type WorkspaceContextOption = { id: string; name: string };

export type WorkspaceContextProjection = {
  activeWorkspaceId: string | null;
  workspaces: WorkspaceContextOption[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate the server-owned workspace selector projection before rendering it. */
export function parseWorkspaceContext(payload: unknown): WorkspaceContextProjection | null {
  if (!isRecord(payload) || !Array.isArray(payload.workspaces)) return null;
  if (payload.activeWorkspaceId !== null && typeof payload.activeWorkspaceId !== 'string') return null;

  const seen = new Set<string>();
  const workspaces: WorkspaceContextOption[] = [];
  for (const item of payload.workspaces) {
    if (!isRecord(item) || !isNonEmptyText(item.id) || !isNonEmptyText(item.name)) return null;
    if (seen.has(item.id)) return null;
    seen.add(item.id);
    workspaces.push({ id: item.id, name: item.name });
  }

  const activeWorkspaceId = payload.activeWorkspaceId;
  if (activeWorkspaceId !== null && !seen.has(activeWorkspaceId)) return null;
  if (workspaces.length === 0 && activeWorkspaceId !== null) return null;
  return { activeWorkspaceId, workspaces };
}
