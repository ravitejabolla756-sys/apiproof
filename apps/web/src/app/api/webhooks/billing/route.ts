import { NextResponse } from 'next/server';
import {
  getBillingProvider,
  BillingProviderUnavailableError,
  BillingWebhookInputError,
  BillingWebhookSignatureError,
} from '../../../../lib/server/billing/provider.js';
import { processBillingWebhookEvent } from '../../../../lib/server/billing/service.js';

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
    });
  } catch (err: unknown) {
    if (err instanceof BillingWebhookSignatureError) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
    if (err instanceof BillingWebhookInputError) {
      return NextResponse.json({ error: 'Invalid billing webhook' }, { status: 400 });
    }
    if (err instanceof BillingProviderUnavailableError) {
      return NextResponse.json({ error: 'Billing webhook processing is unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Billing webhook processing failed' }, { status: 500 });
  }
}
