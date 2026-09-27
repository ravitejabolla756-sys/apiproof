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

  // Find by ID or by full_name or name for slug-based lookup (e.g. apiproof-github-fixture)
  const repo = await db.queryOne<{
    id: string;
    owner: string;
    name: string;
    full_name: string;
    github_repository_id: string;
    default_branch: string;
    status: string;
    last_scan_at: string | null;
    created_at: string;
  }>(`
    SELECT r.*
    FROM repositories r
    WHERE (r.id = ? OR r.name = ? OR r.full_name = ?) AND r.user_id = ?
  `, [id, id, id, user.id]);

  if (!repo) {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  const findings = await db.query(`
    SELECT f.id, f.change_id, f.provider, f.title, f.description, f.severity, f.confidence,
           f.file_path, f.line_number, f.symbol, f.status, f.created_at
    FROM findings f
    WHERE f.repository_id = ?
    ORDER BY CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, f.line_number ASC
  `, [repo.id]);

  const scans = await db.query(`
    SELECT s.id, s.sha, s.status, s.provider, s.files_analyzed, s.findings_count, s.started_at, s.completed_at
    FROM scans s
    WHERE s.repository_id = ?
    ORDER BY s.started_at DESC
    LIMIT 10
  `, [repo.id]);

  return NextResponse.json({
    repository: repo,
    findings,
    scans,
  });
}
