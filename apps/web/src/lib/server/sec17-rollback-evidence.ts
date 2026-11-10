export type Sec17MigrationDisposition = 'no-schema-change' | 'forward-only-approved' | 'manual-review-required';
export type Sec17RollbackResult = 'succeeded' | 'failed';

export interface Sec17DeploymentObservation {
  deploymentId: string;
  commitSha: string;
  observedAt: string;
}

export interface Sec17SmokeObservation {
  observedAt: string;
  totalChecks: number;
  passedChecks: number;
  failedChecks: number;
  errorRatePct: number;
  p95LatencyMs: number;
}

export interface Sec17RollbackEvidence {
  environment: 'staging';
  candidate: Sec17DeploymentObservation;
  knownGood: Sec17DeploymentObservation;
  thresholdApproval: {
    approvedBy: string;
    approvedAt: string;
    reference: string;
    maxErrorRatePct: number;
    maxP95LatencyMs: number;
  };
  preRollbackSmoke: Sec17SmokeObservation;
  postRollbackSmoke: Sec17SmokeObservation;
  rollback: {
    triggeredAt: string;
    triggerCode: string;
    result: Sec17RollbackResult;
    restoredDeploymentId: string;
    restoredCommitSha: string;
    completedAt: string;
  };
  migrationDisposition: Sec17MigrationDisposition;
  stagingIsolationConfirmed: true;
  productionPromotionObserved: false;
}

export class Sec17EvidenceError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'Sec17EvidenceError';
  }
}

const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const SHA = /^[a-f0-9]{7,64}$/i;
const ROOT_KEYS = new Set([
  'environment', 'candidate', 'knownGood', 'thresholdApproval', 'preRollbackSmoke', 'postRollbackSmoke',
  'rollback', 'migrationDisposition', 'stagingIsolationConfirmed', 'productionPromotionObserved',
]);
const DEPLOYMENT_KEYS = new Set(['deploymentId', 'commitSha', 'observedAt']);
const THRESHOLD_KEYS = new Set(['approvedBy', 'approvedAt', 'reference', 'maxErrorRatePct', 'maxP95LatencyMs']);
const SMOKE_KEYS = new Set(['observedAt', 'totalChecks', 'passedChecks', 'failedChecks', 'errorRatePct', 'p95LatencyMs']);
const ROLLBACK_KEYS = new Set(['triggeredAt', 'triggerCode', 'result', 'restoredDeploymentId', 'restoredCommitSha', 'completedAt']);

function assertKeys(value: Record<string, unknown>, allowed: Set<string>, scope: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Sec17EvidenceError(`SEC17_UNSUPPORTED_${scope}_FIELD`);
  }
}

function assertObject(value: unknown, scope: string): asserts value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new Sec17EvidenceError(`SEC17_INVALID_${scope}`);
  }
}

function assertId(value: unknown, scope: string): asserts value is string {
  if (typeof value !== 'string' || !SAFE_ID.test(value)) throw new Sec17EvidenceError(`SEC17_INVALID_${scope}`);
}

function assertTimestamp(value: unknown, scope: string): asserts value is string {
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Sec17EvidenceError(`SEC17_INVALID_${scope}`);
}

function assertSha(value: unknown, scope: string): asserts value is string {
  if (typeof value !== 'string' || !SHA.test(value)) throw new Sec17EvidenceError(`SEC17_INVALID_${scope}`);
}

function assertBoundedNumber(value: unknown, scope: string, min: number, max: number): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Sec17EvidenceError(`SEC17_INVALID_${scope}`);
  }
}

function validateDeployment(value: unknown, scope: string): Sec17DeploymentObservation {
  assertObject(value, scope);
  assertKeys(value, DEPLOYMENT_KEYS, scope);
  assertId(value.deploymentId, `${scope}_DEPLOYMENT_ID`);
  assertSha(value.commitSha, `${scope}_COMMIT_SHA`);
  assertTimestamp(value.observedAt, `${scope}_OBSERVED_AT`);
  return value as unknown as Sec17DeploymentObservation;
}

function validateSmoke(value: unknown, scope: string): Sec17SmokeObservation {
  assertObject(value, scope);
  assertKeys(value, SMOKE_KEYS, scope);
  assertTimestamp(value.observedAt, `${scope}_OBSERVED_AT`);
  assertBoundedNumber(value.totalChecks, `${scope}_TOTAL_CHECKS`, 1, 100_000);
  assertBoundedNumber(value.passedChecks, `${scope}_PASSED_CHECKS`, 0, value.totalChecks);
  assertBoundedNumber(value.failedChecks, `${scope}_FAILED_CHECKS`, 0, value.totalChecks);
  if (value.passedChecks + value.failedChecks !== value.totalChecks) throw new Sec17EvidenceError('SEC17_SMOKE_COUNTS_MISMATCH');
  assertBoundedNumber(value.errorRatePct, `${scope}_ERROR_RATE`, 0, 100);
  assertBoundedNumber(value.p95LatencyMs, `${scope}_P95_LATENCY`, 0, 86_400_000);
  return value as unknown as Sec17SmokeObservation;
}

export function validateSec17RollbackEvidence(input: unknown): Sec17RollbackEvidence {
  assertObject(input, 'EVIDENCE');
  assertKeys(input, ROOT_KEYS, 'EVIDENCE');
  if (input.environment !== 'staging') throw new Sec17EvidenceError('SEC17_STAGING_ONLY');
  validateDeployment(input.candidate, 'CANDIDATE');
  const knownGood = validateDeployment(input.knownGood, 'KNOWN_GOOD');
  assertObject(input.thresholdApproval, 'THRESHOLD_APPROVAL');
  assertKeys(input.thresholdApproval, THRESHOLD_KEYS, 'THRESHOLD_APPROVAL');
  assertId(input.thresholdApproval.approvedBy, 'APPROVER');
  assertTimestamp(input.thresholdApproval.approvedAt, 'THRESHOLD_APPROVED_AT');
  assertId(input.thresholdApproval.reference, 'THRESHOLD_REFERENCE');
  assertBoundedNumber(input.thresholdApproval.maxErrorRatePct, 'MAX_ERROR_RATE', 0, 100);
  assertBoundedNumber(input.thresholdApproval.maxP95LatencyMs, 'MAX_P95_LATENCY', 0, 86_400_000);
  validateSmoke(input.preRollbackSmoke, 'PRE_ROLLBACK_SMOKE');
  const postRollbackSmoke = validateSmoke(input.postRollbackSmoke, 'POST_ROLLBACK_SMOKE');
  assertObject(input.rollback, 'ROLLBACK');
  assertKeys(input.rollback, ROLLBACK_KEYS, 'ROLLBACK');
  assertTimestamp(input.rollback.triggeredAt, 'ROLLBACK_TRIGGERED_AT');
  assertId(input.rollback.triggerCode, 'ROLLBACK_TRIGGER_CODE');
  if (input.rollback.result !== 'succeeded' && input.rollback.result !== 'failed') {
    throw new Sec17EvidenceError('SEC17_INVALID_ROLLBACK_RESULT');
  }
  assertId(input.rollback.restoredDeploymentId, 'RESTORED_DEPLOYMENT_ID');
  assertSha(input.rollback.restoredCommitSha, 'RESTORED_COMMIT_SHA');
  assertTimestamp(input.rollback.completedAt, 'ROLLBACK_COMPLETED_AT');
  if (input.rollback.result === 'succeeded'
    && (input.rollback.restoredDeploymentId !== knownGood.deploymentId || input.rollback.restoredCommitSha !== knownGood.commitSha)) {
    throw new Sec17EvidenceError('SEC17_RESTORED_DEPLOYMENT_MISMATCH');
  }
  if (!['no-schema-change', 'forward-only-approved', 'manual-review-required'].includes(input.migrationDisposition as string)) {
    throw new Sec17EvidenceError('SEC17_INVALID_MIGRATION_DISPOSITION');
  }
  if (input.stagingIsolationConfirmed !== true) throw new Sec17EvidenceError('SEC17_STAGING_ISOLATION_REQUIRED');
  if (input.productionPromotionObserved !== false) throw new Sec17EvidenceError('SEC17_PRODUCTION_PROMOTION_UNPROVEN');
  if (postRollbackSmoke.errorRatePct > input.thresholdApproval.maxErrorRatePct
    || postRollbackSmoke.p95LatencyMs > input.thresholdApproval.maxP95LatencyMs) {
    throw new Sec17EvidenceError('SEC17_POST_ROLLBACK_THRESHOLDS_FAILED');
  }
  return input as unknown as Sec17RollbackEvidence;
}
