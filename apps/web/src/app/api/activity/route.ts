import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { organizationErrorResponse, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const db = getDatabase();
    const activities = await db.query(`
      SELECT
        a.id,
        a.type,
        a.title,
        a.description,
        a.created_at,
        a.created_at as timestamp,
        r.name as repository,
        r.name as repo_name,
        r.full_name as repo_full_name
      FROM activity_events a
      LEFT JOIN repositories r ON r.id = a.repository_id
      WHERE (r.workspace_id = ? AND r.lifecycle = 'active') OR (a.repository_id IS NULL AND a.user_id = ?)
      ORDER BY a.created_at DESC
      LIMIT 50
    `, [workspace.id, user.id]);

    return NextResponse.json({ activities });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}
