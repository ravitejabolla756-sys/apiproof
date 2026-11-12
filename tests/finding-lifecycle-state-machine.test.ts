import { describe, expect, it } from 'vitest';
import { evaluateFindingTransition, LEGACY_STATUS_BY_STATE, type FindingLifecycleState } from '../apps/web/src/lib/server/finding-lifecycle.js';

const workspace = { findingWorkspaceId: 'workspace-a', requestedWorkspaceId: 'workspace-a' };

describe('IMP-09 schema-independent finding lifecycle policy', () => {
  it('maps every lifecycle state to its legacy status without persistence', () => {
    const states: FindingLifecycleState[] = ['open', 'acknowledged', 'remediating', 'fixed_pending_verification', 'verified_resolved', 'reopened', 'resolved_legacy'];
    for (const state of states) {
      const result = evaluateFindingTransition({ ...workspace, currentState: state, targetState: state });
      expect(result).toEqual({ changed: false, state, legacyStatus: LEGACY_STATUS_BY_STATE[state] });
    }
  });

  it.each([
    ['open', 'acknowledged'],
    ['acknowledged', 'remediating'],
    ['remediating', 'fixed_pending_verification'],
    ['fixed_pending_verification', 'verified_resolved'],
    ['verified_resolved', 'reopened'],
    ['reopened', 'acknowledged'],
    ['resolved_legacy', 'reopened'],
  ] as const)('allows reviewed transition %s -> %s', (currentState, targetState) => {
    const result = evaluateFindingTransition({
      ...workspace,
      currentState,
      targetState,
      hasResolutionEvidence: targetState === 'verified_resolved',
    });
    expect(result.changed).toBe(true);
    expect(result.state).toBe(targetState);
  });

  it.each([
    ['open', 'reopened'],
    ['acknowledged', 'open'],
    ['fixed_pending_verification', 'remediating'],
    ['verified_resolved', 'remediating'],
  ] as const)('rejects invalid transition %s -> %s', (currentState, targetState) => {
    expect(() => evaluateFindingTransition({ ...workspace, currentState, targetState, hasResolutionEvidence: true })).toThrow('FINDING_LIFECYCLE_TRANSITION_REJECTED');
  });

  it('rejects cross-workspace evaluation before any persistence decision', () => {
    expect(() => evaluateFindingTransition({ findingWorkspaceId: 'workspace-a', requestedWorkspaceId: 'workspace-b', currentState: 'open', targetState: 'acknowledged' })).toThrow('FINDING_WORKSPACE_MISMATCH');
  });

  it('requires completed-scan evidence before verified resolution', () => {
    expect(() => evaluateFindingTransition({ ...workspace, currentState: 'fixed_pending_verification', targetState: 'verified_resolved' })).toThrow('FINDING_RESOLUTION_EVIDENCE_REQUIRED');
  });

  it('rejects unknown states instead of treating them as open', () => {
    expect(() => evaluateFindingTransition({ ...workspace, currentState: 'unknown', targetState: 'open' })).toThrow('FINDING_LIFECYCLE_STATE_INVALID');
  });
});
