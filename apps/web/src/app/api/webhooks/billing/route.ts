import { NextResponse } from 'next/server';
import { getBillingProvider } from '@/lib/server/billing/provider';
import { processBillingWebhookEvent } from '@/lib/server/billing/service';

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
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('INVALID_BILLING_SIGNATURE')) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Webhook processing failed', details: message }, { status: 400 });
  }
}
