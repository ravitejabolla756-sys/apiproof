import { NextResponse } from 'next/server';
import {
  getBillingProvider,
  BillingProviderUnavailableError,
  BillingWebhookInputError,
  BillingWebhookSignatureError,
  MAX_BILLING_WEBHOOK_BYTES,
} from '../../../../lib/server/billing/provider.js';
import { BillingWebhookIdentityConflictError, processBillingWebhookEvent } from '../../../../lib/server/billing/service.js';

async function readBoundedRawBody(req: Request): Promise<string> {
  const contentLength = req.headers.get('content-length');
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new BillingWebhookInputError();
    const declaredBytes = Number(contentLength);
    if (!Number.isSafeInteger(declaredBytes) || declaredBytes > MAX_BILLING_WEBHOOK_BYTES) {
      throw new BillingWebhookInputError();
    }
  }

  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_BILLING_WEBHOOK_BYTES) {
        try { await reader.cancel(); } catch { /* the body is rejected regardless */ }
        throw new BillingWebhookInputError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new BillingWebhookInputError();
  }
}

export async function POST(req: Request) {
  try {
    const rawBody = await readBoundedRawBody(req);
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
    if (err instanceof BillingWebhookIdentityConflictError) {
      return NextResponse.json({ error: 'Billing webhook event identity conflict' }, { status: 409 });
    }
    if (err instanceof BillingProviderUnavailableError) {
      return NextResponse.json({ error: 'Billing webhook processing is unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Billing webhook processing failed' }, { status: 500 });
  }
}
