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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

/** Validate the server-owned audit projection before exposing administrative history. */
export function parseAuditPage(payload: unknown): AuditPageProjection | null {
  if (!isRecord(payload) || !Array.isArray(payload.events)) return null;
  if (payload.nextCursor !== undefined && payload.nextCursor !== null && typeof payload.nextCursor !== 'string') return null;

  const seen = new Set<string>();
  const events: AuditEventProjection[] = [];
  for (const item of payload.events) {
    if (!isRecord(item) || typeof item.id !== 'string' || item.id.length === 0 || typeof item.action !== 'string' || item.action.length === 0 || typeof item.targetType !== 'string' || item.targetType.length === 0 || !isStringOrNull(item.actorEmail) || typeof item.createdAt !== 'string' || item.createdAt.length === 0) return null;
    if (seen.has(item.id)) return null;
    if (item.metadata !== undefined && !isRecord(item.metadata)) return null;
    seen.add(item.id);
    events.push({
      id: item.id,
      action: item.action,
      targetType: item.targetType,
      metadata: item.metadata ?? {},
      actorEmail: item.actorEmail,
      createdAt: item.createdAt,
    });
  }

  return { events, nextCursor: payload.nextCursor ?? null };
}
