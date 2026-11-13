export type InAppNotificationCategory = 'security' | 'account' | 'findings' | 'scan_failure' | 'migration' | 'provider_change';

export type InAppNotification = {
  id: string;
  category: InAppNotificationCategory;
  title: string;
  message: string;
  createdAt: string;
  readAt: string | null;
  href: string | null;
};

export type InAppNotificationFeed = {
  notifications: InAppNotification[];
  status: 'projection' | 'unavailable';
  readState: 'available' | 'unavailable';
};

export const inAppNotificationAvailability = {
  status: 'unavailable' as const,
  code: 'IN_APP_NOTIFICATIONS_SCHEMA_PENDING' as const,
  message: 'In-app notifications are unavailable until the approved event and persistence schema is installed.',
};

const CATEGORIES = new Set<InAppNotificationCategory>(['security', 'account', 'findings', 'scan_failure', 'migration', 'provider_change']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

function validIsoDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function validInternalHref(value: unknown): value is string | null {
  return value === null || (typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !/[\r\n]/.test(value));
}

/**
 * Validate only a server-owned projection. Authorization, tenant scope, and
 * read-state changes must be enforced by the server endpoint before parsing.
 */
export function parseInAppNotifications(payload: unknown): InAppNotification[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.notifications) || payload.notifications.length > 2048) return null;
  const seen = new Set<string>();
  const notifications: InAppNotification[] = [];
  for (const item of payload.notifications) {
    if (!isRecord(item) || !validText(item.id, 128) || seen.has(item.id) || !CATEGORIES.has(item.category as InAppNotificationCategory)
      || !validText(item.title, 200) || !validText(item.message, 2000) || !validIsoDate(item.createdAt)
      || !(item.readAt === null || validIsoDate(item.readAt)) || !validInternalHref(item.href)) return null;
    seen.add(item.id);
    notifications.push({
      id: item.id,
      category: item.category as InAppNotificationCategory,
      title: item.title,
      message: item.message,
      createdAt: item.createdAt,
      readAt: item.readAt as string | null,
      href: item.href as string | null,
    });
  }
  return notifications;
}

/**
 * Parse the complete server-owned feed envelope without implying that a
 * projection has durable read-state support.
 */
export function parseInAppNotificationFeed(payload: unknown): InAppNotificationFeed | null {
  const notifications = parseInAppNotifications(payload);
  if (!notifications || !isRecord(payload)) return null;
  if (payload.status !== 'projection' && payload.status !== 'unavailable') return null;
  if (payload.readState !== 'available' && payload.readState !== 'unavailable') return null;
  const status = payload.status;
  const readState = payload.readState;
  return { notifications, status, readState };
}

export function parseInAppNotificationMessage(value: unknown, fallback: string): string {
  if (!isRecord(value) || typeof value.message !== 'string') return fallback;
  const message = value.message.trim();
  return message && message.length <= 512 ? message : fallback;
}

export function parseInAppNotificationError(value: unknown, fallback: string): string {
  if (!isRecord(value) || typeof value.error !== 'string') return fallback;
  const error = value.error.trim();
  return error && error.length <= 512 ? error : fallback;
}

export function parseInAppNotificationCode(value: unknown): string | undefined {
  if (!isRecord(value) || typeof value.code !== 'string' || !/^[A-Z0-9_:-]{3,96}$/.test(value.code)) return undefined;
  return value.code;
}
