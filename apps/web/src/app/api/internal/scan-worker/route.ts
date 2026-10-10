/**
 * Internal scan-worker trigger endpoint.
 *
 * This route is intended for:
 *   - Vercel Cron Jobs (configured in vercel.json)
 *   - Internal health/test invocations
 *
 * Security model:
 *   - Requires CRON_SECRET header: "Authorization: Bearer <CRON_SECRET>"
 *   - CRON_SECRET must be set in production; without it the endpoint always 401s.
 *   - This route is NOT meant to be exposed publicly.
 *
 * The route is idempotent: if there are no pending jobs, it returns immediately.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { processPendingGitHubScans, getScanWorkerMetrics } from '../../../../lib/server/scan-worker.js';
import { isAuthorizedInternalRequest } from '../../../../lib/server/internal-auth.js';
import { logger } from '../../../../lib/server/logger.js';

// ---------------------------------------------------------------------------
// Authorization helper
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function runWorker(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorizedInternalRequest(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let batchSize: number | undefined;
  let timeoutMs: number | undefined;
  let metricsOnly = false;

  try {
    const body = (await request.json()) as { batchSize?: unknown; timeoutMs?: unknown; metricsOnly?: unknown };
    if (typeof body.batchSize === 'number') batchSize = body.batchSize;
    if (typeof body.timeoutMs === 'number') timeoutMs = body.timeoutMs;
    if (typeof body.metricsOnly === 'boolean') metricsOnly = body.metricsOnly;
  } catch {
    // No body or invalid JSON — use defaults
  }

  try {
    if (metricsOnly) {
      const metrics = await getScanWorkerMetrics();
      return NextResponse.json({ ok: true, metrics });
    }

    const result = await processPendingGitHubScans({ batchSize, timeoutMs });
    const metrics = await getScanWorkerMetrics();

    return NextResponse.json({
      ok: true,
      jobsClaimed: result.jobsClaimed,
      jobsCompleted: result.jobsCompleted,
      jobsFailed: result.jobsFailed,
      jobsSkipped: result.jobsSkipped,
      timedOut: result.timedOut,
      metrics,
      results: result.results,
    });
  } catch (error) {
    logger.error('scan_worker_route_failed', undefined, error);
    return NextResponse.json({ ok: false, error: 'SCAN_WORKER_FAILED' }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runWorker(request);
}

// Vercel Cron invokes configured cron paths with GET. Keep the same auth and
// execution contract so scheduled production scans cannot silently 405.
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Keep direct/unit callers that do not provide an HTTP request fail-closed.
  if (!request) return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  return runWorker(request);
}

export async function DELETE(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { Allow: 'GET, POST' } });
}
