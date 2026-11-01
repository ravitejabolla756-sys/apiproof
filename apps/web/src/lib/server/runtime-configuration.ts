export type RuntimeConfiguration = {
  database: boolean;
  applicationSecret: boolean;
  cronSecret: boolean;
  githubApp: boolean;
  githubInstallation: boolean;
  githubWebhook: boolean;
  publicAppUrl: boolean;
  liveGithubEnabled: boolean;
  liveGithubWriteEnabled: boolean;
  productizationV1Enabled: boolean;
  readyForLiveBeta: boolean;
};

function present(environment: NodeJS.ProcessEnv, key: string): boolean {
  return Boolean(environment[key]?.trim());
}

function meetsMinimum(environment: NodeJS.ProcessEnv, key: string, minimum: number): boolean {
  return (environment[key]?.trim().length ?? 0) >= minimum;
}

function allPresent(environment: NodeJS.ProcessEnv, keys: readonly string[]): boolean {
  return keys.every((key) => present(environment, key));
}

function hasHttpsUrl(environment: NodeJS.ProcessEnv): boolean {
  const raw = environment.APIPROOF_APP_URL?.trim() || environment.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return false;
  try {
    return new URL(raw).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Reports configuration classes without returning secret values.
 * `readyForLiveBeta` deliberately requires read-only GitHub mode: repository
 * writes remain a separate, explicitly reviewed capability.
 */
export function getRuntimeConfiguration(environment: NodeJS.ProcessEnv = process.env): RuntimeConfiguration {
  const database = present(environment, 'DATABASE_URL') || present(environment, 'APIPROOF_DATABASE_URL');
  const applicationSecret = meetsMinimum(environment, 'APIPROOF_SECRET', 32);
  const cronSecret = meetsMinimum(environment, 'CRON_SECRET', 16);
  // Production GitHub auth is environment-backed. A filesystem key path is
  // valid only for local development and must never satisfy the live-beta
  // gate because Vercel production rejects path-based private keys.
  const githubApp = allPresent(environment, ['GITHUB_APP_ID', 'GITHUB_APP_SLUG', 'GITHUB_APP_PRIVATE_KEY'])
    && /^\d+$/.test(environment.GITHUB_APP_ID?.trim() ?? '')
    && (environment.GITHUB_APP_PRIVATE_KEY?.includes('PRIVATE KEY') ?? false);
  const githubInstallation = allPresent(environment, [
    'GITHUB_INSTALLATION_ID',
    'GITHUB_ALLOWED_REPOSITORY_ID',
    'GITHUB_ALLOWED_REPOSITORY_OWNER',
    'GITHUB_ALLOWED_REPOSITORY_NAME',
  ])
    && /^\d+$/.test(environment.GITHUB_INSTALLATION_ID?.trim() ?? '')
    && /^\d+$/.test(environment.GITHUB_ALLOWED_REPOSITORY_ID?.trim() ?? '')
    && /^[a-zA-Z0-9_.-]+$/.test(environment.GITHUB_ALLOWED_REPOSITORY_OWNER?.trim() ?? '')
    && /^[a-zA-Z0-9_.-]+$/.test(environment.GITHUB_ALLOWED_REPOSITORY_NAME?.trim() ?? '');
  const githubWebhook = meetsMinimum(environment, 'GITHUB_WEBHOOK_SECRET', 16);
  const publicAppUrl = hasHttpsUrl(environment);
  const liveGithubEnabled = environment.APIPROOF_ENABLE_LIVE_GITHUB === 'true';
  const liveGithubWriteEnabled = environment.APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'true';
  const productizationV1Enabled = environment.PROVIDER_INTELLIGENCE_V1_ENABLED === 'true';
  return {
    database,
    applicationSecret,
    cronSecret,
    githubApp,
    githubInstallation,
    githubWebhook,
    publicAppUrl,
    liveGithubEnabled,
    liveGithubWriteEnabled,
    productizationV1Enabled,
    readyForLiveBeta: database && applicationSecret && cronSecret && githubApp && githubInstallation && githubWebhook && publicAppUrl && liveGithubEnabled && productizationV1Enabled && !liveGithubWriteEnabled,
  };
}
