export type AlertSignalKind = 'queue_lag' | 'retry_storm' | 'worker_failures' | 'duplicate_jobs';

export interface ApprovedAlertPolicy {
  approved: true;
  windowMs: number;
  cooldownMs: number;
  queueLagMs: number;
  retryAttempts: number;
  workerFailures: number;
  duplicateJobs: number;
}

export interface AlertPolicyInput {
  queueLagMs: number;
  retryAttempts: number;
  workerFailures: number;
  duplicateJobs: number;
}

export type AlertPolicyEvaluation =
  | { status: 'policy_unavailable'; signals: [] }
  | { status: 'evaluated'; signals: AlertSignalKind[] };

const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_QUEUE_LAG_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_COUNT = 1_000_000;

function positiveBounded(value: unknown, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= maximum;
}

function validMetric(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/** Owner-approved thresholds only; absent or malformed input fails closed. */
export function parseApprovedAlertPolicy(input: unknown): ApprovedAlertPolicy | null {
  if (!input || typeof input !== 'object') return null;
  const candidate = input as Record<string, unknown>;
  if (
    candidate.approved !== true ||
    !positiveBounded(candidate.windowMs, MAX_WINDOW_MS) ||
    !positiveBounded(candidate.cooldownMs, MAX_COOLDOWN_MS) ||
    !positiveBounded(candidate.queueLagMs, MAX_QUEUE_LAG_MS) ||
    !positiveBounded(candidate.retryAttempts, MAX_COUNT) ||
    !positiveBounded(candidate.workerFailures, MAX_COUNT) ||
    !positiveBounded(candidate.duplicateJobs, MAX_COUNT)
  ) return null;

  return {
    approved: true,
    windowMs: candidate.windowMs,
    cooldownMs: candidate.cooldownMs,
    queueLagMs: candidate.queueLagMs,
    retryAttempts: candidate.retryAttempts,
    workerFailures: candidate.workerFailures,
    duplicateJobs: candidate.duplicateJobs,
  };
}

/** Pure local evaluation; it emits no network notification or paging action. */
export function evaluateAlertPolicy(input: AlertPolicyInput, policy?: ApprovedAlertPolicy | null): AlertPolicyEvaluation {
  if (!policy || !Object.values(input).every(validMetric)) return { status: 'policy_unavailable', signals: [] };
  const signals: AlertSignalKind[] = [];
  if (input.queueLagMs >= policy.queueLagMs) signals.push('queue_lag');
  if (input.retryAttempts >= policy.retryAttempts) signals.push('retry_storm');
  if (input.workerFailures >= policy.workerFailures) signals.push('worker_failures');
  if (input.duplicateJobs >= policy.duplicateJobs) signals.push('duplicate_jobs');
  return { status: 'evaluated', signals };
}
