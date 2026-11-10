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
  | 'REVOCATION_IDEMPOTENCY_CONFLICT';

export interface MemberRevocationApiError {
  error: string;
  code: MemberRevocationErrorCode;
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
