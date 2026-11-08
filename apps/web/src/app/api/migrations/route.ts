import { NextResponse } from 'next/server';
import { formatCanonicalMigrationBranch } from '@apiproof/core';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db.js';
import { getMigrationLifecycleState, hasExecutionVerifiedMigrationEvidence } from '@/lib/server/migration-lifecycle.js';
import { organizationErrorResponse, PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const db = getDatabase();
    const migrations = await db.query(`
      SELECT m.id, m.finding_id, m.repository_id, m.plan_id, m.status, m.patch_diff, m.patch_digest, m.verification_report, m.created_at,
             f.title as finding_title, f.symbol, f.file_path, f.line_number, f.change_id,
             r.name as repo_name, r.full_name as repo_full_name,
             pr.number as pr_number, pr.url as pr_url, pr.branch_name, pr.state as pr_state
      FROM migrations m
      JOIN findings f ON f.id = m.finding_id
      JOIN repositories r ON r.id = m.repository_id
      LEFT JOIN pull_requests pr ON pr.migration_id = m.id
      WHERE r.workspace_id = ? AND r.lifecycle = 'active'
      ORDER BY m.created_at DESC
    `, [workspace.id]);

    const mapped = (migrations as Array<Record<string, unknown>>).map((m) => ({
      ...m,
      execution_verified: hasExecutionVerifiedMigrationEvidence(m.verification_report),
      lifecycle_state: getMigrationLifecycleState({
        status: typeof m.status === 'string' ? m.status : null,
        verificationReport: typeof m.verification_report === 'string' ? m.verification_report : null,
        hasPullRequest: typeof m.pr_number === 'number' || typeof m.pr_number === 'string',
        pullRequestState: typeof m.pr_state === 'string' ? m.pr_state : null,
      }),
      target_branch: typeof m.branch_name === 'string' && m.branch_name.length > 0
        ? m.branch_name
        : formatCanonicalMigrationBranch(String(m.change_id), String(m.id)),
    }));

    return NextResponse.json({ migrations: mapped }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}
