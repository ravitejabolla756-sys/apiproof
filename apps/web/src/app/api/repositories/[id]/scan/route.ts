import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { runRepositoryScan } from '@/lib/server/scan-service';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDatabase();
  // Resolve repo ID by ID or slug with user_id tenant enforcement
  const repo = await db.queryOne<{ id: string; full_name: string }>(`
    SELECT id, full_name FROM repositories
    WHERE (id = ? OR name = ? OR full_name = ?) AND user_id = ?
  `, [id, id, id, user.id]);

  if (!repo) {
    return NextResponse.json({ error: 'Repository not found or access denied.' }, { status: 404 });
  }

  try {
    const result = await runRepositoryScan(repo.id, user.id);
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scan failed.';
    console.error('Scan execution error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
