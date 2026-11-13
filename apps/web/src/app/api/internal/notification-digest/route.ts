import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DigestSchedulingUnavailableError, planDueDigestDispatch, readApprovedDigestSchedule } from '../../../../lib/server/digest-scheduler.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/, '');
  if (!secret || !provided || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}

/**
 * Plans digest recipients only. Delivery remains a separate approved worker
 * that must claim the existing channel ledgers before sending anything.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const schedule = readApprovedDigestSchedule();
  if (!schedule) return NextResponse.json({ ok: false, error: 'Digest scheduling is unavailable until an approved schedule is configured.', code: 'DIGEST_SCHEDULING_UNAVAILABLE' }, { status: 503 });
  try {
    const dispatches = await planDueDigestDispatch(new Date(), schedule);
    return NextResponse.json({ ok: true, planned: dispatches.length, dispatches }, { status: 200 });
  } catch (error) {
    if (error instanceof DigestSchedulingUnavailableError) {
      return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: 'DIGEST_SCHEDULING_FAILED', code: 'DIGEST_SCHEDULING_FAILED' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, POST' } });
}
