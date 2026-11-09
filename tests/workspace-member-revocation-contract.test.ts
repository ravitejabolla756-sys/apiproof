import { describe, expect, it } from 'vitest';
import { parseWorkspaceMemberRevocationResult, workspaceMemberRevocationAvailability } from '../apps/web/src/lib/workspace-member-revocation-contract.js';

describe('workspace member revocation contract boundary', () => {
  it('keeps member removal unavailable until ORG-10 is integrated', () => {
    expect(workspaceMemberRevocationAvailability).toEqual({
      status: 'unavailable',
      code: 'ORG_10_CONTRACT_PENDING',
      message: 'Member removal is unavailable until workspace-scoped revocation is connected. Personal sessions and access to other workspaces must be preserved.',
    });
  });

  it('accepts the reviewed completed result while preserving unrelated access scope', () => {
    const result = parseWorkspaceMemberRevocationResult({
      requestId: 'mrr_123',
      eventId: 'evt_123',
      status: 'completed',
      workspaceId: 'ws_123',
      subjectUserId: 'user_subject',
      subjectMembershipId: 'membership_123',
      actorUserId: 'user_actor',
      reason: 'Access review',
      idempotencyKey: 'remove:user_subject:request_1',
      invalidationScope: {
        workspaceScoped: ['membership', 'workspace_sessions', 'email_verification_state', 'password_reset_state', 'oauth_state'],
        preserved: ['personal_sessions', 'other_workspace_memberships'],
        queuedJobs: 'recheck_membership_before_execution',
      },
    });
    expect(result?.status).toBe('completed');
    expect(result?.invalidationScope.preserved).toEqual(['personal_sessions', 'other_workspace_memberships']);
  });

  it('fails closed when the result omits idempotency or preserved-session scope', () => {
    const result = {
      requestId: 'mrr_123', eventId: 'evt_123', status: 'completed', workspaceId: 'ws_123',
      subjectUserId: 'user_subject', subjectMembershipId: 'membership_123', actorUserId: 'user_actor',
      idempotencyKey: 'remove:user_subject:request_1',
      invalidationScope: { workspaceScoped: ['membership'], preserved: [], queuedJobs: 'recheck_membership_before_execution' },
    };
    expect(parseWorkspaceMemberRevocationResult(result)).toBeNull();
    expect(parseWorkspaceMemberRevocationResult({ ...result, idempotencyKey: '' })).toBeNull();
  });
});
