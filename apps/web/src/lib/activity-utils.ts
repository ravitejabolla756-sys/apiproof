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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredActivityText(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function optionalActivityText(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  return requiredActivityText(value, maxLength);
}

function parseActivity(value: unknown): ActivityItem | undefined {
  if (!isRecord(value)) return undefined;
  const id = requiredActivityText(value.id, 256);
  const type = requiredActivityText(value.type, 128);
  const title = requiredActivityText(value.title, 512);
  const description = requiredActivityText(value.description, 4000);
  const createdAt = optionalActivityText(value.created_at, 128);
  const timestamp = optionalActivityText(value.timestamp, 128);
  const repoName = optionalActivityText(value.repo_name, 256);
  const repoFullName = optionalActivityText(value.repo_full_name, 512);
  const repository = optionalActivityText(value.repository, 512);
  if (!id || !type || !title || !description || createdAt === undefined || timestamp === undefined || repoName === undefined || repoFullName === undefined || repository === undefined) {
    return undefined;
  }
  return { id, type, title, description, created_at: createdAt, timestamp, repo_name: repoName, repo_full_name: repoFullName, repository };
}

export function parseActivityResponse(value: unknown): ActivityItem[] | undefined {
  if (!isRecord(value) || !Array.isArray(value.activities) || value.activities.length > 2048) return undefined;
  const activities = value.activities.map(parseActivity);
  return activities.every((activity): activity is ActivityItem => Boolean(activity)) ? activities : undefined;
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
