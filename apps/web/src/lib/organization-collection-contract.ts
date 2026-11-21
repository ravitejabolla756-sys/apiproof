export type MemberProjection = {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string;
};

export type InvitationProjection = {
  id: string;
  email: string;
  role: 'owner' | 'admin' | 'member';
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function isRole(value: unknown): value is 'owner' | 'admin' | 'member' {
  return value === 'owner' || value === 'admin' || value === 'member';
}

function normalizedStringOrNull(value: unknown): string | null | undefined {
  if (value === null) return null;
  return normalizedText(value) ?? undefined;
}

export function parseMemberCollection(payload: unknown): MemberProjection[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.members)) return null;
  const seen = new Set<string>();
  const members: MemberProjection[] = [];
  for (const item of payload.members) {
    const id = isRecord(item) ? normalizedText(item.id) : null;
    const userId = isRecord(item) ? normalizedText(item.userId) : null;
    const email = isRecord(item) ? normalizedText(item.email) : null;
    const name = isRecord(item) ? normalizedText(item.name) : null;
    const createdAt = isRecord(item) ? normalizedText(item.createdAt) : null;
    if (!isRecord(item) || !id || !userId || !email || !name || !isRole(item.role) || !createdAt) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    members.push({ id, userId, email, name, role: item.role, createdAt });
  }
  return members;
}

export function parseInvitationCollection(payload: unknown): InvitationProjection[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.invitations)) return null;
  const seen = new Set<string>();
  const invitations: InvitationProjection[] = [];
  for (const item of payload.invitations) {
    const id = isRecord(item) ? normalizedText(item.id) : null;
    const email = isRecord(item) ? normalizedText(item.email) : null;
    const expiresAt = isRecord(item) ? normalizedText(item.expiresAt) : null;
    const acceptedAt = isRecord(item) ? normalizedStringOrNull(item.acceptedAt) : undefined;
    const revokedAt = isRecord(item) ? normalizedStringOrNull(item.revokedAt) : undefined;
    const createdAt = isRecord(item) ? normalizedText(item.createdAt) : null;
    if (!isRecord(item) || !id || !email || !isRole(item.role) || !expiresAt || acceptedAt === undefined || revokedAt === undefined || !createdAt) return null;
    if (seen.has(id)) return null;
    seen.add(id);
    invitations.push({ id, email, role: item.role, expiresAt, acceptedAt, revokedAt, createdAt });
  }
  return invitations;
}
