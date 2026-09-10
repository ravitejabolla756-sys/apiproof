export interface GitHubAppConfig { enabled: boolean; writeEnabled?: boolean; appId: string; privateKeyPath: string; installationId: string; repositoryId: string; owner: string; repository: string; mode: 'OBSERVE'|'PROPOSE'|'DISABLED' }
export function loadGitHubAppConfig(env: NodeJS.ProcessEnv = process.env): GitHubAppConfig {
  if (env === process.env && typeof (process as unknown as { loadEnvFile?: () => void }).loadEnvFile === 'function') {
    try { (process as unknown as { loadEnvFile: () => void }).loadEnvFile(); } catch { /* .env optional */ }
  }
  const enabled = env.APIPROOF_ENABLE_LIVE_GITHUB === 'true';
  const writeEnabled = env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'true';
  const value = (name: string) => env[name]?.trim() ?? '';
  return { enabled, writeEnabled, appId: value('GITHUB_APP_ID'), privateKeyPath: value('GITHUB_APP_PRIVATE_KEY_PATH'), installationId: value('GITHUB_INSTALLATION_ID'), repositoryId: value('GITHUB_ALLOWED_REPOSITORY_ID'), owner: value('GITHUB_ALLOWED_REPOSITORY_OWNER'), repository: value('GITHUB_ALLOWED_REPOSITORY_NAME'), mode: writeEnabled ? 'PROPOSE' : 'OBSERVE' };
}
export function assertLiveConfig(config: GitHubAppConfig): void {
  if (!config.enabled) throw new Error('LIVE_GITHUB_OBSERVE_NOT_EXECUTED');
  for (const name of ['appId', 'privateKeyPath', 'installationId', 'repositoryId', 'owner', 'repository'] as const) {
    if (!config[name]) throw new Error(`GITHUB_CONFIG_MISSING_${name.toUpperCase()}`);
  }
  if (!/^\d+$/.test(config.appId)) throw new Error('GITHUB_CONFIG_INVALID_APP_ID');
  if (!/^\d+$/.test(config.installationId)) throw new Error('GITHUB_CONFIG_INVALID_INSTALLATION_ID');
  if (!/^\d+$/.test(config.repositoryId)) throw new Error('GITHUB_CONFIG_INVALID_REPOSITORY_ID');
  if (!/^[a-zA-Z0-9_.-]+$/.test(config.owner)) throw new Error('GITHUB_CONFIG_INVALID_OWNER');
  if (!/^[a-zA-Z0-9_.-]+$/.test(config.repository)) throw new Error('GITHUB_CONFIG_INVALID_REPOSITORY');
}
