export type AuditEventProjection = {
  id: string;
  action: string;
  targetType: string;
  metadata: Record<string, unknown>;
  actorEmail: string | null;
  createdAt: string;
};

export type AuditPageProjection = {
  events: AuditEventProjection[];
  nextCursor: string | null;
};

const AUDIT_ACTION_LABELS: Record<string, string> = {
  'workspace.updated': 'Workspace settings updated',
  'member.role_updated': 'Member role updated',
  'member.revoked': 'Workspace member access revoked',
  'member.pending_invitations_invalidated': 'Pending invitations invalidated',
  'invitation.created': 'Invitation created',
  'invitation.revoked': 'Invitation cancelled',
  'invitation.accepted': 'Invitation accepted',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function normalizedText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

/** Validate the server-owned audit projection before exposing administrative history. */
export function parseAuditPage(payload: unknown): AuditPageProjection | null {
  if (!isRecord(payload) || !Array.isArray(payload.events)) return null;
  const nextCursor = payload.nextCursor === undefined || payload.nextCursor === null
    ? null
    : normalizedText(payload.nextCursor);
  if (payload.nextCursor !== undefined && payload.nextCursor !== null && !nextCursor) return null;

  const seen = new Set<string>();
  const events: AuditEventProjection[] = [];
  for (const item of payload.events) {
    const id = isRecord(item) ? normalizedText(item.id) : null;
    const action = isRecord(item) ? normalizedText(item.action) : null;
    const targetType = isRecord(item) ? normalizedText(item.targetType) : null;
    const actorEmail = isRecord(item) && isStringOrNull(item.actorEmail) ? (item.actorEmail === null ? null : normalizedText(item.actorEmail)) : undefined;
    const createdAt = isRecord(item) ? normalizedText(item.createdAt) : null;
    if (!isRecord(item) || !id || !action || !targetType || actorEmail === undefined || !createdAt) return null;
    if (seen.has(id)) return null;
    if (item.metadata !== undefined && !isRecord(item.metadata)) return null;
    seen.add(id);
    events.push({
      id,
      action,
      targetType,
      metadata: item.metadata ?? {},
      actorEmail,
      createdAt,
    });
  }

  return { events, nextCursor };
}

/** Merge cursor pages without allowing a repeated event to duplicate the audit trail. */
export function mergeAuditEvents(current: AuditEventProjection[], next: AuditEventProjection[]): AuditEventProjection[] | null {
  const seen = new Set<string>();
  for (const event of current) {
    if (seen.has(event.id)) return null;
    seen.add(event.id);
  }
  for (const event of next) {
    if (seen.has(event.id)) return null;
    seen.add(event.id);
  }
  return [...current, ...next];
}

/** Convert internal action codes to stable user-facing labels without exposing raw metadata. */
export function formatAuditAction(action: string): string {
  const knownLabel = AUDIT_ACTION_LABELS[action];
  if (knownLabel) return knownLabel;
  const fallback = action.replace(/[._-]+/g, ' ').trim();
  return fallback ? fallback.charAt(0).toUpperCase() + fallback.slice(1) : 'Administrative action';
}
