export type AcceptedInvitationProjection = {
  workspaceName: string;
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
