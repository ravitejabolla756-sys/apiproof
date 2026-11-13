export const MEMBER_REVOCATION_EVENT = 'workspace.member_revocation.v1' as const;
export const MEMBER_REMOVED_AUDIT_ACTION = 'member.removed' as const;

export interface MemberRevocationApiRequest {
  workspaceId: string;
  userId: string;
  reason?: string;
  idempotencyKey?: string;
}

export interface MemberRevocationApiResponse {
  success: true;
  revocation?: {
    requestId: string;
    eventId: string;
    status: 'completed';
    workspaceId: string;
    subjectUserId: string;
    subjectMembershipId: string;
    idempotencyKey: string;
  };
}

export type MemberRevocationErrorCode =
  | 'UNAUTHORIZED'
  | 'WORKSPACE_ACCESS_DENIED'
  | 'WORKSPACE_CAPABILITY_DENIED'
  | 'FINAL_OWNER_PROTECTED'
  | 'SELF_REVOCATION_REQUIRES_SEPARATE_FLOW'
  | 'REVOCATION_IDEMPOTENCY_CONFLICT'
  | 'REVOCATION_SCHEMA_UNAVAILABLE'
  | 'INTERNAL_ERROR';

export interface MemberRevocationApiError {
  error: string;
  code: MemberRevocationErrorCode;
}

/** Maps server-side revocation failures to the stable DELETE route contract. */
export function mapMemberRevocationError(error: unknown): MemberRevocationApiError {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'WORKSPACE_ACCESS_DENIED':
    case 'WORKSPACE_MEMBER_NOT_FOUND':
      return { error: 'Workspace access denied.', code: 'WORKSPACE_ACCESS_DENIED' };
    case 'WORKSPACE_CAPABILITY_DENIED':
      return { error: 'Workspace member-management access denied.', code };
    case 'FINAL_OWNER_PROTECTED':
      return { error: 'The final workspace owner cannot be removed.', code };
    case 'SELF_REVOCATION_REQUIRES_SEPARATE_FLOW':
      return { error: 'Leaving a workspace uses a separate workflow.', code };
    case 'REVOCATION_IDEMPOTENCY_CONFLICT':
      return { error: 'The idempotency key was already used for another request.', code };
    case 'REVOCATION_SCHEMA_UNAVAILABLE':
      return { error: 'Workspace member removal is unavailable until the approved revocation schema is installed.', code };
    default:
      return { error: 'Unable to revoke workspace membership.', code: 'INTERNAL_ERROR' };
  }
}

export function normalizeMemberRevocationRequest(input: MemberRevocationApiRequest): MemberRevocationApiRequest {
  const workspaceId = input.workspaceId.trim();
  const userId = input.userId.trim();
  const reason = input.reason?.trim() || undefined;
  const idempotencyKey = input.idempotencyKey?.trim() || undefined;
  if (!workspaceId) throw new Error('WORKSPACE_ID_REQUIRED');
  if (!userId) throw new Error('SUBJECT_USER_ID_REQUIRED');
  return { workspaceId, userId, ...(reason ? { reason } : {}), ...(idempotencyKey ? { idempotencyKey } : {}) };
}

export function assertMemberRevocationResponse(response: MemberRevocationApiResponse): void {
  if (response.success !== true) throw new Error('INVALID_MEMBER_REVOCATION_RESPONSE');
  if (!response.revocation) return;
  if (response.revocation.status !== 'completed' || response.revocation.workspaceId.length === 0
    || response.revocation.subjectUserId.length === 0 || response.revocation.eventId.length === 0) {
    throw new Error('INVALID_MEMBER_REVOCATION_RESPONSE');
  }
}
