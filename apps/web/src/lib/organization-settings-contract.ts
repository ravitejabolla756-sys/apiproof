export type WorkspaceSettingsProjection = {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'member';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

export function parseWorkspaceSettings(payload: unknown): WorkspaceSettingsProjection | null {
  if (!isRecord(payload) || !isRecord(payload.workspace)) return null;
  const workspace = payload.workspace;
  if (!isNonEmptyString(workspace.id) || !isNonEmptyString(workspace.name) || !isNonEmptyString(workspace.slug) || (workspace.role !== 'owner' && workspace.role !== 'member')) return null;
  return { id: workspace.id, name: workspace.name, slug: workspace.slug, role: workspace.role };
}
