import { describe, expect, it } from 'vitest';
import { buildMemberRevocationPlan, type MemberRevocationContext, type MemberRevocationRequest } from '../apps/web/src/lib/server/member-revocation.js';

const request: MemberRevocationRequest = {
  workspaceId: 'ws_a',
  userId: 'usr_member',
  reason: 'No longer participating',
  idempotencyKey: 'revocation-request-001',
};

const context: MemberRevocationContext = {
  actorUserId: 'usr_owner',
  actorWorkspaceId: 'ws_a',
  actorRole: 'owner',
  subjectWorkspaceId: 'ws_a',
  subjectUserId: 'usr_member',
  subjectMembershipId: 'wsm_member',
  subjectRole: 'member',
  ownerCount: 1,
  eventId: 'evt_revocation_001',
};

describe('ORG-10 non-destructive revocation boundary', () => {
  it('builds a tenant-scoped revocation plan without performing mutation', () => {
    const plan = buildMemberRevocationPlan(request, { ...context, ownerCount: 2 });

    expect(plan).toMatchObject({
      status: 'requested',
      workspaceId: 'ws_a',
      subjectUserId: 'usr_member',
      subjectMembershipId: 'wsm_member',
      actorUserId: 'usr_owner',
      reason: 'No longer participating',
      idempotencyKey: 'revocation-request-001',
      event: {
        eventId: 'evt_revocation_001',
        eventType: 'workspace.member_revocation.v1',
        workspaceId: 'ws_a',
        subjectUserId: 'usr_member',
        actorUserId: 'usr_owner',
        membershipId: 'wsm_member',
      },
      invalidationScope: {
        queuedJobs: 'recheck_membership_before_execution',
        workspaceScoped: expect.arrayContaining(['workspace_sessions', 'oauth_state']),
        preserved: ['personal_sessions', 'other_workspace_memberships'],
      },
    });
  });

  it('denies member actors and cross-workspace requests before mutation', () => {
    expect(() => buildMemberRevocationPlan(request, { ...context, actorRole: 'member', ownerCount: 2 }))
      .toThrow('WORKSPACE_CAPABILITY_DENIED');
    expect(() => buildMemberRevocationPlan(request, { ...context, actorWorkspaceId: 'ws_other', ownerCount: 2 }))
      .toThrow('WORKSPACE_ACCESS_DENIED');
    expect(() => buildMemberRevocationPlan(request, { ...context, subjectWorkspaceId: 'ws_other', ownerCount: 2 }))
      .toThrow('WORKSPACE_ACCESS_DENIED');
  });

  it('protects the final owner and keeps self-removal separate', () => {
    expect(() => buildMemberRevocationPlan({ ...request, userId: 'usr_owner' }, {
      ...context,
      subjectUserId: 'usr_owner',
      subjectMembershipId: 'wsm_owner',
      subjectRole: 'owner',
      ownerCount: 1,
    })).toThrow('SELF_REVOCATION_REQUIRES_SEPARATE_FLOW');
    expect(() => buildMemberRevocationPlan({ ...request, userId: 'usr_owner' }, {
      ...context,
      actorUserId: 'usr_admin',
      subjectUserId: 'usr_owner',
      subjectMembershipId: 'wsm_owner',
      subjectRole: 'owner',
      ownerCount: 1,
    })).toThrow('FINAL_OWNER_PROTECTED');
  });

  it('fails closed for unknown roles and missing members', () => {
    expect(() => buildMemberRevocationPlan(request, { ...context, actorRole: 'superuser', ownerCount: 2 }))
      .toThrow('WORKSPACE_ROLE_INVALID');
    expect(() => buildMemberRevocationPlan(request, { ...context, subjectMembershipId: null, ownerCount: 2 }))
      .toThrow('WORKSPACE_MEMBER_NOT_FOUND');
    expect(() => buildMemberRevocationPlan(request, { ...context, subjectRole: null, ownerCount: 2 }))
      .toThrow('WORKSPACE_MEMBER_NOT_FOUND');
  });

  it('bounds reason and idempotency input', () => {
    expect(() => buildMemberRevocationPlan({ ...request, reason: 'x'.repeat(501) }, { ...context, ownerCount: 2 }))
      .toThrow('REVOCATION_REASON_TOO_LONG');
    expect(() => buildMemberRevocationPlan({ ...request, idempotencyKey: 'x'.repeat(129) }, { ...context, ownerCount: 2 }))
      .toThrow('REVOCATION_IDEMPOTENCY_KEY_TOO_LONG');
  });
});
