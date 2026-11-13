import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspace;
  try {
    workspace = await resolveWorkspaceForRequest(req, user.id);
  } catch (error) {
    return organizationErrorResponse(error);
  }

  try {
    const db = getDatabase();
    const pullRequests = await db.query(`
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
    `, [user.id, workspace.id]);

    return NextResponse.json({ pullRequests }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch {
    return NextResponse.json(
      { error: 'Pull requests are temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
