import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
    LEFT JOIN workspace_members wm ON wm.workspace_id = r.workspace_id
    WHERE (wm.user_id = ? AND r.lifecycle = 'active') OR (a.repository_id IS NULL AND a.user_id = ?)
    ORDER BY a.created_at DESC
    LIMIT 50
  `, [user.id, user.id]);

  return NextResponse.json({ activities });
}
