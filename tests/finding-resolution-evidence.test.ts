import { describe, expect, it } from 'vitest';
import { classifyMergedFindingWithScanEvidence, hasExactCompletedScanEvidence } from '../apps/web/src/lib/server/finding-resolution-verification.js';

const base = {
  expectedMergeSha: 'a'.repeat(40),
  expectedRepositoryId: 'repo-a',
  findingPresent: false,
  previousState: 'fixed_pending_verification',
  conflictingActiveChange: false,
};

describe('PR-08 exact scan evidence guard', () => {
  it('accepts only a completed scan for the merged repository and SHA', () => {
    expect(hasExactCompletedScanEvidence({ ...base, scanStatus: 'completed', scanSha: base.expectedMergeSha, scanRepositoryId: 'repo-a' })).toBe(true);
    expect(classifyMergedFindingWithScanEvidence({ ...base, scanStatus: 'completed', scanSha: base.expectedMergeSha, scanRepositoryId: 'repo-a' })).toBe('resolved');
  });

  it.each([
    ['pending', base.expectedMergeSha, 'repo-a'],
    ['completed', 'b'.repeat(40), 'repo-a'],
    ['completed', base.expectedMergeSha, 'repo-b'],
    ['completed', null, 'repo-a'],
  ] as const)('fails closed for %s scan evidence', (scanStatus, scanSha, scanRepositoryId) => {
    expect(hasExactCompletedScanEvidence({ ...base, scanStatus, scanSha, scanRepositoryId })).toBe(false);
    expect(classifyMergedFindingWithScanEvidence({ ...base, scanStatus, scanSha, scanRepositoryId })).toBe('inconclusive');
  });

  it('never grants resolution when a conflicting active change is present', () => {
    expect(classifyMergedFindingWithScanEvidence({ ...base, scanStatus: 'completed', scanSha: base.expectedMergeSha, scanRepositoryId: 'repo-a', conflictingActiveChange: true })).toBe('ambiguous');
  });
});
