/**
 * The migration implementation remains available for future authorized work,
 * and request paths must not queue write-adjacent work unless the deployment
 * deliberately enables both controls.
 */
export function migrationProposalsEnabled(environment: NodeJS.ProcessEnv = process.env): boolean {
  return environment.APIPROOF_ENABLE_MIGRATION_PROPOSALS === 'true'
    && environment.APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'true';
}
