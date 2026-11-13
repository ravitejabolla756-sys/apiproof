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
  if (!isRecord(payload) || !Array.isArray(payload.notifications)) return null;
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
