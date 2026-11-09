import { describe, expect, it } from 'vitest';
import {
  assertSec19IdempotencyMatch,
  assertSec19RequestIdentity,
  Sec19RequestStateError,
  transitionSec19Request,
  type Sec19RequestRecord,
} from '../apps/web/src/lib/server/sec19-request-state.js';

const identity = {
  workspaceId: 'workspace-1', subjectUserId: 'user-1', actorUserId: 'owner-1',
  operation: 'account_closure' as const, idempotencyKey: 'request-1', policyVersion: 'retention-v1',
};

function record(state: Sec19RequestRecord['state'] = 'requested'): Sec19RequestRecord {
  return {
    ...identity, requestId: 'request-record-1', state,
    requestedAt: '2026-11-09T00:00:00.000Z', updatedAt: '2026-11-09T00:00:00.000Z',
    outcomeCode: null, auditReference: null,
  };
}

describe('SEC-19 policy-neutral request state', () => {
  it('accepts the reviewable lifecycle and a resumable failed request', () => {
    const processing = transitionSec19Request(record(), 'processing', '2026-11-09T00:01:00.000Z');
    const failed = transitionSec19Request(processing, 'failed', '2026-11-09T00:02:00.000Z', {
      outcomeCode: 'REQUEST_RETRYABLE_FAILURE', auditReference: 'audit-1',
    });
    const retried = transitionSec19Request(failed, 'processing', '2026-11-09T00:03:00.000Z');
    const completed = transitionSec19Request(retried, 'completed', '2026-11-09T00:04:00.000Z', {
      auditReference: 'audit-2',
    });

    expect(completed).toMatchObject({ state: 'completed', outcomeCode: 'REQUEST_COMPLETED', auditReference: 'audit-2' });
  });

  it('rejects terminal-state mutation and invalid transitions', () => {
    expect(() => transitionSec19Request(record('completed'), 'processing', '2026-11-09T00:01:00.000Z'))
      .toThrow('SEC19_INVALID_STATE_TRANSITION');
    expect(() => transitionSec19Request(record(), 'completed', '2026-11-09T00:01:00.000Z'))
      .toThrow('SEC19_INVALID_STATE_TRANSITION');
  });

  it('fails closed on invalid identity and unsafe outcome references', () => {
    expect(() => assertSec19RequestIdentity({ ...identity, workspaceId: 'workspace/foreign' }))
      .toThrow('SEC19_INVALID_WORKSPACE_ID');
    expect(() => transitionSec19Request(record(), 'processing', 'not-a-timestamp', {
      auditReference: 'audit value',
    })).toThrow(Sec19RequestStateError);
  });

  it('rejects cross-tenant or otherwise conflicting idempotency reuse', () => {
    expect(() => assertSec19IdempotencyMatch(record(), { ...identity, workspaceId: 'workspace-2' }))
      .toThrow('SEC19_IDEMPOTENCY_CONFLICT');
    expect(() => assertSec19IdempotencyMatch(record(), { ...identity, operation: 'workspace_deletion' }))
      .toThrow('SEC19_IDEMPOTENCY_CONFLICT');
  });

  it('keeps same-state retries idempotent while advancing the update timestamp', () => {
    const next = transitionSec19Request(record('failed'), 'failed', '2026-11-09T00:05:00.000Z', {
      outcomeCode: 'REQUEST_RETRYABLE_FAILURE', auditReference: 'audit-3',
    });
    expect(next).toMatchObject({ state: 'failed', updatedAt: '2026-11-09T00:05:00.000Z', auditReference: 'audit-3' });
  });
});
