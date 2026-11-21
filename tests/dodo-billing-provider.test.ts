import crypto from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { DodoBillingProvider, BillingProviderUnavailableError } from '../apps/web/src/lib/server/billing/provider.js';

function sign(secret: string, id: string, timestamp: string, body: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return `v1,${crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
}

function env(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'development',
    DODO_PAYMENTS_API_KEY: 'test-key',
    DODO_PAYMENTS_ENVIRONMENT: 'test_mode',
    DODO_PRODUCT_PRO_ID: 'pdt_developer_test',
    DODO_PRODUCT_TEAM_ID: 'pdt_startup_test',
    ...overrides,
  };
}

describe('Dodo test-mode billing adapter', () => {
  it('requires API credentials and both server-owned product mappings', () => {
    expect(() => new DodoBillingProvider(env({ DODO_PAYMENTS_API_KEY: '' }))).toThrow(BillingProviderUnavailableError);
    expect(() => new DodoBillingProvider(env({ DODO_PRODUCT_TEAM_ID: '' }))).toThrow(BillingProviderUnavailableError);
  });

  it('creates a server-mapped checkout session without accepting a client product id', async () => {
    let request: { url: string; body: string } | undefined;
    const provider = new DodoBillingProvider(env(), async (input, init) => {
      request = { url: String(input), body: String(init?.body) };
      return new Response(JSON.stringify({ checkout_url: 'https://test.dodopayments.com/checkout/one-time' }), { status: 200 });
    });
    const result = await provider.createCheckoutSession('ws_123', 'cus_123', 'pro', 'https://myowl.test/dashboard/settings');
    expect(result.checkoutUrl).toContain('test.dodopayments.com');
    expect(request?.url).toBe('https://test.dodopayments.com/checkouts');
    expect(JSON.parse(request?.body ?? '{}')).toMatchObject({
      product_cart: [{ product_id: 'pdt_developer_test', quantity: 1 }],
      customer: { customer_id: 'cus_123' },
      metadata: { workspace_id: 'ws_123', plan_id: 'pro' },
    });
  });

  it('verifies raw Standard Webhooks content and normalizes a Dodo subscription event', async () => {
    const secret = 'whsec_test-webhook-secret';
    const provider = new DodoBillingProvider(env(), async () => new Response('{}', { status: 200 }));
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = JSON.stringify({
      id: 'evt_dodo_123',
      type: 'subscription.active',
      data: { customer: { customer_id: 'cus_123' }, subscription_id: 'sub_123', status: 'active', next_billing_date: '2027-01-01T00:00:00.000Z' },
    });
    const headers = { 'webhook-id': 'msg_123', 'webhook-timestamp': timestamp, 'webhook-signature': sign(secret, 'msg_123', timestamp, body) };
    process.env.DODO_PAYMENTS_WEBHOOK_KEY = secret;
    try {
      await expect(provider.verifyAndParseWebhook(body, headers)).resolves.toMatchObject({
        id: 'evt_dodo_123', provider: 'dodo', eventType: 'customer.subscription.updated', customerId: 'cus_123', subscriptionId: 'sub_123', status: 'active',
      });
      await expect(provider.verifyAndParseWebhook(`${body} `, headers)).rejects.toThrow('INVALID_BILLING_SIGNATURE');
    } finally {
      delete process.env.DODO_PAYMENTS_WEBHOOK_KEY;
    }
  });
});
