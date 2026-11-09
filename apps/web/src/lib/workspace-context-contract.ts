export type WorkspaceContextOption = { id: string; name: string };

export type WorkspaceContextProjection = {
  activeWorkspaceId: string | null;
  workspaces: WorkspaceContextOption[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Validate the server-owned workspace selector projection before rendering it. */
export function parseWorkspaceContext(payload: unknown): WorkspaceContextProjection | null {
  if (!isRecord(payload) || !Array.isArray(payload.workspaces)) return null;
  if (payload.activeWorkspaceId !== null && typeof payload.activeWorkspaceId !== 'string') return null;

  const seen = new Set<string>();
  const workspaces: WorkspaceContextOption[] = [];
  for (const item of payload.workspaces) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0 || typeof item.name !== 'string' || item.name.length === 0) return null;
    if (seen.has(item.id)) return null;
    seen.add(item.id);
    workspaces.push({ id: item.id, name: item.name });
  }

  const activeWorkspaceId = payload.activeWorkspaceId;
  if (activeWorkspaceId !== null && !seen.has(activeWorkspaceId)) return null;
  if (workspaces.length === 0 && activeWorkspaceId !== null) return null;
  return { activeWorkspaceId, workspaces };
}
