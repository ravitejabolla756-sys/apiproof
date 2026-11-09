export type WorkspaceContextOption = { id: string; name: string };

export type WorkspaceContextProjection = {
  activeWorkspaceId: string | null;
  workspaces: WorkspaceContextOption[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

/** Validate the server-owned workspace selector projection before rendering it. */
export function parseWorkspaceContext(payload: unknown): WorkspaceContextProjection | null {
  if (!isRecord(payload) || !Array.isArray(payload.workspaces)) return null;
  const activeWorkspaceId = payload.activeWorkspaceId === null ? null : normalizedText(payload.activeWorkspaceId);
  if (payload.activeWorkspaceId !== null && !activeWorkspaceId) return null;

  const seen = new Set<string>();
  const workspaces: WorkspaceContextOption[] = [];
  for (const item of payload.workspaces) {
    if (!isRecord(item)) return null;
    const id = normalizedText(item.id);
    const name = normalizedText(item.name);
    if (!id || !name) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    workspaces.push({ id, name });
  }

  if (activeWorkspaceId !== null && !seen.has(activeWorkspaceId)) return null;
  if (workspaces.length === 0 && activeWorkspaceId !== null) return null;
  return { activeWorkspaceId, workspaces };
}
