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
