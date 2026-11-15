import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { DigestSchedulingUnavailableError, queueDueDigestEmailDispatch, readApprovedDigestSchedule } from '../../../../lib/server/digest-scheduler.js';
import { PRIVATE_NO_STORE_HEADERS } from '../../../../lib/server/organization-route.js';
import { verifyInternalWorkerRequest } from '../../../../lib/server/worker-auth.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  return verifyInternalWorkerRequest(request);
}

/**
 * Queues digest email intents only. Delivery remains a separate approved
 * worker that must claim the existing email ledger before sending anything.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  const schedule = readApprovedDigestSchedule();
  if (!schedule) return NextResponse.json({ ok: false, error: 'Digest scheduling is unavailable until an approved schedule is configured.', code: 'DIGEST_SCHEDULING_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  try {
    const queued = await queueDueDigestEmailDispatch(new Date(), schedule);
    return NextResponse.json({ ok: true, queued: queued.length }, { status: 200, headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof DigestSchedulingUnavailableError) {
      return NextResponse.json({ ok: false, error: 'Digest scheduling is unavailable until the approved schedule is configured.', code: error.code }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
    }
    console.error('Digest scheduling failed:', { code: 'DIGEST_SCHEDULING_FAILED' });
    return NextResponse.json({ ok: false, error: 'Digest scheduling could not be completed.', code: 'DIGEST_SCHEDULING_FAILED' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: { ...PRIVATE_NO_STORE_HEADERS, Allow: 'GET, POST' } });
}
