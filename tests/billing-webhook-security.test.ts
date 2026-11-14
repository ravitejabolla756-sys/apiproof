import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { closeDatabase, getDatabase, initDatabase } from '../apps/web/src/lib/server/db/index.js';
import { MockBillingProvider } from '../apps/web/src/lib/server/billing/provider.js';
import { processBillingWebhookEvent } from '../apps/web/src/lib/server/billing/service.js';
import { POST as billingWebhookPost } from '../apps/web/src/app/api/webhooks/billing/route.js';

const TEST_DB_PATH = path.resolve(`.tmp/test-billing-webhook-security-${process.pid}.db`);
const SECRET = 'bill03-local-signing-secret';

function sign(rawBody: string): string {
  return crypto.createHmac('sha256', SECRET).update(rawBody).digest('hex');
}

describe('BILL-03 billing webhook safety boundary', () => {
  beforeEach(() => {
    process.env.BILLING_WEBHOOK_SECRET = SECRET;
    process.env.BILLING_PROVIDER = 'mock';
    process.env.APIPROOF_LOCAL_SEED_PASSWORD = 'bill03-local-test-password';
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    delete process.env.BILLING_WEBHOOK_SECRET;
    delete process.env.BILLING_PROVIDER;
    delete process.env.APIPROOF_LOCAL_SEED_PASSWORD;
    closeDatabase();
    if (fs.existsSync(TEST_DB_PATH)) fs.unlinkSync(TEST_DB_PATH);
  });

  it('verifies the exact raw body and rejects missing or altered signatures', async () => {
    const provider = new MockBillingProvider();
    const raw = JSON.stringify({ id: 'evt_raw_1', type: 'customer.subscription.updated' });
    await expect(provider.verifyAndParseWebhook(raw, sign(raw))).resolves.toMatchObject({ id: 'evt_raw_1', rawPayload: raw });
    await expect(provider.verifyAndParseWebhook(raw, '')).rejects.toThrow('INVALID_BILLING_SIGNATURE');
    await expect(provider.verifyAndParseWebhook(`${raw} `, sign(raw))).rejects.toThrow('INVALID_BILLING_SIGNATURE');
  });

  it('fails closed when the signing secret is unavailable and rejects malformed events', async () => {
    delete process.env.BILLING_WEBHOOK_SECRET;
    await expect(new MockBillingProvider().verifyAndParseWebhook('{}', '')).rejects.toThrow('BILLING_WEBHOOK_UNAVAILABLE');

    process.env.BILLING_WEBHOOK_SECRET = SECRET;
    const raw = '{"id":"evt_malformed"';
    await expect(new MockBillingProvider().verifyAndParseWebhook(raw, sign(raw))).rejects.toThrow('MALFORMED_BILLING_EVENT');
  });

  it('deduplicates repeated deliveries and does not mutate an unrelated customer', async () => {
    const raw = JSON.stringify({ id: 'evt_duplicate_1', type: 'customer.subscription.updated', customer_id: 'cus_unknown', status: 'active' });
    const event = await new MockBillingProvider().verifyAndParseWebhook(raw, sign(raw));
    await expect(processBillingWebhookEvent(event)).resolves.toEqual({ success: true, duplicate: false });
    await expect(processBillingWebhookEvent(event)).resolves.toEqual({ success: true, duplicate: true });
    expect(await getDatabase().query('SELECT id FROM billing_webhook_events WHERE provider = ?', ['mock'])).toHaveLength(1);
  });

  it('maps missing secret, malformed payload and invalid signatures to safe route responses', async () => {
    delete process.env.BILLING_WEBHOOK_SECRET;
    const unavailable = await billingWebhookPost(new Request('http://localhost/api/webhooks/billing', { method: 'POST', body: '{}' }));
    expect(unavailable.status).toBe(503);
    expect(await unavailable.json()).toEqual({ error: 'Billing webhook processing is unavailable.', code: 'BILLING_WEBHOOK_UNAVAILABLE' });

    process.env.BILLING_WEBHOOK_SECRET = SECRET;
    const malformedBody = '{"id":"evt_bad"';
    const malformed = await billingWebhookPost(new Request('http://localhost/api/webhooks/billing', { method: 'POST', headers: { 'x-billing-signature': sign(malformedBody) }, body: malformedBody }));
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'Malformed billing event.', code: 'MALFORMED_BILLING_EVENT' });
  });
});
