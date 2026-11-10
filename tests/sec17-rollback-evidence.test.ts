import { describe, expect, it } from 'vitest';
import { Sec17EvidenceError, validateSec17RollbackEvidence, type Sec17RollbackEvidence } from '../apps/web/src/lib/server/sec17-rollback-evidence.js';

const evidence: Sec17RollbackEvidence = {
  environment: 'staging',
  candidate: { deploymentId: 'deploy-candidate', commitSha: 'abcdef1234567', observedAt: '2026-11-09T00:00:00.000Z' },
  knownGood: { deploymentId: 'deploy-known-good', commitSha: '123456789abcd', observedAt: '2026-11-08T00:00:00.000Z' },
  thresholdApproval: {
    approvedBy: 'owner-1', approvedAt: '2026-11-09T00:01:00.000Z', reference: 'approval-1', maxErrorRatePct: 5, maxP95LatencyMs: 1000,
  },
  preRollbackSmoke: { observedAt: '2026-11-09T00:02:00.000Z', totalChecks: 10, passedChecks: 8, failedChecks: 2, errorRatePct: 20, p95LatencyMs: 1200 },
  postRollbackSmoke: { observedAt: '2026-11-09T00:05:00.000Z', totalChecks: 10, passedChecks: 10, failedChecks: 0, errorRatePct: 0, p95LatencyMs: 200 },
  rollback: {
    triggeredAt: '2026-11-09T00:03:00.000Z', triggerCode: 'SMOKE_THRESHOLD_EXCEEDED', result: 'succeeded',
    restoredDeploymentId: 'deploy-known-good', restoredCommitSha: '123456789abcd', completedAt: '2026-11-09T00:04:00.000Z',
  },
  migrationDisposition: 'no-schema-change', stagingIsolationConfirmed: true, productionPromotionObserved: false,
};

describe('SEC-17 offline rollback evidence', () => {
  it('accepts a complete staging-only successful rehearsal record', () => {
    expect(validateSec17RollbackEvidence(evidence)).toEqual(evidence);
  });

  it('rejects production environment or promotion claims', () => {
    expect(() => validateSec17RollbackEvidence({ ...evidence, environment: 'production' })).toThrow('SEC17_STAGING_ONLY');
    expect(() => validateSec17RollbackEvidence({ ...evidence, productionPromotionObserved: true })).toThrow('SEC17_PRODUCTION_PROMOTION_UNPROVEN');
  });

  it('rejects unsupported fields, path-like values and mismatched restoration', () => {
    expect(() => validateSec17RollbackEvidence({ ...evidence, unexpected: true })).toThrow('SEC17_UNSUPPORTED_EVIDENCE_FIELD');
    expect(() => validateSec17RollbackEvidence({ ...evidence, candidate: { ...evidence.candidate, deploymentId: 'C:\\secret' } })).toThrow(Sec17EvidenceError);
    expect(() => validateSec17RollbackEvidence({ ...evidence, rollback: { ...evidence.rollback, restoredCommitSha: '9999999999999' } })).toThrow('SEC17_RESTORED_DEPLOYMENT_MISMATCH');
  });

  it('rejects incomplete smoke counts and threshold failures', () => {
    expect(() => validateSec17RollbackEvidence({ ...evidence, preRollbackSmoke: { ...evidence.preRollbackSmoke, failedChecks: 1 } }))
      .toThrow('SEC17_SMOKE_COUNTS_MISMATCH');
    expect(() => validateSec17RollbackEvidence({ ...evidence, postRollbackSmoke: { ...evidence.postRollbackSmoke, p95LatencyMs: 2000 } }))
      .toThrow('SEC17_POST_ROLLBACK_THRESHOLDS_FAILED');
  });
});
