import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import {
  verifyWebhookSignature,
  isDeliveryProcessed,
  processGitHubWebhook,
} from '@/lib/server/github-webhooks';

export async function POST(req: Request) {
  // 1. Read raw body as string BEFORE parsing JSON
  let rawBody: string;
  try {
    rawBody = await req.text();
  } catch {
    return NextResponse.json({ error: 'Unable to read request payload' }, { status: 400 });
  }

  // 2. Maximum payload size protection (10MB)
  if (rawBody.length > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 });
  }

  // 3. Read GitHub webhook headers
  const signatureHeader = req.headers.get('x-hub-signature-256');
  const event = req.headers.get('x-github-event') || 'unknown';
  const deliveryId = req.headers.get('x-github-delivery') || `gen_${crypto.randomBytes(12).toString('hex')}`;

  // 4. Verify HMAC-SHA256 signature against raw body
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!webhookSecret) {
    // Fail closed: Do not accept unsigned webhooks if secret is missing
    return NextResponse.json({
      error: 'GitHub webhook secret is not configured on the server',
    }, { status: 401 });
  }

  const isValidSignature = verifyWebhookSignature(rawBody, signatureHeader, webhookSecret);
  if (!isValidSignature) {
    return NextResponse.json({
      error: 'Invalid or missing X-Hub-Signature-256',
    }, { status: 401 });
  }

  // 5. Replay Protection: Check if delivery was already processed
  try {
    const alreadyProcessed = await isDeliveryProcessed(deliveryId);
    if (alreadyProcessed) {
      return NextResponse.json({
        received: true,
        replayed: true,
        deliveryId,
      }, { status: 200 });
    }

    // 6. Process the webhook event
    const result = await processGitHubWebhook({
      event,
      deliveryId,
      rawBody,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err: unknown) {
    // Safe error handling without logging sensitive payload or secrets
    const errorMessage = err instanceof Error ? err.message : 'Internal webhook processing error';
    return NextResponse.json({
      error: 'WEBHOOK_PROCESSING_FAILED',
      message: errorMessage,
    }, { status: 500 });
  }
}
