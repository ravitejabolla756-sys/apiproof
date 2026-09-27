import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDatabase();

  interface FindingRow {
    id: string;
    repository_id: string;
    change_id: string;
    evidence: string;
    reason_codes: string;
    [key: string]: unknown;
  }

  const finding = await db.queryOne<FindingRow>(`
    SELECT f.*, r.name as repo_name, r.full_name as repo_full_name, r.owner as repo_owner, r.default_branch
    FROM findings f
    JOIN repositories r ON r.id = f.repository_id
    WHERE (f.id = ? OR f.change_id = ?) AND r.user_id = ?
    LIMIT 1
  `, [id, id, user.id]);

  if (!finding) {
    return NextResponse.json({ error: 'Finding not found or access denied.' }, { status: 404 });
  }

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

  return NextResponse.json({
    finding: {
      ...finding,
      evidence,
      reasonCodes,
    },
    migration: migration ? {
      ...migration,
      plan: planJson,
    } : null,
  });
}
