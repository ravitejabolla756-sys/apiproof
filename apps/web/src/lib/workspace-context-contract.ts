export type WorkspaceContextSelection = {
  workspace: {
    id: string;
    name: string;
  };
};

export type WorkspaceContextError = {
  code: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseWorkspaceContextSelection(payload: unknown): WorkspaceContextSelection | null {
  if (!isRecord(payload) || !isRecord(payload.workspace)) return null;
  const id = nonEmptyString(payload.workspace.id);
  const name = nonEmptyString(payload.workspace.name);
  if (!id || !name) return null;
  return { workspace: { id, name } };
}

export function readWorkspaceContextError(payload: unknown): WorkspaceContextError | null {
  if (!isRecord(payload)) return null;
  const code = nonEmptyString(payload.code);
  return code ? { code } : null;
}

export function workspaceContextErrorMessage(status: number, code: string | null): string {
  if (status === 404 || code === 'WORKSPACE_ACCESS_DENIED') {
    return 'You no longer have access to that workspace.';
  }
  if (code === 'ORGANIZATION_SCHEMA_UNAVAILABLE') {
    return 'Workspace switching is temporarily unavailable.';
  }
  return 'Workspace could not be selected. Please try again.';
}
