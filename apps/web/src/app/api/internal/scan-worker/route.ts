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

// ---------------------------------------------------------------------------
// Authorization helper
// ---------------------------------------------------------------------------

async function isAuthorized(request: NextRequest): Promise<boolean> {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.trim().length === 0) {
    // No secret configured → always reject to prevent accidental open access
    return false;
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader) {
    return false;
  }

  if (!authHeader.startsWith('Bearer ')) {
    return false;
  }

  const providedSecret = authHeader.slice('Bearer '.length);

  // Timing-safe comparison to prevent timing attacks
  if (providedSecret.length !== cronSecret.length) {
    return false;
  }

  try {
    const { timingSafeEqual } = await import('node:crypto');
    return timingSafeEqual(
      Buffer.from(providedSecret, 'utf8'),
      Buffer.from(cronSecret, 'utf8')
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(request))) {
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[scan-worker-route] Unhandled error:', error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

// Reject non-POST methods
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}
