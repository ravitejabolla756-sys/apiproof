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
