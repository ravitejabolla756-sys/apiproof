import { NextResponse } from 'next/server';
import { getBillingProvider } from '@/lib/server/billing/provider';
import { processBillingWebhookEvent } from '@/lib/server/billing/service';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/server/organization-route.js';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature =
      req.headers.get('x-billing-signature') ||
      req.headers.get('stripe-signature') ||
      '';

    const provider = getBillingProvider();
    const event = await provider.verifyAndParseWebhook(rawBody, signature);

    const result = await processBillingWebhookEvent(event);

    return NextResponse.json({
      received: true,
      duplicate: result.duplicate,
      eventId: event.id,
    }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err && typeof err === 'object' && 'code' in err && typeof err.code === 'string' ? err.code : '';
    if (message.includes('INVALID_BILLING_SIGNATURE')) {
      return NextResponse.json({ error: 'Invalid webhook signature', code: 'INVALID_BILLING_SIGNATURE' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('BILLING_WEBHOOK_UNAVAILABLE')) {
      return NextResponse.json({ error: 'Billing webhook processing is unavailable.', code: 'BILLING_WEBHOOK_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('BILLING_PROVIDER_UNAVAILABLE') || code === 'BILLING_PROVIDER_UNAVAILABLE') {
      return NextResponse.json({ error: 'Billing webhook processing is unavailable.', code: 'BILLING_WEBHOOK_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('MALFORMED_BILLING_EVENT')) {
      return NextResponse.json({ error: 'Malformed billing event.', code: 'MALFORMED_BILLING_EVENT' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('INVALID_BILLING_EVENT_IDENTITY')) {
      return NextResponse.json({ error: 'Billing event identity is invalid.', code: 'INVALID_BILLING_EVENT_IDENTITY' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('BILLING_WEBHOOK_ID_CONFLICT')) {
      return NextResponse.json({ error: 'Billing event identity conflicts with a previous delivery.', code: 'BILLING_WEBHOOK_ID_CONFLICT' }, { status: 409, headers: PRIVATE_NO_STORE_HEADERS });
    }
    console.error('Billing webhook processing failed.', { code: 'BILLING_WEBHOOK_PROCESSING_FAILED' });
    return NextResponse.json({ error: 'Webhook processing failed.', code: 'BILLING_WEBHOOK_PROCESSING_FAILED' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
