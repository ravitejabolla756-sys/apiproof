export type MemberProjection = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'member';
  createdAt: string;
};

export type InvitationProjection = {
  id: string;
  email: string;
  role: 'owner' | 'member';
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isRole(value: unknown): value is 'owner' | 'member' {
  return value === 'owner' || value === 'member';
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

export function parseMemberCollection(payload: unknown): MemberProjection[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.members)) return null;
  const seen = new Set<string>();
  const members: MemberProjection[] = [];
  for (const item of payload.members) {
    if (!isRecord(item) || !isNonEmptyString(item.id) || !isNonEmptyString(item.userId) || !isNonEmptyString(item.email) || !isNonEmptyString(item.name) || !isRole(item.role) || !isNonEmptyString(item.createdAt)) return null;
    if (seen.has(item.id)) return null;
    seen.add(item.id);
    members.push({ id: item.id, userId: item.userId, email: item.email, name: item.name, role: item.role, createdAt: item.createdAt });
  }
  return members;
}

export function parseInvitationCollection(payload: unknown): InvitationProjection[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.invitations)) return null;
  const seen = new Set<string>();
  const invitations: InvitationProjection[] = [];
  for (const item of payload.invitations) {
    if (!isRecord(item) || !isNonEmptyString(item.id) || !isNonEmptyString(item.email) || !isRole(item.role) || !isNonEmptyString(item.expiresAt) || !isStringOrNull(item.acceptedAt) || !isStringOrNull(item.revokedAt) || !isNonEmptyString(item.createdAt)) return null;
    if (seen.has(item.id)) return null;
    seen.add(item.id);
    invitations.push({ id: item.id, email: item.email, role: item.role, expiresAt: item.expiresAt, acceptedAt: item.acceptedAt, revokedAt: item.revokedAt, createdAt: item.createdAt });
  }
  return invitations;
}
