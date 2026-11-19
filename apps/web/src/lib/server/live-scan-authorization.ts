/** Shared live-scan rollout configuration. */

export const LIVE_GITHUB_ENABLED_ENV = 'APIPROOF_ENABLE_LIVE_GITHUB';

export type LiveScanAuthorizationErrorCode = 'LIVE_SCAN_DISABLED' | 'LIVE_SCAN_REPOSITORY_SCOPE_REQUIRED';

export class LiveScanAuthorizationError extends Error {
  readonly code: LiveScanAuthorizationErrorCode;

  constructor(code: LiveScanAuthorizationErrorCode) {
    super(code);
    this.name = 'LiveScanAuthorizationError';
    this.code = code;
  }
}

export function isLiveScanEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env[LIVE_GITHUB_ENABLED_ENV] === 'true';
}

export function assertLiveScanEnabled(
  env: Record<string, string | undefined> = process.env,
): void {
  if (!isLiveScanEnabled(env)) {
    throw new LiveScanAuthorizationError('LIVE_SCAN_DISABLED');
  }
}

export function assertRepositoryScope(repositoryId: string | undefined): void {
  if (!repositoryId || !/^[A-Za-z0-9_.-]{1,150}$/.test(repositoryId)) {
    throw new LiveScanAuthorizationError('LIVE_SCAN_REPOSITORY_SCOPE_REQUIRED');
  }
}
