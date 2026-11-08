import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getProviderChangeSource, refreshAllProviderChangelogs, refreshProviderChangelog } from '../../../../lib/server/provider-change-monitor.js';
import { processRepositoryRescans } from '../../../../lib/server/repository-rescan-worker.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/, '');
  if (!secret || !provided || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}

async function run(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
  let providerId: string | undefined;
  try {
    const body = (await request.json()) as { providerId?: unknown };
    if (typeof body.providerId === 'string') providerId = body.providerId;
  } catch {
    // GET and empty POST requests refresh the full catalog.
  }
  if (providerId && !getProviderChangeSource(providerId)) return NextResponse.json({ error: 'UNKNOWN_PROVIDER_SOURCE' }, { status: 400, headers: NO_STORE_HEADERS });
  try {
    const results = providerId ? [await refreshProviderChangelog(providerId)] : await refreshAllProviderChangelogs();
    const failed = results.filter((result) => result.status === 'failed');
    const rescanProcessing = await processRepositoryRescans({ includeScheduled: false, batchSize: 10 });
    return NextResponse.json({
      ok: failed.length === 0,
      results,
      attempted: results.filter((result) => result.status !== 'skipped').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      changed: results.filter((result) => result.status === 'changed').length,
      failed: failed.length,
      rescanProcessing,
    }, { status: failed.length > 0 ? 207 : 200, headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: 'PROVIDER_CHANGE_REFRESH_FAILED' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return run(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return run(request);
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { ...NO_STORE_HEADERS, Allow: 'GET, POST' } });
}
