import { NextResponse } from 'next/server';
import { acceptSlackAction } from '@/lib/server/slack-interactions.js';
import { verifySlackRequestSignature } from '@/lib/server/slack-security.js';

const MAX_BODY_BYTES = 64 * 1024;

function ack(text: string) {
  return NextResponse.json({ response_type: 'ephemeral', text }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}

async function readBoundedBody(req: Request): Promise<string | null> {
  const reader = req.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(body);
}

export async function POST(req: Request) {
  const contentType = req.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().startsWith('application/x-www-form-urlencoded')) return ack('Unsupported Slack request format.');
  let rawBody: string;
  try {
    const bounded = await readBoundedBody(req);
    if (bounded === null) return ack('Slack request was too large.');
    rawBody = bounded;
  } catch {
    return ack('Slack request encoding is invalid.');
  }
  const timestamp = req.headers.get('x-slack-request-timestamp');
  const signature = req.headers.get('x-slack-signature');
  if (!verifySlackRequestSignature({ rawBody, timestamp, signature })) {
    return NextResponse.json({ error: 'Invalid Slack signature.' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }
  const form = new URLSearchParams(rawBody);
  const payloadText = form.get('payload');
  if (!payloadText || payloadText.length > MAX_BODY_BYTES) return ack('Invalid Slack interaction payload.');
  let payload: unknown;
  try { payload = JSON.parse(payloadText); } catch { return ack('Invalid Slack interaction payload.'); }
  if (!payload || typeof payload !== 'object') return ack('Invalid Slack interaction payload.');
  const value = payload as Record<string, unknown>;
  const team = value.team && typeof value.team === 'object' ? value.team as Record<string, unknown> : null;
  const user = value.user && typeof value.user === 'object' ? value.user as Record<string, unknown> : null;
  const actions = Array.isArray(value.actions) ? value.actions : [];
  if (value.type !== 'block_actions' || typeof team?.id !== 'string' || typeof user?.id !== 'string' || actions.length !== 1) {
    return ack('Unsupported Slack interaction.');
  }
  const selected = actions[0] as Record<string, unknown>;
  if (typeof selected.action_id !== 'string' || typeof selected.value !== 'string') return ack('Invalid Slack action.');
  const requestHash = await cryptoHash(`${timestamp}:${signature}`);
  try {
    const result = await acceptSlackAction({ requestHash, actionId: selected.action_id, actionValue: selected.value, teamId: team.id, slackUserId: user.id });
    return ack(result.text);
  } catch {
    // Never reflect provider payloads, signatures, state tokens, or internal errors to Slack.
    return ack('MY OWL could not process this action safely. No repository changes were made.');
  }
}

async function cryptoHash(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
