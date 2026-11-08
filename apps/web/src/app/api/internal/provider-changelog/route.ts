import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { isAuthorizedCronRequest } from '../../../../lib/server/cron-authorization.js';
import { getProviderChangeSource, refreshAllProviderChangelogs, refreshProviderChangelog } from '../../../../lib/server/provider-change-monitor.js';
import { processRepositoryRescans } from '../../../../lib/server/repository-rescan-worker.js';
import { tryFinishWorkerRun, tryStartWorkerRun } from '../../../../lib/server/worker-observability.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function run(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedCronRequest(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let providerId: string | undefined;
  try {
    const body = (await request.json()) as { providerId?: unknown };
    if (typeof body.providerId === 'string') providerId = body.providerId;
  } catch {
    // GET and empty POST requests refresh the full catalog.
  }
  if (providerId && !getProviderChangeSource(providerId)) return NextResponse.json({ error: 'UNKNOWN_PROVIDER_SOURCE' }, { status: 400 });
  let heartbeatId: string | undefined;
  try {
    heartbeatId = await tryStartWorkerRun('provider-changelog-scheduler');
    const results = providerId ? [await refreshProviderChangelog(providerId)] : await refreshAllProviderChangelogs();
    const failed = results.filter((result) => result.status === 'failed');
    const rescanProcessing = await processRepositoryRescans({ includeScheduled: false, batchSize: 10 });
    const runStatus = failed.length > 0 || rescanProcessing.jobsFailed > 0 ? 'degraded' : 'succeeded';
    await tryFinishWorkerRun('provider-changelog-scheduler', heartbeatId, runStatus,
      runStatus === 'degraded' ? 'SCHEDULED_WORK_DEGRADED' : null);
    return NextResponse.json({
      ok: failed.length === 0,
      results,
      attempted: results.filter((result) => result.status !== 'skipped').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      changed: results.filter((result) => result.status === 'changed').length,
      failed: failed.length,
      rescanProcessing,
    }, { status: failed.length > 0 ? 207 : 200 });
  } catch {
    await tryFinishWorkerRun('provider-changelog-scheduler', heartbeatId, 'failed', 'PROVIDER_CHANGE_REFRESH_FAILED');
    return NextResponse.json({ ok: false, error: 'PROVIDER_CHANGE_REFRESH_FAILED' }, { status: 500 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return run(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return run(request);
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, POST' } });
}
