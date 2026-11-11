import { describe, expect, it } from 'vitest';
import { validateStagingDryRunPlan } from '../apps/web/scripts/sec17-staging-dry-run.js';

const safePlan = {
  target: 'disposable-staging',
  executeDeployment: false,
  executeRollback: false,
  stagingApprovalRef: 'owner-approval-reference',
  rollbackOwner: 'release-owner',
  evidenceLocation: 'approved-evidence-store/staging-rehearsal',
  migrationEvidenceRef: 'isolated-ledger-evidence',
  authorizationTestsPassed: true,
  providersApproved: true,
  healthPath: '/api/health',
} as const;

describe('SEC-17 staging deployment and rollback dry-run', () => {
  it('accepts only a fully specified non-executing disposable plan', () => {
    expect(validateStagingDryRunPlan(safePlan)).toEqual({
      status: 'ready_for_owner_review',
      actionsTaken: [],
      blockers: [],
    });
  });

  it('rejects live targets and any deployment or rollback execution', () => {
    const report = validateStagingDryRunPlan({ ...safePlan, target: 'production', executeDeployment: true, executeRollback: true });
    expect(report.status).toBe('blocked');
    expect(report.actionsTaken).toEqual([]);
    expect(report.blockers).toEqual(expect.arrayContaining([
      'TARGET_MUST_BE_DISPOSABLE_STAGING',
      'DEPLOYMENT_EXECUTION_DISABLED',
      'ROLLBACK_EXECUTION_DISABLED',
    ]));
  });

  it('blocks missing migration, authorization, provider, approval, and rollback evidence', () => {
    const report = validateStagingDryRunPlan({ target: 'disposable-staging', executeDeployment: false, executeRollback: false });
    expect(report.status).toBe('blocked');
    expect(report.blockers).toEqual(expect.arrayContaining([
      'STAGING_APPROVAL_REQUIRED',
      'MIGRATION_EVIDENCE_REQUIRED',
      'AUTHORIZATION_TESTS_REQUIRED',
      'PROVIDER_APPROVAL_REQUIRED',
      'ROLLBACK_OWNER_REQUIRED',
    ]));
  });
});
