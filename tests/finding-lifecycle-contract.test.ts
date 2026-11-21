import { describe, expect, it } from 'vitest';
import { FINDING_LIFECYCLE_STATES } from '../apps/web/src/lib/server/finding-lifecycle.js';
import { classifyMergedFinding } from '../apps/web/src/lib/server/finding-resolution-verification.js';

describe('IMP-09 migration-gated lifecycle contract', () => {
  it('preserves the reviewed lifecycle vocabulary without activating persistence', () => {
    expect(FINDING_LIFECYCLE_STATES).toEqual([
      'open',
      'acknowledged',
      'remediating',
      'fixed_pending_verification',
      'verified_resolved',
      'reopened',
      'resolved_legacy',
    ]);
  });

  it.each([
    [{ scanCompleted: true, findingPresent: false, previousState: 'fixed_pending_verification', conflictingActiveChange: false }, 'resolved'],
    [{ scanCompleted: true, findingPresent: true, previousState: 'fixed_pending_verification', conflictingActiveChange: false }, 'unresolved'],
    [{ scanCompleted: true, findingPresent: true, previousState: 'verified_resolved', conflictingActiveChange: false }, 'regressed'],
    [{ scanCompleted: true, findingPresent: false, previousState: 'fixed_pending_verification', conflictingActiveChange: true }, 'ambiguous'],
    [{ scanCompleted: false, findingPresent: false, previousState: 'fixed_pending_verification', conflictingActiveChange: false }, 'inconclusive'],
  ] as const)('classifies merged findings conservatively as %s', (input, expected) => {
    expect(classifyMergedFinding(input)).toBe(expected);
  });
});
