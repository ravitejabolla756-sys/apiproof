import { assertLiveScanEnabled } from './live-scan-authorization.js';

/** Compatibility names retained while live scans use tenant authorization. */
export {
  assertLiveScanEnabled as assertFounderScanProtectionConfigured,
  assertRepositoryScope as assertFounderRepositoryScope,
  isLiveScanEnabled as isLiveScanProtectionEnabled,
  LiveScanAuthorizationError as FounderScanAuthorizationError,
} from './live-scan-authorization.js';

export function getConfiguredFounderUserId(): null {
  return null;
}

export function assertFounderScanAuthorization(
  _userId: string,
  env: Record<string, string | undefined> = process.env,
): void {
  assertLiveScanEnabled(env);
}
