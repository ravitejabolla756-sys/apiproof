import crypto from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { POST as receiveBillingWebhook } from '../apps/web/src/app/api/webhooks/billing/route.js';
import {
  BillingProviderUnavailableError,
  BillingWebhookInputError,
  BillingWebhookSignatureError,
  getBillingProvider,
  MAX_BILLING_WEBHOOK_BYTES,
  MockBillingProvider,
} from '../apps/web/src/lib/server/billing/provider.js';

const TEST_SECRET = 'billing-boundary-test-secret-with-32-bytes';
const originalEnvironment = {
  nodeEnv: process.env.NODE_ENV,
  webhookSecret: process.env.BILLING_WEBHOOK_SECRET,
};

function signed(rawBody: string): string {
  return crypto.createHmac('sha256', TEST_SECRET).update(rawBody).digest('hex');
}

function webhookRequest(rawBody: string, signature: string): Request {
  return new Request('http://localhost/api/webhooks/billing', {
    method: 'POST',
    headers: { 'x-billing-signature': signature },
    body: rawBody,
  });
}

afterEach(() => {
  if (originalEnvironment.nodeEnv === undefined) delete process.env.NODE_ENV;
  else process.env.NODE_ENV = originalEnvironment.nodeEnv;
  if (originalEnvironment.webhookSecret === undefined) delete process.env.BILLING_WEBHOOK_SECRET;
  else process.env.BILLING_WEBHOOK_SECRET = originalEnvironment.webhookSecret;
});

describe('billing provider environment and webhook boundary', () => {
  it('does not expose the mock provider in production', async () => {
    process.env.NODE_ENV = 'production';
    expect(() => getBillingProvider()).toThrow(BillingProviderUnavailableError);

    const response = await receiveBillingWebhook(webhookRequest('{}', ''));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: 'Billing webhook processing is unavailable' });
  });

  it('requires an explicit sufficiently long mock signing secret', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.BILLING_WEBHOOK_SECRET;
    await expect(new MockBillingProvider().verifyAndParseWebhook('{}', ''))
      .rejects.toBeInstanceOf(BillingProviderUnavailableError);

    process.env.BILLING_WEBHOOK_SECRET = 'short';
    await expect(new MockBillingProvider().verifyAndParseWebhook('{}', ''))
      .rejects.toBeInstanceOf(BillingProviderUnavailableError);
  });

  it('returns safe generic responses for invalid signatures and malformed signed events', async () => {
    process.env.NODE_ENV = 'test';
    process.env.BILLING_WEBHOOK_SECRET = TEST_SECRET;

    const invalidSignature = await receiveBillingWebhook(webhookRequest('{}', 'not-a-signature'));
    expect(invalidSignature.status).toBe(401);
    expect(await invalidSignature.json()).toEqual({ error: 'Invalid webhook signature' });

    const invalidBody = '{"type":"subscription.updated"}';
    const invalidEvent = await receiveBillingWebhook(webhookRequest(invalidBody, signed(invalidBody)));
    expect(invalidEvent.status).toBe(400);
    expect(await invalidEvent.json()).toEqual({ error: 'Invalid billing webhook' });
  });

  it('rejects malformed JSON without returning parser details', async () => {
    process.env.NODE_ENV = 'test';
    process.env.BILLING_WEBHOOK_SECRET = TEST_SECRET;
    const rawBody = '{';

    const response = await receiveBillingWebhook(webhookRequest(rawBody, signed(rawBody)));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid billing webhook' });
  });

  it('rejects oversized webhook streams at the route boundary', async () => {
    process.env.NODE_ENV = 'test';
    process.env.BILLING_WEBHOOK_SECRET = TEST_SECRET;
    const oversizedBody = 'x'.repeat(MAX_BILLING_WEBHOOK_BYTES + 1);

    const response = await receiveBillingWebhook(webhookRequest(oversizedBody, signed(oversizedBody)));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid billing webhook' });
  });

  it('preserves signed UTF-8 bytes during bounded decoding before JSON validation', async () => {
    process.env.NODE_ENV = 'test';
    process.env.BILLING_WEBHOOK_SECRET = TEST_SECRET;
    const rawBody = '\uFEFF{"id":"evt_bom","type":"subscription.updated"}';

    const response = await receiveBillingWebhook(webhookRequest(rawBody, signed(rawBody)));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid billing webhook' });
  });

  it('rejects a validly signed event without a durable provider event identity', async () => {
    process.env.NODE_ENV = 'test';
    process.env.BILLING_WEBHOOK_SECRET = TEST_SECRET;
    const rawBody = JSON.stringify({ type: 'invoice.payment_failed' });

    await expect(new MockBillingProvider().verifyAndParseWebhook(rawBody, signed(rawBody)))
      .rejects.toBeInstanceOf(BillingWebhookInputError);
  });

  it('rejects statuses, plan IDs, and billing periods outside the normalized contract', async () => {
    process.env.NODE_ENV = 'test';
    process.env.BILLING_WEBHOOK_SECRET = TEST_SECRET;
    const invalidEvents = [
      { id: 'evt_bad_status', type: 'customer.subscription.updated', status: 'enabled' },
      { id: 'evt_bad_plan', type: 'customer.subscription.updated', plan_id: 'unreviewed-price' },
      { id: 'evt_bad_period', type: 'customer.subscription.updated', period_start: 'not-a-date' },
      { id: 'evt_reversed_period', type: 'customer.subscription.updated', period_start: '2026-02-01T00:00:00.000Z', period_end: '2026-01-01T00:00:00.000Z' },
      { id: 'evt_empty_period', type: 'customer.subscription.updated', period_start: '2026-01-01T00:00:00.000Z', period_end: '2026-01-01T00:00:00.000Z' },
    ];
    const provider = new MockBillingProvider();

    for (const invalidEvent of invalidEvents) {
      const rawBody = JSON.stringify(invalidEvent);
      await expect(provider.verifyAndParseWebhook(rawBody, signed(rawBody)))
        .rejects.toBeInstanceOf(BillingWebhookInputError);
    }
  });

  it('uses a fixed-length digest comparison for HMAC signatures', async () => {
    process.env.NODE_ENV = 'test';
    process.env.BILLING_WEBHOOK_SECRET = TEST_SECRET;
    const rawBody = JSON.stringify({ id: 'evt_test_001', type: 'customer.subscription.updated' });

    await expect(new MockBillingProvider().verifyAndParseWebhook(rawBody, 'f'.repeat(64)))
      .rejects.toBeInstanceOf(BillingWebhookSignatureError);
  });
});
