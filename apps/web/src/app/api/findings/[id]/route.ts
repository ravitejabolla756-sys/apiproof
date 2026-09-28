import { NextResponse } from 'next/server';
import { formatCanonicalMigrationBranch } from '@apiproof/core';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { requireFindingAccess } from '@/lib/server/workspace-service';

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
    SELECT m.*, pr.number as pr_number, pr.url as pr_url, pr.branch_name, pr.state as pr_state
    FROM migrations m
    LEFT JOIN pull_requests pr ON pr.migration_id = m.id
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
    },
    migration: migration ? {
      ...migration,
      target_branch: canonicalBranch,
      branch_name: canonicalBranch,
      plan: planJson,
    } : null,
  });
}
