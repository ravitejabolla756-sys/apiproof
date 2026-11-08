import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { enqueueNightlyRescans, processRepositoryRescans } from '../../../../lib/server/repository-rescan-worker.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/, '');
  if (!secret || !provided || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
  try {
    const scheduled = await enqueueNightlyRescans();
    const processed = await processRepositoryRescans();
    return NextResponse.json({ ok: true, scheduled, processed }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: 'SCHEDULED_RESCAN_FAILED' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return GET(request);
}

