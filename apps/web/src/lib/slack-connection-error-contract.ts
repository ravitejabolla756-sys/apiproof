function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readSlackErrorCode(value: unknown): string | null {
  if (!isRecord(value) || typeof value.code !== 'string') return null;
  const code = value.code.trim();
  return code.length > 0 ? code : null;
}

export function slackConnectionErrorMessage(status: number, code: string | null, fallback: string): string {
  if (status === 401 || code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.';
  if (status === 403 || code === 'WORKSPACE_CAPABILITY_DENIED') return 'You do not have permission to manage this workspace connection.';
  if (status === 503 || code?.startsWith('SLACK_') || code?.endsWith('_SCHEMA_UNAVAILABLE')) return 'Slack connection is temporarily unavailable.';
  return fallback;
}
