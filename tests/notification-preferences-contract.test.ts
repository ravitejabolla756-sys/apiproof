import { describe, expect, it } from 'vitest';
import { parseNotificationPreferences } from '../apps/web/src/lib/notification-preferences-contract.js';

const validPreference = {
  category: 'weekly_digest',
  channel: 'email',
  enabled: false,
  required: false,
  deliveryAvailable: false,
};

describe('notification preference response contract', () => {
  it('accepts the reviewed server-owned preference shape', () => {
    expect(parseNotificationPreferences({ preferences: [validPreference] })).toEqual([validPreference]);
  });

  it.each([
    ['unknown category', { ...validPreference, category: 'marketing' }],
    ['unknown channel', { ...validPreference, channel: 'sms' }],
    ['non-boolean enabled flag', { ...validPreference, enabled: 'false' }],
    ['disabled required notification', { ...validPreference, required: true, enabled: false }],
    ['duplicate preference', validPreference],
  ])('rejects %s', (_label, item) => {
    const payload = item === validPreference ? { preferences: [validPreference, item] } : { preferences: [item] };
    expect(parseNotificationPreferences(payload)).toBeNull();
  });

  it('rejects a missing preference collection', () => {
    expect(parseNotificationPreferences({ preferences: null })).toBeNull();
    expect(parseNotificationPreferences(null)).toBeNull();
  });

  it('can require the server projection to include non-disablable controls', () => {
    expect(parseNotificationPreferences({ preferences: [validPreference] }, { requireRequired: true })).toBeNull();
    expect(parseNotificationPreferences({ preferences: [
      { category: 'security', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
      { category: 'account', channel: 'email', enabled: true, required: true, deliveryAvailable: false },
    ] }, { requireRequired: true })).not.toBeNull();
  });
});
