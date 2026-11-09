export interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  created_at?: string | null;
  timestamp?: string | null;
  repo_name?: string | null;
  repo_full_name?: string | null;
  repository?: string | null;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function optionalText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

/** Validate the server-owned activity collection before rendering workspace events. */
export function parseActivityCollection(payload: unknown): ActivityItem[] | null {
  if (!record(payload) || !Array.isArray(payload.activities)) return null;
  const seen = new Set<string>();
  const activities: ActivityItem[] = [];
  for (const item of payload.activities) {
    if (!record(item)) return null;
    const id = text(item.id);
    const type = text(item.type);
    const title = text(item.title);
    const description = text(item.description);
    if (!id || !type || !title || !description || seen.has(id)) return null;
    seen.add(id);
    activities.push({
      id,
      type,
      title,
      description,
      created_at: optionalText(item.created_at),
      timestamp: optionalText(item.timestamp),
      repo_name: optionalText(item.repo_name),
      repo_full_name: optionalText(item.repo_full_name),
      repository: optionalText(item.repository),
    });
  }
  return activities;
}

/**
 * Formats raw activity timestamps into human-readable local date/time strings.
 * Safely falls back to "Unknown time" for missing, empty, or unparseable timestamps.
 */
export function formatActivityTimestamp(rawTimestamp?: string | number | null): string {
  if (rawTimestamp === null || rawTimestamp === undefined || rawTimestamp === '') {
    return 'Unknown time';
  }
  if (typeof rawTimestamp === 'string') {
    const calendar = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(rawTimestamp);
    if (calendar) {
      const year = Number(calendar[1]);
      const month = Number(calendar[2]);
      const day = Number(calendar[3]);
      const daysInMonth = month >= 1 && month <= 12 ? new Date(Date.UTC(year, month, 0)).getUTCDate() : 0;
      if (day < 1 || day > daysInMonth) return 'Unknown time';
    }
  }
  const date = new Date(rawTimestamp);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown time';
  }
  return date.toLocaleString();
}

/**
 * Keeps legacy plan-generation events from claiming verification. Older rows
 * were persisted with `migration_verified` before a migration was actually
 * verified; their title identifies that historical encoding unambiguously.
 */
export function getActivityTypeLabel(type: string, title?: string): string {
  if (type === 'migration_verified' && title === 'Migration Plan Generated') {
    return 'migration planned';
  }
  return type.replace('_', ' ');
}
