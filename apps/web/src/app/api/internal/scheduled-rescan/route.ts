import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { enqueueNightlyRescans, processRepositoryRescans } from '../../../../lib/server/repository-rescan-worker.js';
import { tryFinishWorkerRun, tryStartWorkerRun } from '../../../../lib/server/worker-observability.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/, '');
  if (!secret || !provided || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}

export async function GET(request: Request): Promise<NextResponse> {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let heartbeatId: string | undefined;
  try {
    heartbeatId = await tryStartWorkerRun('nightly-rescan-scheduler');
    const scheduled = await enqueueNightlyRescans();
    const processed = await processRepositoryRescans();
    await tryFinishWorkerRun('nightly-rescan-scheduler', heartbeatId,
      processed.jobsFailed > 0 ? 'degraded' : 'succeeded',
      processed.jobsFailed > 0 ? 'SCHEDULED_WORK_DEGRADED' : null);
    return NextResponse.json({ ok: true, scheduled, processed });
  } catch {
    await tryFinishWorkerRun('nightly-rescan-scheduler', heartbeatId, 'failed', 'SCHEDULED_RESCAN_FAILED');
    return NextResponse.json({ ok: false, error: 'SCHEDULED_RESCAN_FAILED' }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  return GET(request);
}

