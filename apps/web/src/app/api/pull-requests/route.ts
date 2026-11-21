import { NextResponse } from 'next/server';
import { extractSessionId, getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { withPostgresTenantContext } from '@/lib/server/db/postgres-tenant-context.js';
import { organizationErrorResponse, PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  let workspace;
  try {
    workspace = await resolveWorkspaceForRequest(req, user.id);
  } catch (error) {
    return organizationErrorResponse(error);
  }

  try {
    const db = getDatabase();
    const pullRequests = await withPostgresTenantContext(db, user.id, workspace.id, (tx) => tx.query(`
      SELECT pr.id, pr.number, pr.title, pr.branch_name, pr.base_branch, pr.url, pr.state, pr.created_at,
             m.patch_digest, m.plan_id,
             r.name as repo_name, r.full_name as repo_full_name,
             f.symbol, f.file_path, f.change_id
      FROM pull_requests pr
      JOIN repositories r ON r.id = pr.repository_id
      JOIN migrations m ON m.id = pr.migration_id
      JOIN findings f ON f.id = m.finding_id
      JOIN workspace_members wm ON wm.workspace_id = r.workspace_id
      WHERE wm.user_id = ? AND r.workspace_id = ? AND r.lifecycle = 'active'
      ORDER BY pr.created_at DESC
    `, [user.id, workspace.id]), extractSessionId(req));

    return NextResponse.json({ pullRequests }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: 'Pull requests are temporarily unavailable.', code: 'PULL_REQUESTS_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}
