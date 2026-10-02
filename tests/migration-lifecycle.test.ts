import { describe, expect, it } from 'vitest';
import { getMigrationLifecycleState } from '../apps/web/src/lib/server/migration-lifecycle.js';

describe('migration lifecycle wording', () => {
  it('does not call a plan verified without execution-bound evidence', () => {
    expect(getMigrationLifecycleState({ status: 'planned' })).toBe('Verification Pending');
    expect(getMigrationLifecycleState({ status: 'verified', verificationReport: null })).toBe('Verification Pending');
    expect(getMigrationLifecycleState({
      status: 'verified',
      verificationReport: JSON.stringify({ report: { status: 'VERIFICATION_PASSED' }, evidence: { proofLevel: 'CONTRACT_VERIFIED' } }),
    })).toBe('Verification Pending');
  });

  it('uses explicit failed, passed, and Draft PR states', () => {
    const report = JSON.stringify({ report: { status: 'VERIFICATION_PASSED' }, evidence: { proofLevel: 'EXECUTION_VERIFIED' } });
    expect(getMigrationLifecycleState({ status: 'verification_failed', verificationReport: report })).toBe('Verification Failed');
    expect(getMigrationLifecycleState({ status: 'verified', verificationReport: report })).toBe('Verification Pending');
    expect(getMigrationLifecycleState({ status: 'verified', verificationReport: report, hasPullRequest: true, pullRequestState: 'draft' })).toBe('Draft PR Created');
    expect(getMigrationLifecycleState({ status: 'verified', verificationReport: report, hasPullRequest: true, pullRequestState: 'open' })).toBe('Pull Request Open');
    expect(getMigrationLifecycleState({ status: 'verified', verificationReport: report, hasPullRequest: true, pullRequestState: 'closed' })).toBe('Pull Request Closed');
    expect(getMigrationLifecycleState({ status: 'verified', verificationReport: report, hasPullRequest: true, pullRequestState: 'merged' })).toBe('Pull Request Merged');
    expect(getMigrationLifecycleState({ status: 'pr_created', hasPullRequest: true, pullRequestState: null })).toBe('Pull Request State Unavailable');
  });
});
