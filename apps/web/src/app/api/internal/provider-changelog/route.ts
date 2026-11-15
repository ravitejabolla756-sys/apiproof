import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getProviderChangeSource, refreshAllProviderChangelogs, refreshProviderChangelog } from '../../../../lib/server/provider-change-monitor.js';
import { processRepositoryRescans } from '../../../../lib/server/repository-rescan-worker.js';
import { PRIVATE_NO_STORE_HEADERS } from '../../../../lib/server/organization-route.js';
import { verifyInternalWorkerRequest } from '../../../../lib/server/worker-auth.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: NextRequest): boolean {
  return verifyInternalWorkerRequest(request);
}

async function run(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  let providerId: string | undefined;
  try {
    const body = (await request.json()) as { providerId?: unknown };
    if (typeof body.providerId === 'string') providerId = body.providerId;
  } catch {
    // GET and empty POST requests refresh the full catalog.
  }
  if (providerId && !getProviderChangeSource(providerId)) return NextResponse.json({ error: 'Unknown provider source.', code: 'UNKNOWN_PROVIDER_SOURCE' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
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
    }, { status: failed.length > 0 ? 207 : 200, headers: PRIVATE_NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: 'Provider change refresh is temporarily unavailable.', code: 'PROVIDER_CHANGE_REFRESH_FAILED' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return run(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return run(request);
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: { ...PRIVATE_NO_STORE_HEADERS, Allow: 'GET, POST' } });
}
