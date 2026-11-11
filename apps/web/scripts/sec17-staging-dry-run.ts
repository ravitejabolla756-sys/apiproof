export interface StagingDryRunPlan {
  target: 'disposable-staging';
  executeDeployment: false;
  executeRollback: false;
  stagingApprovalRef: string;
  rollbackOwner: string;
  evidenceLocation: string;
  migrationEvidenceRef: string;
  authorizationTestsPassed: true;
  providersApproved: true;
  healthPath: string;
}

export interface StagingDryRunReport {
  status: 'ready_for_owner_review' | 'blocked';
  actionsTaken: [];
  blockers: string[];
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates a staging/rollback plan without contacting a host, database,
 * deployment provider, or secret store. It is intentionally fail-closed.
 */
export function validateStagingDryRunPlan(input: unknown): StagingDryRunReport {
  const blockers: string[] = [];
  if (!input || typeof input !== 'object') return { status: 'blocked', actionsTaken: [], blockers: ['PLAN_MISSING'] };
  const plan = input as Record<string, unknown>;

  if (plan.target !== 'disposable-staging') blockers.push('TARGET_MUST_BE_DISPOSABLE_STAGING');
  if (plan.executeDeployment !== false) blockers.push('DEPLOYMENT_EXECUTION_DISABLED');
  if (plan.executeRollback !== false) blockers.push('ROLLBACK_EXECUTION_DISABLED');
  if (!nonempty(plan.stagingApprovalRef)) blockers.push('STAGING_APPROVAL_REQUIRED');
  if (!nonempty(plan.rollbackOwner)) blockers.push('ROLLBACK_OWNER_REQUIRED');
  if (!nonempty(plan.evidenceLocation)) blockers.push('EVIDENCE_LOCATION_REQUIRED');
  if (!nonempty(plan.migrationEvidenceRef)) blockers.push('MIGRATION_EVIDENCE_REQUIRED');
  if (plan.authorizationTestsPassed !== true) blockers.push('AUTHORIZATION_TESTS_REQUIRED');
  if (plan.providersApproved !== true) blockers.push('PROVIDER_APPROVAL_REQUIRED');
  if (!nonempty(plan.healthPath) || !plan.healthPath.startsWith('/')) blockers.push('HEALTH_PATH_REQUIRED');

  return blockers.length > 0
    ? { status: 'blocked', actionsTaken: [], blockers }
    : { status: 'ready_for_owner_review', actionsTaken: [], blockers: [] };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/sec17-staging-dry-run.ts')) {
  const report = validateStagingDryRunPlan({
    target: 'unset',
    executeDeployment: true,
    executeRollback: true,
  });
  console.log(JSON.stringify({ mode: 'dry-run-only', ...report }));
}
