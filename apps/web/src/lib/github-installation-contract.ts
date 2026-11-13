export interface GitHubInstallationInfo {
  id: string;
  accountLogin: string;
  accountType: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function parseInstallation(value: unknown): GitHubInstallationInfo | undefined {
  const row = record(value);
  if (!row) return undefined;
  const id = text(row.id, 256);
  const accountLogin = text(row.accountLogin, 256);
  const accountType = text(row.accountType, 128);
  return id && accountLogin && accountType ? { id, accountLogin, accountType } : undefined;
}

export function parseGitHubInstallationResponse(value: unknown): GitHubInstallationInfo | null | undefined {
  const payload = record(value);
  if (!payload || typeof payload.connected !== 'boolean') return undefined;
  if (!payload.connected) return null;
  return parseInstallation(payload.installation);
}

export function parseGitHubInstallRedirect(value: unknown): string | undefined {
  const payload = record(value);
  const url = payload?.url;
  return typeof url === 'string' && /^https:\/\//i.test(url) && url.length <= 2048 ? url : undefined;
}
