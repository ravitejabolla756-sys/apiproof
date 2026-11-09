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
  return workspaceName ? { workspaceName } : null;
}

/** Parse the minimal server-owned projection returned after creating an invite. */
export function parseCreatedInvitationResponse(value: unknown): CreatedInvitationProjection | null {
  if (!isRecord(value) || typeof value.inviteUrl !== 'string') return null;
  const inviteUrl = value.inviteUrl.trim();
  return inviteUrl ? { inviteUrl } : null;
}

/** Require the explicit server success marker before reflecting cancellation locally. */
export function parseRevokedInvitationResponse(value: unknown): { success: true } | null {
  return isRecord(value) && value.success === true ? { success: true } : null;
}
