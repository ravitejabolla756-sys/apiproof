import { describe, expect, it } from 'vitest';
import { classifyMergedFinding } from '../apps/web/src/lib/server/finding-resolution-verification.js';

describe('PR-08 finding-resolution reconciliation', () => {
  it.each([
    ['completed exact-commit scan absent finding', { scanCompleted: true, findingPresent: false, previousState: 'fixed_pending_verification', conflictingActiveChange: false }, 'resolved'],
    ['completed scan still containing finding', { scanCompleted: true, findingPresent: true, previousState: 'fixed_pending_verification', conflictingActiveChange: false }, 'unresolved'],
    ['reappearance after verified resolution', { scanCompleted: true, findingPresent: true, previousState: 'verified_resolved', conflictingActiveChange: false }, 'regressed'],
    ['active conflicting change', { scanCompleted: true, findingPresent: false, previousState: 'fixed_pending_verification', conflictingActiveChange: true }, 'ambiguous'],
    ['stale or incomplete scan', { scanCompleted: false, findingPresent: false, previousState: 'fixed_pending_verification', conflictingActiveChange: false }, 'inconclusive'],
  ] as const)('returns %s without granting resolution authority', (_name, input, expected) => {
    expect(classifyMergedFinding(input)).toBe(expected);
    expect(input.scanCompleted && expected === 'resolved').toBe(expected === 'resolved');
  });

  it('does not treat out-of-order or incomplete evidence as successful resolution', () => {
    const stale = classifyMergedFinding({
      scanCompleted: false,
      findingPresent: false,
      previousState: 'fixed_pending_verification',
      conflictingActiveChange: false,
    });
    const outOfOrder = classifyMergedFinding({
      scanCompleted: true,
      findingPresent: true,
      previousState: 'verified_resolved',
      conflictingActiveChange: false,
    });
    expect(stale).toBe('inconclusive');
    expect(outOfOrder).toBe('regressed');
    expect([stale, outOfOrder]).not.toContain('resolved');
  });
});
