import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { enqueueNightlyRescans, processRepositoryRescans } from '../../../../lib/server/repository-rescan-worker.js';
import { PRIVATE_NO_STORE_HEADERS } from '../../../../lib/server/organization-route.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/, '');
  if (!secret || !provided || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  try {
    const scheduled = await enqueueNightlyRescans();
    const processed = await processRepositoryRescans();
    return NextResponse.json({ ok: true, scheduled, processed }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: 'Scheduled rescans are temporarily unavailable.', code: 'SCHEDULED_RESCAN_FAILED' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return GET(request);
}

