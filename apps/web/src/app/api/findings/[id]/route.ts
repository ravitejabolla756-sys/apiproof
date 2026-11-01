import { NextResponse } from 'next/server';
import { formatCanonicalMigrationBranch } from '@apiproof/core';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { requireFindingAccess } from '@/lib/server/workspace-service';
import { getMigrationLifecycleState } from '@/lib/server/migration-lifecycle';
import { parseBoundedProductizationProjection } from '@/lib/server/productization-persistence';
import { resolveFindingCapability } from '@/lib/server/finding-capability';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let finding;
  let repository;
  try {
    const access = await requireFindingAccess(id, user.id);
    finding = access.finding;
    repository = access.repository;
  } catch {
    return NextResponse.json({ error: 'Finding not found or access denied.' }, { status: 404 });
  }

  const db = getDatabase();

  const scan = await db.queryOne<{ raw_result: string | null }>(
    `SELECT raw_result FROM scans WHERE id = ? AND repository_id = ? AND status = 'completed' LIMIT 1`,
    [finding.scan_id, repository.id],
  );
  const productization = parseBoundedProductizationProjection((() => {
    try { return scan?.raw_result ? JSON.parse(scan.raw_result) : null; } catch { return null; }
  })());
  const capability = resolveFindingCapability(productization, {
    provider: finding.provider,
    changeId: finding.change_id,
    filePath: finding.file_path,
    lineNumber: finding.line_number,
    symbol: finding.symbol,
  });

  // Parse stored JSON
  let evidence: unknown[];
  try {
    evidence = JSON.parse(finding.evidence);
  } catch {
    evidence = [];
  }

  let reasonCodes: string[];
  try {
    reasonCodes = JSON.parse(finding.reason_codes);
  } catch {
    reasonCodes = [];
  }

  interface MigrationRow {
    id: string;
    plan_json: string;
    [key: string]: unknown;
  }

  // Check if a migration plan exists for this finding
  const migration = await db.queryOne<MigrationRow>(`
    SELECT m.*, pr.number as pr_number, pr.url as pr_url, pr.branch_name, pr.state as pr_state,
      vj.id AS verification_job_id, vj.status AS verification_job_status
    FROM migrations m
    LEFT JOIN pull_requests pr ON pr.migration_id = m.id
    LEFT JOIN migration_verification_jobs vj ON vj.migration_id = m.id
    WHERE m.finding_id = ?
    ORDER BY m.created_at DESC
    LIMIT 1
  `, [finding.id]);

  let planJson: unknown = null;
  if (migration?.plan_json) {
    try {
      planJson = JSON.parse(migration.plan_json);
    } catch {
      planJson = null;
    }
  }

  const canonicalBranch = migration
    ? (typeof migration.branch_name === 'string' && migration.branch_name.length > 0 ? migration.branch_name : formatCanonicalMigrationBranch(finding.change_id, String(migration.id)))
    : null;

  return NextResponse.json({
    finding: {
      ...finding,
      repo_name: repository.name,
      repo_full_name: repository.full_name,
      repo_owner: repository.owner,
      default_branch: repository.default_branch,
      evidence,
      reasonCodes,
      capability,
    },
    migration: migration ? {
      ...migration,
      lifecycle_state: getMigrationLifecycleState({
        status: typeof migration.status === 'string' ? migration.status : null,
        verificationJobStatus: typeof migration.verification_job_status === 'string' ? migration.verification_job_status : null,
        verificationReport: typeof migration.verification_report === 'string' ? migration.verification_report : null,
        hasPullRequest: migration.pr_number !== null && migration.pr_number !== undefined,
        pullRequestState: typeof migration.pr_state === 'string' ? migration.pr_state : null,
      }),
      target_branch: canonicalBranch,
      branch_name: canonicalBranch,
      plan: planJson,
    } : null,
  }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
