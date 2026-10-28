/**
 * Server-side authorization boundary for live GitHub scans.
 *
 * The configured user ID is an opaque server-side identifier. It is never
 * returned to callers or included in logs. Local fixture scans remain usable
 * when live GitHub mode is disabled; production/live mode fails closed until
 * the founder ID is explicitly configured.
 */

const FOUNDER_USER_ID_PATTERN = /^usr_[A-Za-z0-9_-]+$/;

export const FOUNDER_SCAN_USER_ID_ENV = 'APIPROOF_FOUNDER_USER_ID';

export type FounderScanAuthorizationErrorCode =
  | 'FOUNDER_SCAN_ID_NOT_CONFIGURED'
  | 'FOUNDER_SCAN_NOT_AUTHORIZED'
  | 'FOUNDER_SCAN_REPOSITORY_SCOPE_REQUIRED';

export class FounderScanAuthorizationError extends Error {
  readonly code: FounderScanAuthorizationErrorCode;

  constructor(code: FounderScanAuthorizationErrorCode) {
    super(code);
    this.name = 'FounderScanAuthorizationError';
    this.code = code;
  }
}

/** Live GitHub scanning is the point at which founder-only access is required. */
export function isLiveScanProtectionEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return env.APIPROOF_ENABLE_LIVE_GITHUB === 'true';
}

/** Returns a validated opaque ID, never a secret or personal identifier. */
export function getConfiguredFounderUserId(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const value = env[FOUNDER_SCAN_USER_ID_ENV]?.trim() ?? '';
  return FOUNDER_USER_ID_PATTERN.test(value) ? value : null;
}

export function assertFounderScanProtectionConfigured(
  env: Record<string, string | undefined> = process.env,
): void {
  if (isLiveScanProtectionEnabled(env) && !getConfiguredFounderUserId(env)) {
    throw new FounderScanAuthorizationError('FOUNDER_SCAN_ID_NOT_CONFIGURED');
  }
}

/**
 * Enforces the founder boundary for every direct live-scan caller.
 * Non-live local fixture mode deliberately retains existing test behavior.
 */
export function assertFounderScanAuthorization(
  userId: string,
  env: Record<string, string | undefined> = process.env,
): void {
  if (!isLiveScanProtectionEnabled(env)) return;

  const founderUserId = getConfiguredFounderUserId(env);
  if (!founderUserId) {
    throw new FounderScanAuthorizationError('FOUNDER_SCAN_ID_NOT_CONFIGURED');
  }

  if (userId !== founderUserId) {
    throw new FounderScanAuthorizationError('FOUNDER_SCAN_NOT_AUTHORIZED');
  }
}

export function assertFounderRepositoryScope(
  repositoryId: string | undefined,
  env: Record<string, string | undefined> = process.env,
): void {
  if (!isLiveScanProtectionEnabled(env)) return;
  if (!repositoryId || !/^[A-Za-z0-9_.-]{1,150}$/.test(repositoryId)) {
    throw new FounderScanAuthorizationError('FOUNDER_SCAN_REPOSITORY_SCOPE_REQUIRED');
  }
}
