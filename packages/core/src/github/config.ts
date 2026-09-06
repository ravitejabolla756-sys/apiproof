export interface GitHubAppConfig { enabled: boolean; appId: string; privateKeyPath: string; installationId: string; repositoryId: string; owner: string; repository: string; mode: 'OBSERVE'|'PROPOSE'|'DISABLED' }
export function loadGitHubAppConfig(env: NodeJS.ProcessEnv = process.env): GitHubAppConfig {
  const enabled = env.APIPROOF_ENABLE_LIVE_GITHUB === 'true';
  const value = (name: string) => env[name]?.trim() ?? '';
  return { enabled, appId: value('GITHUB_APP_ID'), privateKeyPath: value('GITHUB_APP_PRIVATE_KEY_PATH'), installationId: value('GITHUB_INSTALLATION_ID'), repositoryId: value('GITHUB_ALLOWED_REPOSITORY_ID'), owner: value('GITHUB_ALLOWED_REPOSITORY_OWNER'), repository: value('GITHUB_ALLOWED_REPOSITORY_NAME'), mode: 'OBSERVE' };
}
export function assertLiveConfig(config: GitHubAppConfig) { if (!config.enabled) throw new Error('LIVE_GITHUB_OBSERVE_NOT_EXECUTED'); for (const [name, value] of Object.entries(config)) if (['appId','privateKeyPath','installationId','repositoryId','owner','repository'].includes(name) && !value) throw new Error(`GITHUB_CONFIG_MISSING_${name.toUpperCase()}`); if (config.mode !== 'OBSERVE') throw new Error('GITHUB_OBSERVE_ONLY_REQUIRED'); }
