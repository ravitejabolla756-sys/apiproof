export type NotificationPreference = {
  category: string;
  channel: 'email' | 'slack';
  enabled: boolean;
  required: boolean;
  deliveryAvailable: boolean;
};

const CATEGORIES = new Set(['security', 'account', 'findings', 'scan_failure', 'migration', 'provider_change', 'weekly_digest']);
const REQUIRED_PREFERENCE_KEYS = new Set(['security:email', 'account:email']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Keep notification settings fail-closed when a server response drifts from
 * the reviewed preference projection. The parser intentionally does not
 * decide delivery policy; it only validates the server-owned shape.
 */
export function parseNotificationPreferences(payload: unknown, options: { requireRequired?: boolean } = {}): NotificationPreference[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.preferences)) return null;

  const seen = new Set<string>();
  const preferences: NotificationPreference[] = [];
  for (const item of payload.preferences) {
    if (!isRecord(item) || typeof item.category !== 'string' || !CATEGORIES.has(item.category)) return null;
    if (item.channel !== 'email' && item.channel !== 'slack') return null;
    if (typeof item.enabled !== 'boolean' || typeof item.required !== 'boolean' || typeof item.deliveryAvailable !== 'boolean') return null;
    if (item.required && !item.enabled) return null;
    const key = `${item.category}:${item.channel}`;
    if (seen.has(key)) return null;
    seen.add(key);
    preferences.push({
      category: item.category,
      channel: item.channel,
      enabled: item.enabled,
      required: item.required,
      deliveryAvailable: item.deliveryAvailable,
    });
  }

  if (options.requireRequired && [...REQUIRED_PREFERENCE_KEYS].some((key) => !seen.has(key))) return null;
  return preferences;
}
