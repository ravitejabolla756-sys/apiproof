/** @deprecated Use live-scan-authorization.ts. */
export {
  assertLiveScanEnabled as assertFounderScanProtectionConfigured,
  assertRepositoryScope as assertFounderRepositoryScope,
  isLiveScanEnabled as isLiveScanProtectionEnabled,
  LiveScanAuthorizationError as FounderScanAuthorizationError,
} from './live-scan-authorization.js';

/** @deprecated Workspace membership replaced the founder-only rollout gate. */
export function assertFounderScanAuthorization(): void {
  // Authorization is enforced by requireRepositoryAccess in the scan route
  // and service, so every permitted workspace member can scan.
}
