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
import { classifyScanWorkerHealth } from '../../../../lib/server/scan-worker-metrics.js';
import { isLiveScanProtectionEnabled } from '../../../../lib/server/founder-scan-authorization.js';
import { safeFailureCode } from '../../../../lib/server/productization-persistence.js';
import { PRIVATE_NO_STORE_HEADERS } from '../../../../lib/server/organization-route.js';
import { parseScanWorkerRequest } from '../../../../lib/server/scan-worker-request-contract.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

async function runWorker(request: NextRequest): Promise<NextResponse> {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  let options: { batchSize?: number; timeoutMs?: number; metricsOnly?: boolean; repositoryId?: string } = {};
  try {
    const parsed = parseScanWorkerRequest(await request.json());
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: 'Invalid scan worker request.', code: parsed.code }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
    }
    options = parsed.value;
  } catch {
    // No body or invalid JSON — use defaults
  }

  try {
    const { batchSize, timeoutMs, metricsOnly = false, repositoryId } = options;
    if (metricsOnly) {
      const metrics = await getScanWorkerMetrics();
      return NextResponse.json({ ok: true, health: classifyScanWorkerHealth(metrics), metrics }, { headers: PRIVATE_NO_STORE_HEADERS });
    }

    // A live/manual worker call must be narrowed to one repository. This also
    // makes Vercel Cron fail closed until a separately approved scoped trigger
    // exists, so a secret cannot drain unrelated tenant jobs.
    if (isLiveScanProtectionEnabled() && !repositoryId) {
      return NextResponse.json({ ok: false, error: 'REPOSITORY_SCOPE_REQUIRED', code: 'REPOSITORY_SCOPE_REQUIRED' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
    }

    const result = await processPendingGitHubScans({ batchSize, timeoutMs, repositoryId });
    const metrics = await getScanWorkerMetrics();

    return NextResponse.json({
      ok: true,
      health: classifyScanWorkerHealth(metrics),
      jobsClaimed: result.jobsClaimed,
      jobsCompleted: result.jobsCompleted,
      jobsFailed: result.jobsFailed,
      jobsSkipped: result.jobsSkipped,
      timedOut: result.timedOut,
      metrics,
      results: result.results,
    }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    console.error('[scan-worker-route] Unhandled error', { code: safeFailureCode(error, 'SCAN_WORKER_FAILED') });
    return NextResponse.json({ ok: false, error: 'Scan worker is temporarily unavailable.', code: 'SCAN_WORKER_FAILED' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return runWorker(request);
}

// Vercel Cron invokes configured cron paths with GET. Keep the same auth and
// execution contract so scheduled production scans cannot silently 405.
export async function GET(request: NextRequest): Promise<NextResponse> {
  // Keep direct/unit callers that do not provide an HTTP request fail-closed.
  if (!request) return NextResponse.json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: PRIVATE_NO_STORE_HEADERS });
  return runWorker(request);
}

export async function DELETE(_request: NextRequest): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, { status: 405, headers: { ...PRIVATE_NO_STORE_HEADERS, Allow: 'GET, POST' } });
}
