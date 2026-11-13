export type WorkspaceSettingsProjection = {
  id: string;
  name: string;
  slug: string;
  role: 'owner' | 'member';
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseWorkspaceSettings(payload: unknown): WorkspaceSettingsProjection | null {
  if (!isRecord(payload) || !isRecord(payload.workspace)) return null;
  const workspace = payload.workspace;
  const id = normalizedText(workspace.id);
  const name = normalizedText(workspace.name);
  const slug = normalizedText(workspace.slug);
  if (!id || !name || !slug || (workspace.role !== 'owner' && workspace.role !== 'member')) return null;
  return { id, name, slug, role: workspace.role };
}
