function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function codeOf(value: unknown): string | null {
  if (!isRecord(value) || typeof value.code !== 'string') return null;
  const code = value.code.trim();
  return code.length > 0 ? code : null;
}

export function workspaceSettingsErrorMessage(status: number, payload: unknown, fallback: string): string {
  const code = codeOf(payload);
  if (status === 401 || code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.';
  if (status === 404 || code === 'WORKSPACE_ACCESS_DENIED') return 'This workspace is unavailable or you no longer have access.';
  if (status === 403 || code === 'WORKSPACE_CAPABILITY_DENIED') return 'You do not have permission to perform this workspace action.';
  if (status === 409 && (code === 'FINAL_OWNER_PROTECTED' || code === 'LAST_OWNER_REQUIRED')) return 'The final workspace owner cannot be removed or demoted.';
  if (status === 503 || code?.endsWith('_SCHEMA_UNAVAILABLE')) return 'This workspace feature is temporarily unavailable.';
  return fallback;
}
