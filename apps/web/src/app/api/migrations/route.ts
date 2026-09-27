import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDatabase();
  const migrations = await db.query(`
    SELECT m.id, m.finding_id, m.repository_id, m.plan_id, m.status, m.patch_diff, m.patch_digest, m.created_at,
           f.title as finding_title, f.symbol, f.file_path, f.line_number, f.change_id,
           r.name as repo_name, r.full_name as repo_full_name,
           pr.number as pr_number, pr.url as pr_url, pr.branch_name, pr.state as pr_state
    FROM migrations m
    JOIN findings f ON f.id = m.finding_id
    JOIN repositories r ON r.id = m.repository_id
    LEFT JOIN pull_requests pr ON pr.migration_id = m.id
    WHERE r.user_id = ?
    ORDER BY m.created_at DESC
  `, [user.id]);

  return NextResponse.json({ migrations });
}
