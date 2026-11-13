import { getDatabase, type DatabaseAdapter } from './db/index.js';

export type NotificationCategory = 'security' | 'account' | 'findings' | 'scan_failure' | 'migration' | 'provider_change' | 'weekly_digest';
export type NotificationChannel = 'email' | 'slack';

export interface NotificationPreference {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
  required: boolean;
  deliveryAvailable: boolean;
}

export class NotificationPreferencesUnavailableError extends Error {
  readonly code = 'NOTIFICATION_PREFERENCES_UNAVAILABLE';

  constructor() {
    super('Notification preferences are unavailable until the approved notification schema is installed.');
    this.name = 'NotificationPreferencesUnavailableError';
  }
}

const DEFAULTS: Array<{ category: NotificationCategory; channel: NotificationChannel; enabled: boolean; required: boolean; deliveryAvailable: boolean }> = [
  { category: 'security', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
  { category: 'account', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
  { category: 'findings', channel: 'email', enabled: false, required: false, deliveryAvailable: false },
  { category: 'findings', channel: 'slack', enabled: true, required: false, deliveryAvailable: true },
  { category: 'scan_failure', channel: 'email', enabled: false, required: false, deliveryAvailable: false },
  { category: 'scan_failure', channel: 'slack', enabled: true, required: false, deliveryAvailable: true },
  { category: 'migration', channel: 'email', enabled: false, required: false, deliveryAvailable: false },
  { category: 'migration', channel: 'slack', enabled: true, required: false, deliveryAvailable: true },
  { category: 'provider_change', channel: 'email', enabled: false, required: false, deliveryAvailable: false },
  { category: 'provider_change', channel: 'slack', enabled: true, required: false, deliveryAvailable: true },
  { category: 'weekly_digest', channel: 'email', enabled: false, required: false, deliveryAvailable: false },
  { category: 'weekly_digest', channel: 'slack', enabled: false, required: false, deliveryAvailable: false },
];

const VALID_CATEGORIES = new Set<NotificationCategory>(DEFAULTS.map((item) => item.category));
const VALID_CHANNELS = new Set<NotificationChannel>(DEFAULTS.map((item) => item.channel));
const VALID_PREFERENCE_KEYS = new Set(DEFAULTS.map((item) => `${item.category}:${item.channel}`));
const DIGEST_SCHEDULING_AVAILABLE = false;

async function requirePreferencesTable(database: DatabaseAdapter): Promise<void> {
  try {
    await database.query('SELECT 1 FROM user_notification_preferences LIMIT 1');
  } catch {
    throw new NotificationPreferencesUnavailableError();
  }
}

export async function getNotificationPreferences(userId: string, database: DatabaseAdapter = getDatabase()): Promise<NotificationPreference[]> {
  await requirePreferencesTable(database);
  const rows = await database.query<{ category: NotificationCategory; channel: NotificationChannel; enabled: number | boolean }>(
    'SELECT category, channel, enabled FROM user_notification_preferences WHERE user_id = ?', [userId],
  );
  const stored = new Map(rows.map((row) => [`${row.category}:${row.channel}`, Boolean(row.enabled)]));
  return DEFAULTS.map((item) => ({
    ...item,
    enabled: item.category === 'weekly_digest' && !DIGEST_SCHEDULING_AVAILABLE ? false : stored.get(`${item.category}:${item.channel}`) ?? item.enabled,
  }));
}

export async function isNotificationPreferenceEnabled(
  userId: string,
  category: NotificationCategory,
  channel: NotificationChannel,
  database: DatabaseAdapter = getDatabase(),
): Promise<boolean> {
  await requirePreferencesTable(database);
  const fallback = DEFAULTS.find((item) => item.category === category && item.channel === channel);
  if (!fallback || (category === 'weekly_digest' && !DIGEST_SCHEDULING_AVAILABLE)) return false;
  const row = await database.queryOne<{ enabled: number | boolean }>(
    'SELECT enabled FROM user_notification_preferences WHERE user_id = ? AND category = ? AND channel = ?',
    [userId, category, channel],
  );
  return row ? Boolean(row.enabled) : fallback.enabled;
}

export async function updateNotificationPreferences(
  userId: string,
  updates: Array<{ category: NotificationCategory; channel: NotificationChannel; enabled: boolean }>,
  database: DatabaseAdapter = getDatabase(),
): Promise<NotificationPreference[]> {
  for (const update of updates) {
    if (!VALID_CATEGORIES.has(update.category) || !VALID_CHANNELS.has(update.channel) || !VALID_PREFERENCE_KEYS.has(`${update.category}:${update.channel}`)) {
      throw new Error('Invalid notification preference category or channel.');
    }
    const required = DEFAULTS.find((item) => item.category === update.category && item.channel === update.channel)?.required;
    if (required && !update.enabled) throw new Error('Security and account-recovery notifications cannot be disabled.');
  }
  await requirePreferencesTable(database);
  const now = new Date().toISOString();
  await database.transaction(async (tx) => {
    for (const update of updates) {
      await tx.execute(
        `INSERT INTO user_notification_preferences (user_id, category, channel, enabled, updated_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(user_id, category, channel) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at`,
        [userId, update.category, update.channel, update.enabled ? 1 : 0, now],
      );
    }
  });
  return getNotificationPreferences(userId, database);
}
