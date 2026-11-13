export type AcceptedInvitationProjection = {
  workspaceName: string;
};

export type CreatedInvitationProjection = {
  inviteUrl: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Parse the minimal server-owned projection needed after accepting an invitation. */
export function parseAcceptedInvitationResponse(value: unknown): AcceptedInvitationProjection | null {
  if (!isRecord(value) || !isRecord(value.workspace) || typeof value.workspace.name !== 'string') return null;
  const workspaceName = value.workspace.name.trim();
  return workspaceName && workspaceName.length <= 256 ? { workspaceName } : null;
}

/** Parse the minimal server-owned projection returned after creating an invite. */
export function parseCreatedInvitationResponse(value: unknown): CreatedInvitationProjection | null {
  if (!isRecord(value) || typeof value.inviteUrl !== 'string') return null;
  const inviteUrl = value.inviteUrl.trim();
  return inviteUrl && inviteUrl.length <= 4096 ? { inviteUrl } : null;
}

/** Require the explicit server success marker before reflecting cancellation locally. */
export function parseRevokedInvitationResponse(value: unknown): { success: true } | null {
  return isRecord(value) && value.success === true ? { success: true } : null;
}

export function parseInvitationError(value: unknown, fallback: string): string {
  if (!isRecord(value) || typeof value.code !== 'string') return fallback;
  const messages: Record<string, string> = {
    UNAUTHORIZED: 'Sign in with the invited account before accepting this invitation.',
    INVITATION_NOT_FOUND: 'This invitation is no longer available.',
    INVITATION_ALREADY_USED: 'This invitation has already been used or revoked.',
    INVITATION_EXPIRED: 'This invitation has expired.',
    INVITATION_EMAIL_MISMATCH: 'Sign in with the invited email address to accept this invitation.',
    ALREADY_A_MEMBER: 'This account is already a member of the workspace.',
    ORGANIZATION_SCHEMA_UNAVAILABLE: 'Workspace invitations are temporarily unavailable.',
  };
  return messages[value.code] ?? fallback;
}
