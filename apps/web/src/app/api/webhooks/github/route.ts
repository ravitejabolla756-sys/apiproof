import { NextResponse } from 'next/server';
import {
  verifyWebhookSignature,
  claimWebhookDelivery,
  recordWebhookDelivery,
  processGitHubWebhook,
} from '@/lib/server/github-webhooks';

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

export async function POST(req: Request) {
  // 1. Read raw body as string BEFORE parsing JSON
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request payload' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // 2. Maximum payload size protection (10MB)
  if (rawBody.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413, headers: NO_STORE_HEADERS });
  }

  // 3. Read GitHub webhook headers
  const signatureHeader = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event') || 'unknown';
  const deliveryId = req.headers.get('x-github-delivery');
  if (!deliveryId) {
    return NextResponse.json({ error: 'Missing GitHub delivery ID' }, { status: 400, headers: NO_STORE_HEADERS });
  }

  // 4. Verify HMAC-SHA256 signature against raw body
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Fail closed: Do not accept unsigned webhooks if secret is missing
    return NextResponse.json({
      error: 'GitHub webhook secret is not configured on the server',
    }, { status: 401, headers: NO_STORE_HEADERS });
  }

  const isValidSignature = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
  if (!isValidSignature) {
    return NextResponse.json({
      error: 'Invalid or missing X-Hub-Signature-256',
    }, { status: 401, headers: NO_STORE_HEADERS });
  }

  // 5. Replay Protection: Check if delivery was already processed
  try {
    const claimed = await claimWebhookDelivery(deliveryId, event, new Date().toISOString());
    if (!claimed) {
      return NextResponse.json({
        received: true,
        replayed: true,
        deliveryId,
      }, { status: 200, headers: NO_STORE_HEADERS });
    }

    // 6. Process the webhook event
    const result = await processGitHubWebhook({
      event,
      deliveryId,
      rawBody,
    });

    return NextResponse.json(result, { status: 200, headers: NO_STORE_HEADERS });
  } catch {
    // Safe error handling without logging sensitive payload or secrets
    try {
      await recordWebhookDelivery(deliveryId, event, 'failed', new Date().toISOString(), 'Webhook processing exception');
    } catch {
      // Preserve the original response; reconciliation can inspect the processing row.
    }
    return NextResponse.json({
      error: 'WEBHOOK_PROCESSING_FAILED',
      message: 'Webhook processing failed; delivery will be reconciled from its durable record.',
    }, { status: 500, headers: NO_STORE_HEADERS });
  }
}
