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

export type SlackConnectionStatus = { connected: boolean; teamName?: string; connectedAt?: string };

function text(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= max ? normalized : null;
}

export function parseSlackStatusResponse(value: unknown): SlackConnectionStatus | null {
  if (!isRecord(value) || typeof value.connected !== 'boolean') return null;
  const teamName = value.teamName === undefined ? undefined : text(value.teamName, 256);
  const connectedAt = value.connectedAt === undefined ? undefined : text(value.connectedAt, 128);
  if (value.teamName !== undefined && !teamName || value.connectedAt !== undefined && !connectedAt) return null;
  return { connected: value.connected, ...(teamName ? { teamName } : {}), ...(connectedAt ? { connectedAt } : {}) };
}

export function parseSlackConnectResponse(value: unknown): { url: string } | null {
  if (!isRecord(value) || typeof value.url !== 'string') return null;
  try {
    const url = new URL(value.url);
    return url.protocol === 'https:' && url.hostname === 'slack.com' && url.pathname === '/oauth/v2/authorize' && !url.username && !url.password ? { url: url.toString() } : null;
  } catch {
    return null;
  }
}
