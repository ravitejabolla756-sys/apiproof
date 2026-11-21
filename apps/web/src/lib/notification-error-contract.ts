function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function readNotificationErrorCode(value: unknown): string | null {
  if (!isRecord(value) || typeof value.code !== 'string') return null;
  const code = value.code.trim();
  return code.length > 0 ? code : null;
}

export function notificationErrorMessage(status: number, code: string | null, fallback: string): string {
  if (status === 401 || code === 'UNAUTHORIZED') return 'Your session has expired. Please sign in again.';
  if (status === 403 || code === 'WORKSPACE_ACCESS_DENIED') return 'You do not have permission to update these notification preferences.';
  if (status === 503 || code?.endsWith('_SCHEMA_UNAVAILABLE') || code === 'NOTIFICATION_DELIVERY_UNAVAILABLE') {
    return 'Notification preferences are temporarily unavailable.';
  }
  return fallback;
}
