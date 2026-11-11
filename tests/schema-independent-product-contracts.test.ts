import { describe, expect, it } from 'vitest';
import { billingCheckoutAvailability } from '../apps/web/src/lib/billing-checkout-contract.js';
import { billingPortalAvailability } from '../apps/web/src/lib/billing-portal-contract.js';
import { billingUsagePercent, parseBillingSummary } from '../apps/web/src/lib/billing-summary-contract.js';
import { digestAvailability } from '../apps/web/src/lib/digest-notification-contract.js';
import { parseAuthMutationError, parseAuthMutationSuccess, parseAuthenticatedSession } from '../apps/web/src/lib/auth-response-contract.js';
import { parseNotificationPreferences } from '../apps/web/src/lib/notification-preferences-contract.js';

const summary = {
  subscription: { planId: 'free', status: 'beta', currentPeriodStart: '2026-11-01T00:00:00.000Z', currentPeriodEnd: '2026-12-01T00:00:00.000Z' },
  plan: { id: 'free', name: 'Free', description: 'Fixture', priceMonthly: 0, limits: { maxRepositories: 1, maxScansPerMonth: 10, maxDraftPrsPerMonth: 0 } },
  metrics: { repositories: { current: 0, limit: 1, allowed: true }, scans: { current: 0, limit: 10, allowed: true }, draftPrs: { current: 0, limit: 0, allowed: false } },
};

describe('schema-independent product contracts', () => {
  it('keeps billing checkout, portal and digest explicitly unavailable', () => {
    expect(billingCheckoutAvailability.status).toBe('unavailable');
    expect(billingPortalAvailability.status).toBe('unavailable');
    expect(digestAvailability.status).toBe('unavailable');
  });

  it('accepts the canonical billing projection and clamps usage safely', () => {
    expect(parseBillingSummary(summary)).toEqual(summary);
    expect(billingUsagePercent(0, 0)).toBe(0);
    expect(billingUsagePercent(15, 10)).toBe(100);
    expect(parseBillingSummary({ ...summary, metrics: { ...summary.metrics, scans: { current: Number.NaN, limit: 10, allowed: true } } })).toBeNull();
  });

  it('fails closed on notification preference drift', () => {
    expect(parseNotificationPreferences({ preferences: [{ category: 'weekly_digest', channel: 'email', enabled: false, required: false, deliveryAvailable: false }] })).not.toBeNull();
    expect(parseNotificationPreferences({ preferences: [{ category: 'unknown', channel: 'email', enabled: true, required: false, deliveryAvailable: false }] })).toBeNull();
  });

  it('validates authentication response markers without inventing success', () => {
    expect(parseAuthMutationSuccess({ success: true })).toBe(true);
    expect(parseAuthMutationSuccess({ success: false })).toBe(false);
    expect(parseAuthenticatedSession({ authenticated: true })).toBe(true);
    expect(parseAuthMutationError({ error: 'Denied' }, 'Fallback')).toBe('Denied');
    expect(parseAuthMutationError({}, 'Fallback')).toBe('Fallback');
  });
});
