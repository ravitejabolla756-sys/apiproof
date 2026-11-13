import { describe, expect, it } from 'vitest';
import { inAppNotificationAvailability, parseInAppNotifications } from '../apps/web/src/lib/in-app-notification-contract.js';

const validNotification = {
  id: 'ntf_123', category: 'findings', title: 'Breaking change found', message: 'Review the finding before creating a draft PR.',
  createdAt: '2026-11-13T10:00:00.000Z', readAt: null, href: '/dashboard/findings/fnd_123',
};

describe('in-app notification contract', () => {
  it('accepts a server-owned empty or populated projection', () => {
    expect(parseInAppNotifications({ notifications: [] })).toEqual([]);
    expect(parseInAppNotifications({ notifications: [validNotification] })).toEqual([validNotification]);
  });

  it('rejects malformed, duplicate, external-link and unknown-category records', () => {
    expect(parseInAppNotifications({ notifications: [{ ...validNotification, id: 'ntf_123' }, { ...validNotification }] })).toBeNull();
    expect(parseInAppNotifications({ notifications: [{ ...validNotification, category: 'unknown' }] })).toBeNull();
    expect(parseInAppNotifications({ notifications: [{ ...validNotification, href: 'https://evil.example' }] })).toBeNull();
    expect(parseInAppNotifications({ notifications: [{ ...validNotification, message: '' }] })).toBeNull();
  });

  it('keeps the presentation boundary explicitly unavailable until persistence is approved', () => {
    expect(inAppNotificationAvailability).toMatchObject({ status: 'unavailable', code: 'IN_APP_NOTIFICATIONS_SCHEMA_PENDING' });
  });
});
