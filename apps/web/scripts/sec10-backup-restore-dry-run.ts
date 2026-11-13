export interface BackupRestoreDryRunPlan {
  target: 'disposable-restore';
  executeBackup: false;
  executeRestore: false;
  sourceApprovalRef: string;
  destinationApprovalRef: string;
  backupManifestRef: string;
  migrationEvidenceRef: string;
  roleEvidenceRef: string;
  tenantIsolationEvidenceRef: string;
  rollbackOwner: string;
  evidenceLocation: string;
}

export interface BackupRestoreDryRunReport {
  status: 'ready_for_owner_review' | 'blocked';
  actionsTaken: [];
  blockers: string[];
}

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Validates a restore rehearsal plan without contacting a database, backup
 * store, deployment provider, or secret manager. It is intentionally
 * fail-closed and cannot execute backup or restore actions.
 */
export function validateBackupRestoreDryRunPlan(input: unknown): BackupRestoreDryRunReport {
  const blockers: string[] = [];
  if (!input || typeof input !== 'object') return { status: 'blocked', actionsTaken: [], blockers: ['PLAN_MISSING'] };
  const plan = input as Record<string, unknown>;

  if (plan.target !== 'disposable-restore') blockers.push('TARGET_MUST_BE_DISPOSABLE_RESTORE');
  if (plan.executeBackup !== false) blockers.push('BACKUP_EXECUTION_DISABLED');
  if (plan.executeRestore !== false) blockers.push('RESTORE_EXECUTION_DISABLED');
  if (!nonempty(plan.sourceApprovalRef)) blockers.push('SOURCE_APPROVAL_REQUIRED');
  if (!nonempty(plan.destinationApprovalRef)) blockers.push('DESTINATION_APPROVAL_REQUIRED');
  if (!nonempty(plan.backupManifestRef)) blockers.push('BACKUP_MANIFEST_REQUIRED');
  if (!nonempty(plan.migrationEvidenceRef)) blockers.push('MIGRATION_EVIDENCE_REQUIRED');
  if (!nonempty(plan.roleEvidenceRef)) blockers.push('ROLE_EVIDENCE_REQUIRED');
  if (!nonempty(plan.tenantIsolationEvidenceRef)) blockers.push('TENANT_ISOLATION_EVIDENCE_REQUIRED');
  if (!nonempty(plan.rollbackOwner)) blockers.push('ROLLBACK_OWNER_REQUIRED');
  if (!nonempty(plan.evidenceLocation)) blockers.push('EVIDENCE_LOCATION_REQUIRED');

  return blockers.length > 0
    ? { status: 'blocked', actionsTaken: [], blockers }
    : { status: 'ready_for_owner_review', actionsTaken: [], blockers: [] };
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('/sec10-backup-restore-dry-run.ts')) {
  const report = validateBackupRestoreDryRunPlan({
    target: 'unset',
    executeBackup: true,
    executeRestore: true,
  });
  console.log(JSON.stringify({ mode: 'dry-run-only', ...report }));
}
