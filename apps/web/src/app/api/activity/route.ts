import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDatabase();
  const activities = await db.query(`
    SELECT a.id, a.type, a.title, a.description, a.created_at as timestamp, r.name as repository
    FROM activity_events a
    LEFT JOIN repositories r ON r.id = a.repository_id
    WHERE a.user_id = ?
    ORDER BY a.created_at DESC
    LIMIT 50
  `, [user.id]);

  return NextResponse.json({ activities });
}
