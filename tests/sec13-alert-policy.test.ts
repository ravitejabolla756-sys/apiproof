import { describe, expect, it } from 'vitest';
import { evaluateAlertPolicy, parseApprovedAlertPolicy } from '../apps/web/src/lib/server/alert-policy.js';

const approved = {
  approved: true,
  windowMs: 5 * 60 * 1000,
  cooldownMs: 15 * 60 * 1000,
  queueLagMs: 30_000,
  retryAttempts: 3,
  workerFailures: 5,
  duplicateJobs: 2,
} as const;

describe('SEC-13 alert and queue-failure policy boundary', () => {
  it('fails closed when alert thresholds are not approved', () => {
    expect(evaluateAlertPolicy({ queueLagMs: 999_999, retryAttempts: 99, workerFailures: 99, duplicateJobs: 99 })).toEqual({
      status: 'policy_unavailable',
      signals: [],
    });
  });

  it('emits only owner-configured bounded signals', () => {
    const policy = parseApprovedAlertPolicy(approved);
    expect(policy).not.toBeNull();
    expect(evaluateAlertPolicy({ queueLagMs: 30_000, retryAttempts: 3, workerFailures: 4, duplicateJobs: 2 }, policy))
      .toEqual({ status: 'evaluated', signals: ['queue_lag', 'retry_storm', 'duplicate_jobs'] });
  });

  it('rejects malformed, zero, negative, fractional, and excessive thresholds', () => {
    expect(parseApprovedAlertPolicy({ ...approved, approved: false })).toBeNull();
    expect(parseApprovedAlertPolicy({ ...approved, queueLagMs: 0 })).toBeNull();
    expect(parseApprovedAlertPolicy({ ...approved, retryAttempts: 1.5 })).toBeNull();
    expect(parseApprovedAlertPolicy({ ...approved, windowMs: 25 * 60 * 60 * 1000 })).toBeNull();
  });

  it('fails closed for corrupt runtime metrics instead of emitting an alert burst', () => {
    const policy = parseApprovedAlertPolicy(approved);
    expect(evaluateAlertPolicy({ queueLagMs: Number.POSITIVE_INFINITY, retryAttempts: 3, workerFailures: 5, duplicateJobs: 2 }, policy))
      .toEqual({ status: 'policy_unavailable', signals: [] });
    expect(evaluateAlertPolicy({ queueLagMs: 0, retryAttempts: Number.NaN, workerFailures: 5, duplicateJobs: 2 }, policy))
      .toEqual({ status: 'policy_unavailable', signals: [] });
  });
});
