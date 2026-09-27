export interface GitHubAppConfig {
  enabled: boolean;
  writeEnabled?: boolean | undefined;
  appId: string;
  appSlug?: string | undefined;
  privateKeyPath?: string | undefined;
  privateKey?: string | undefined;
  installationId: string;
  repositoryId: string;
  owner: string;
  repository: string;
  mode: 'OBSERVE'|'PROPOSE'|'DISABLED';
}

/**
 * Safely normalizes PEM private key strings from environment variables.
 * Handles:
 * - Literal newlines
 * - Escaped newlines (\n, \r\n)
 * - Surrounding quotes (single or double quotes)
 * - Windows CRLF to LF
 * - Leading and trailing whitespace
 *
 * Never alters actual base64 payload or PEM markers.
 */
export function normalizePrivateKeyPem(raw?: string | null): string {
  if (!raw) return '';
  let key = raw.trim();
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1).trim();
  }
  key = key.replace(/\r\n/g, '\n');
  if (key.includes('\\n')) {
    key = key.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n');
  }
  return key.trim();
}

export function loadGitHubAppConfig(env: NodeJS.ProcessEnv = process.env): GitHubAppConfig {
  if (env === process.env && typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
    try { (process as unknown as { loadEnvFile: () => void }).loadEnvFile(); } catch { /* .env optional */ }
  }
  const enabled = env.APIPROOF_ENABLE_LIVE_GITHUB === 'true';
  const writeEnabled = env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'true';
  const value = (name: string) => env[name]?.trim() ?? '';
  const privateKey = normalizePrivateKeyPem(env.GITHUB_APP_PRIVATE_KEY);
  const privateKeyPath = value('GITHUB_APP_PRIVATE_KEY_PATH');

  return {
    enabled,
    writeEnabled,
    appId: value('GITHUB_APP_ID'),
    appSlug: value('GITHUB_APP_SLUG') || 'apiproof',
    privateKeyPath,
    privateKey: privateKey || undefined,
    installationId: value('GITHUB_INSTALLATION_ID'),
    repositoryId: value('GITHUB_ALLOWED_REPOSITORY_ID'),
    owner: value('GITHUB_ALLOWED_REPOSITORY_OWNER'),
    repository: value('GITHUB_ALLOWED_REPOSITORY_NAME'),
    mode: writeEnabled ? 'PROPOSE' : 'OBSERVE',
  };
}

export function assertLiveConfig(config: GitHubAppConfig, isProduction: boolean = process.env.NODE_ENV === 'production'): void {
  if (!config.enabled) throw new Error('LIVE_GITHUB_OBSERVE_NOT_EXECUTED');
  for (const name of ['appId', 'installationId', 'repositoryId', 'owner', 'repository'] as const) {
    if (!config[name]) throw new Error(`GITHUB_CONFIG_MISSING_${name.toUpperCase()}`);
  }

  if (isProduction) {
    // In production (Vercel / Cloud), GITHUB_APP_PRIVATE_KEY is strictly required. Filesystem key paths are forbidden.
    if (!config.privateKey) {
      throw new Error('GITHUB_CONFIG_MISSING_PRIVATE_KEY: Production requires GITHUB_APP_PRIVATE_KEY to be configured in environment variables. Filesystem key paths are forbidden in production.');
    }
  } else {
    // In local development / testing, either privateKey or privateKeyPath must be supplied.
    if (!config.privateKey && !config.privateKeyPath) {
      throw new Error('GITHUB_CONFIG_MISSING_PRIVATEKEYPATH');
    }
  }

  if (!/^\d+$/.test(config.appId)) throw new Error('GITHUB_CONFIG_INVALID_APP_ID');
  if (!/^\d+$/.test(config.installationId)) throw new Error('GITHUB_CONFIG_INVALID_INSTALLATION_ID');
  if (!/^\d+$/.test(config.repositoryId)) throw new Error('GITHUB_CONFIG_INVALID_REPOSITORY_ID');
  if (!/^[a-zA-Z0-9_.-]+$/.test(config.owner)) throw new Error('GITHUB_CONFIG_INVALID_OWNER');
  if (!/^[a-zA-Z0-9_.-]+$/.test(config.repository)) throw new Error('GITHUB_CONFIG_INVALID_REPOSITORY');
}

