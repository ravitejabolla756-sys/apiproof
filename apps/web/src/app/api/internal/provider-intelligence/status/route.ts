import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getDatabase } from '../../../../../lib/server/db/index.js';
import { getProviderSourceHealth } from '../../../../../lib/server/provider-source-health.js';
import { workerRuntimeIdentity } from '../../../../../lib/server/provider-intelligence-feature.js';
import { getRuntimeConfiguration } from '../../../../../lib/server/runtime-configuration.js';
import { getScanWorkerMetrics } from '../../../../../lib/server/scan-worker.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' };

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/, '');
  if (!secret || !provided || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided, 'utf8'), Buffer.from(secret, 'utf8'));
}

type CountRow = { count: number | string };

async function countWhere(table: string, where: string): Promise<number> {
  // Table names and predicates are constants owned by this module; no request
  // value is interpolated into these queries.
  const row = await getDatabase().queryOne<CountRow>(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`);
  return Number(row?.count ?? 0);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!isAuthorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE_HEADERS });
  try {
    const [sourceHealth, worker, approvedCandidates, reviewCandidates, pendingProviderRescans, pendingRepositoryRescans, pendingScanRequests] = await Promise.all([
      getProviderSourceHealth(),
      getScanWorkerMetrics(),
      countWhere('provider_rule_candidates', "status = 'approved'"),
      countWhere('provider_rule_candidates', "status = 'needs_review'"),
      countWhere('provider_rescan_jobs', "status IN ('pending', 'processing', 'queued')"),
      countWhere('repository_rescan_jobs', "status IN ('pending', 'processing', 'queued')"),
      countWhere('github_scan_requests', "status IN ('pending', 'processing')"),
    ]);
    return NextResponse.json({
      ok: true,
      runtime: workerRuntimeIdentity(),
      configuration: getRuntimeConfiguration(),
      sources: sourceHealth,
      queues: {
        approvedCandidates,
        reviewCandidates,
        pendingRescans: pendingProviderRescans + pendingRepositoryRescans,
        pendingProviderRescans,
        pendingRepositoryRescans,
        pendingScanRequests,
        worker,
      },
      generatedAt: new Date().toISOString(),
    }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ ok: false, error: 'PROVIDER_INTELLIGENCE_STATUS_FAILED' }, { status: 500, headers: NO_STORE_HEADERS });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return GET(request);
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405, headers: { ...NO_STORE_HEADERS, Allow: 'GET, POST' } });
}
