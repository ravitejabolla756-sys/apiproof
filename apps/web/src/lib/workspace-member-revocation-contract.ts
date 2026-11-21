export type WorkspaceMemberRevocationAvailability = {
  status: 'available';
  code: 'ORG_10_WORKSPACE_SCOPED';
  message: string;
};

export interface WorkspaceMemberRevocationRequest {
  readonly workspaceId: string;
  readonly userId: string;
  readonly reason?: string;
  readonly idempotencyKey: string;
}

export interface WorkspaceMemberRevocationResult {
  readonly requestId: string;
  readonly eventId: string;
  readonly status: 'completed';
  readonly workspaceId: string;
  readonly subjectUserId: string;
  readonly subjectMembershipId: string;
  readonly actorUserId: string;
  readonly reason?: string;
  readonly idempotencyKey: string;
  readonly invalidationScope: {
    readonly workspaceScoped: readonly string[];
    readonly preserved: readonly string[];
    readonly queuedJobs: 'recheck_membership_before_execution';
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyText(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function stringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const values = value.map(nonEmptyText);
  return values.every((item): item is string => item !== null) ? values : null;
}

/** Parse the reviewed Member 1 ORG-10 result for server-side consumers. */
export function parseWorkspaceMemberRevocationResult(value: unknown): WorkspaceMemberRevocationResult | null {
  if (!isRecord(value) || value.status !== 'completed') return null;
  const requestId = nonEmptyText(value.requestId);
  const eventId = nonEmptyText(value.eventId);
  const workspaceId = nonEmptyText(value.workspaceId);
  const subjectUserId = nonEmptyText(value.subjectUserId);
  const subjectMembershipId = nonEmptyText(value.subjectMembershipId);
  const actorUserId = nonEmptyText(value.actorUserId);
  const idempotencyKey = nonEmptyText(value.idempotencyKey);
  if (!requestId || !eventId || !workspaceId || !subjectUserId || !subjectMembershipId || !actorUserId || !idempotencyKey) return null;
  const scope = isRecord(value.invalidationScope) ? value.invalidationScope : null;
  const workspaceScoped = stringArray(scope?.workspaceScoped);
  const preserved = stringArray(scope?.preserved);
  if (!workspaceScoped || !preserved || scope?.queuedJobs !== 'recheck_membership_before_execution') return null;
  if (!workspaceScoped.includes('membership') || !workspaceScoped.includes('workspace_sessions')) return null;
  if (!preserved.includes('personal_sessions') || !preserved.includes('other_workspace_memberships')) return null;
  let reason: string | undefined;
  if (value.reason !== undefined) {
    const normalizedReason = nonEmptyText(value.reason);
    if (!normalizedReason) return null;
    reason = normalizedReason;
  }
  return {
    requestId,
    eventId,
    status: 'completed',
    workspaceId,
    subjectUserId,
    subjectMembershipId,
    actorUserId,
    ...(reason === undefined ? {} : { reason }),
    idempotencyKey,
    invalidationScope: { workspaceScoped, preserved, queuedJobs: scope.queuedJobs },
  };
}

/**
 * The integrated endpoint is workspace-scoped. The server remains the source
 * of truth for authorization, final-owner protection and idempotency; this
 * projection only explains the safety boundary to the settings UI.
 */
export const workspaceMemberRevocationAvailability: WorkspaceMemberRevocationAvailability = {
  status: 'available',
  code: 'ORG_10_WORKSPACE_SCOPED',
  message: 'Removing a member revokes access only to this workspace. Personal sessions and access to other workspaces are preserved.',
};
