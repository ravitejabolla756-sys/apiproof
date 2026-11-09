export type GitHubInstallationProjection = {
  connected: boolean;
  installation: { id: string; accountLogin: string; accountType: string } | null;
};

export function parseGitHubConnectionStatus(value: unknown): boolean | null {
  return record(value) && typeof value.connected === 'boolean' ? value.connected : null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/** Validate the workspace-scoped GitHub connection status used by settings. */
export function parseGitHubInstallationResponse(value: unknown): GitHubInstallationProjection | null {
  if (!record(value) || typeof value.connected !== 'boolean') return null;
  if (value.installation === undefined || value.installation === null) return { connected: value.connected, installation: null };
  if (!record(value.installation) || !text(value.installation.id) || !text(value.installation.accountLogin) || !text(value.installation.accountType)) return null;
  return {
    connected: value.connected,
    installation: {
      id: value.installation.id,
      accountLogin: value.installation.accountLogin,
      accountType: value.installation.accountType,
    },
  };
}
