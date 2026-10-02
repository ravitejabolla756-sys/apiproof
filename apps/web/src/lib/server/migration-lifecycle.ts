export type MigrationLifecycleState =
  | 'Migration Planned'
  | 'Verification Pending'
  | 'Verification Passed'
  | 'Verification Failed'
  | 'Draft PR Created'
  | 'Pull Request Open'
  | 'Pull Request Closed'
  | 'Pull Request Merged'
  | 'Pull Request State Unavailable';

import { readBoundMigrationProof } from './migration-proof.js';

function hasExecutionVerifiedEvidence(raw: unknown): boolean {
  if (typeof raw !== 'string' || raw.length === 0) return false;
  try {
    return readBoundMigrationProof(raw).evidence.proofLevel === 'EXECUTION_VERIFIED';
  } catch {
    return false;
  }
}

/**
 * Converts persisted lifecycle data into customer-facing wording.
 * A legacy `verified` status is intentionally treated as pending unless the
 * persisted report contains execution-bound proof. The database status alone
 * is not evidence that the four gates ran.
 */
export function getMigrationLifecycleState(input: {
  status?: string | null;
  verificationReport?: string | null;
  hasPullRequest?: boolean;
  pullRequestState?: string | null;
}): MigrationLifecycleState {
  if (input.hasPullRequest) {
    switch (input.pullRequestState) {
      case 'draft': return 'Draft PR Created';
      case 'open': return 'Pull Request Open';
      case 'closed': return 'Pull Request Closed';
      case 'merged': return 'Pull Request Merged';
      default: return 'Pull Request State Unavailable';
    }
  }
  if (input.status === 'pr_created') return 'Pull Request State Unavailable';
  if (input.status === 'verification_failed') return 'Verification Failed';
  if (input.status === 'verified' && hasExecutionVerifiedEvidence(input.verificationReport)) {
    return 'Verification Passed';
  }
  if (input.status === 'planned' || input.status === 'verified') return 'Verification Pending';
  return 'Migration Planned';
}

export function hasExecutionVerifiedMigrationEvidence(raw: unknown): boolean {
  return hasExecutionVerifiedEvidence(raw);
}
