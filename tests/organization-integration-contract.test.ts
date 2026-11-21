import { describe, expect, it } from 'vitest';
import {
  assertMemberRevocationResponse,
  mapMemberRevocationError,
  MEMBER_REMOVED_AUDIT_ACTION,
  MEMBER_REVOCATION_EVENT,
  normalizeMemberRevocationRequest,
} from '../apps/web/src/lib/server/organization-integration-contract.js';

describe('organization integration contract', () => {
  it('uses the approved event and audit projection names', () => {
    expect(MEMBER_REVOCATION_EVENT).toBe('workspace.member_revocation.v1');
    expect(MEMBER_REMOVED_AUDIT_ACTION).toBe('member.removed');
  });

  it('normalizes the shared DELETE request without trusting roles or membership', () => {
    expect(normalizeMemberRevocationRequest({
      workspaceId: ' ws_1 ', userId: ' usr_2 ', reason: ' removed ', idempotencyKey: ' key_1 ',
    })).toEqual({ workspaceId: 'ws_1', userId: 'usr_2', reason: 'removed', idempotencyKey: 'key_1' });
  });

  it('rejects missing required identifiers', () => {
    expect(() => normalizeMemberRevocationRequest({ workspaceId: ' ', userId: 'usr_2' })).toThrow('WORKSPACE_ID_REQUIRED');
    expect(() => normalizeMemberRevocationRequest({ workspaceId: 'ws_1', userId: ' ' })).toThrow('SUBJECT_USER_ID_REQUIRED');
  });

  it('preserves the existing success shape and validates optional metadata', () => {
    expect(() => assertMemberRevocationResponse({ success: true })).not.toThrow();
    expect(() => assertMemberRevocationResponse({
      success: true,
      revocation: { requestId: 'mrr_1', eventId: 'evt_1', status: 'completed', workspaceId: 'ws_1', subjectUserId: 'usr_2', subjectMembershipId: 'wsm_2', idempotencyKey: 'key_1' },
    })).not.toThrow();
  });

  it('rejects incomplete revocation metadata', () => {
    expect(() => assertMemberRevocationResponse({
      success: true,
      revocation: { requestId: 'mrr_1', eventId: '', status: 'completed', workspaceId: 'ws_1', subjectUserId: 'usr_2', subjectMembershipId: 'wsm_2', idempotencyKey: 'key_1' },
    })).toThrow('INVALID_MEMBER_REVOCATION_RESPONSE');
  });

  it('maps backend failures to stable, non-sensitive route responses', () => {
    expect(mapMemberRevocationError(new Error('WORKSPACE_MEMBER_NOT_FOUND'))).toEqual({
      error: 'Workspace access denied.', code: 'WORKSPACE_ACCESS_DENIED',
    });
    expect(mapMemberRevocationError(new Error('FINAL_OWNER_PROTECTED'))).toEqual({
      error: 'The final workspace owner cannot be removed.', code: 'FINAL_OWNER_PROTECTED',
    });
    expect(mapMemberRevocationError(new Error('database password leaked'))).toEqual({
      error: 'Unable to revoke workspace membership.', code: 'INTERNAL_ERROR',
    });
  });

  it.todo('owner removes an authorized member through the integrated route');
  it.todo('unauthorized actor is denied');
  it.todo('final owner removal is rejected under concurrency');
  it.todo('removal is limited to the selected workspace');
  it.todo('personal sessions remain valid');
  it.todo('unrelated workspace membership remains valid');
  it.todo('removed member cannot access the revoked workspace');
  it.todo('pending invitations for the target email are invalidated in the same transaction');
  it.todo('accepted, expired and revoked invitations cannot be reused');
  it.todo('concurrent invitation acceptance and revocation cannot restore access');
  it.todo('repeated idempotent requests return the same result');
  it.todo('conflicting idempotency-key reuse is rejected');
  it.todo('security and workspace audit records remain consistent');
  it.todo('queued jobs revalidate current membership before execution');
  it.todo('stale workspace context cannot restore access');
});
