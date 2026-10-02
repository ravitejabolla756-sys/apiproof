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
  const date = new Date(rawTimestamp);
  if (isNaN(date.getTime())) {
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
