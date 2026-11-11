import { describe, expect, it } from 'vitest';
import { reconcileBillingEvent, type BillingWebhookEvent } from '../apps/web/src/lib/server/billing/provider.js';

function event(eventType: string, overrides: Partial<BillingWebhookEvent> = {}): BillingWebhookEvent {
  return { id: `evt_${eventType}`, provider: 'test', eventType, rawPayload: '{}', ...overrides };
}

describe('BILL-04 provider-neutral subscription lifecycle', () => {
  it.each([
    ['customer.subscription.created', 'active'],
    ['customer.subscription.updated', 'trialing'],
    ['invoice.payment_succeeded', 'active'],
    ['invoice.payment_failed', 'past_due'],
    ['customer.subscription.deleted', 'canceled'],
  ])('maps documented %s to %s', (eventType, status) => {
    const decision = reconcileBillingEvent(event(eventType, { status: eventType === 'invoice.payment_succeeded' ? undefined : status, planId: 'pro', subscriptionId: 'sub_1' }));
    expect(decision).toMatchObject({ action: 'apply', status });
  });

  it('forces canceled subscriptions to the free plan', () => {
    expect(reconcileBillingEvent(event('customer.subscription.deleted', { status: 'canceled', planId: 'pro' })))
      .toMatchObject({ action: 'apply', status: 'canceled', planId: 'free' });
  });

  it.each([
    ['charge.refunded', 'REFUND_POLICY_PENDING'],
    ['invoice.refunded', 'REFUND_POLICY_PENDING'],
    ['customer.subscription.paused', 'GRACE_POLICY_PENDING'],
    ['invoice.payment_action_required', 'GRACE_POLICY_PENDING'],
    ['customer.subscription.unknown', 'UNSUPPORTED_BILLING_EVENT'],
  ])('does not guess policy for %s', (eventType, reason) => {
    expect(reconcileBillingEvent(event(eventType))).toEqual({ action: 'ignore', reason });
  });

  it('rejects invalid statuses and stale period updates', () => {
    expect(reconcileBillingEvent(event('customer.subscription.updated', { status: 'mystery' })))
      .toEqual({ action: 'ignore', reason: 'INVALID_BILLING_STATUS' });
    expect(reconcileBillingEvent(event('customer.subscription.updated', { status: 'active', periodEnd: '2026-01-01T00:00:00.000Z' }), {
      status: 'active', planId: 'pro', currentPeriodEnd: '2026-02-01T00:00:00.000Z',
    })).toEqual({ action: 'ignore', reason: 'OUT_OF_ORDER_PERIOD' });
  });
});
