import {
  assertWorkspaceCapability,
  normalizeWorkspaceRole,
  type WorkspaceRole,
} from './workspace-policy.js';

const MAX_REASON_LENGTH = 500;
const MAX_IDEMPOTENCY_KEY_LENGTH = 128;

export interface MemberRevocationRequest {
  readonly workspaceId: string;
  readonly userId: string;
  readonly reason?: string | undefined;
  readonly idempotencyKey: string;
}

/**
 * Server-derived state required to prepare a revocation. This is deliberately
 * not a database adapter: the future endpoint must load every field from the
 * current transaction and must not trust client-supplied roles or membership.
 */
export interface MemberRevocationContext {
  readonly actorUserId: string;
  readonly actorWorkspaceId: string;
  readonly actorRole: string;
  readonly subjectWorkspaceId: string;
  readonly subjectUserId: string;
  readonly subjectMembershipId: string | null;
  readonly subjectRole: string | null;
  readonly ownerCount: number;
  readonly eventId: string;
}

export interface MemberRevocationPlan {
  readonly status: 'requested';
  readonly workspaceId: string;
  readonly subjectUserId: string;
  readonly subjectMembershipId: string;
  readonly actorUserId: string;
  readonly reason: string | undefined;
  readonly idempotencyKey: string;
  readonly event: {
    readonly eventId: string;
    readonly eventType: 'workspace.member_revocation.v1';
    readonly workspaceId: string;
    readonly subjectUserId: string;
    readonly actorUserId: string;
    readonly membershipId: string;
    readonly reason: string | undefined;
    readonly idempotencyKey: string;
  };
  readonly invalidationScope: {
    readonly workspaceScoped: ReadonlyArray<string>;
    readonly preserved: ReadonlyArray<string>;
    readonly queuedJobs: 'recheck_membership_before_execution';
  };
}

function requiredIdentifier(value: string, errorCode: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(errorCode);
  return value;
}

function normalizeReason(reason: string | undefined): string | undefined {
  if (reason === undefined) return undefined;
  const normalized = reason.trim();
  if (normalized.length > MAX_REASON_LENGTH) throw new Error('REVOCATION_REASON_TOO_LONG');
  return normalized || undefined;
}

function assertIdempotencyKey(value: string): string {
  const key = requiredIdentifier(value, 'REVOCATION_IDEMPOTENCY_KEY_REQUIRED');
  if (key.length > MAX_IDEMPOTENCY_KEY_LENGTH) throw new Error('REVOCATION_IDEMPOTENCY_KEY_TOO_LONG');
  return key;
}

/**
 * Validates the non-destructive ORG-10 boundary and returns the event/invalidation
 * plan that a later approved transaction may persist. It performs no writes,
 * session invalidation, membership deletion, invitation mutation, or job cancel.
 */
export function buildMemberRevocationPlan(
  request: MemberRevocationRequest,
  context: MemberRevocationContext,
): MemberRevocationPlan {
  const workspaceId = requiredIdentifier(request.workspaceId, 'WORKSPACE_ID_REQUIRED');
  const subjectUserId = requiredIdentifier(request.userId, 'SUBJECT_USER_ID_REQUIRED');
  const idempotencyKey = assertIdempotencyKey(request.idempotencyKey);
  const actorUserId = requiredIdentifier(context.actorUserId, 'ACTOR_USER_ID_REQUIRED');
  const eventId = requiredIdentifier(context.eventId, 'REVOCATION_EVENT_ID_REQUIRED');
  const reason = normalizeReason(request.reason);

  if (context.actorWorkspaceId !== workspaceId || context.subjectWorkspaceId !== workspaceId) {
    throw new Error('WORKSPACE_ACCESS_DENIED');
  }
  if (context.subjectUserId !== subjectUserId || !context.subjectMembershipId || !context.subjectRole) {
    throw new Error('WORKSPACE_MEMBER_NOT_FOUND');
  }
  if (actorUserId === subjectUserId) {
    throw new Error('SELF_REVOCATION_REQUIRES_SEPARATE_FLOW');
  }
  if (!Number.isInteger(context.ownerCount) || context.ownerCount < 1) {
    throw new Error('OWNER_COUNT_INVALID');
  }

  const actorRole: WorkspaceRole = normalizeWorkspaceRole(context.actorRole);
  const subjectRole: WorkspaceRole = normalizeWorkspaceRole(context.subjectRole);
  assertWorkspaceCapability(actorRole, 'workspace:manage_members');
  if (subjectRole === 'owner' && context.ownerCount === 1) {
    throw new Error('FINAL_OWNER_PROTECTED');
  }

  return {
    status: 'requested',
    workspaceId,
    subjectUserId,
    subjectMembershipId: context.subjectMembershipId,
    actorUserId,
    reason,
    idempotencyKey,
    event: {
      eventId,
      eventType: 'workspace.member_revocation.v1',
      workspaceId,
      subjectUserId,
      actorUserId,
      membershipId: context.subjectMembershipId,
      reason,
      idempotencyKey,
    },
    invalidationScope: {
      workspaceScoped: [
        'membership',
        'workspace_sessions',
        'email_verification_state',
        'password_reset_state',
        'oauth_state',
      ],
      preserved: ['personal_sessions', 'other_workspace_memberships'],
      queuedJobs: 'recheck_membership_before_execution',
    },
  };
}
