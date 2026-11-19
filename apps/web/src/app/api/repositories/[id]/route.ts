import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { requireRepositoryAccess } from '@/lib/server/workspace-service.js';

export async function GET(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let repo;
  try {
    const access = await requireRepositoryAccess(id, user.id);
    repo = access.repository;
  } catch {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404 });
  }

  const db = getDatabase();

  // A serverless instance can disappear after a scan has claimed a row but
  // before the completion update. Recover abandoned rows when the repository
  // workbench is opened so the UI never remains in a false infinite-running
  // state. The scan service applies the same guard before starting a retry.
  const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  await db.execute(`
    UPDATE scans
    SET status = 'failed',
        error_message = ?,
        completed_at = ?
    WHERE repository_id = ?
      AND status IN ('pending', 'running')
      AND started_at < ?
  `, [
    'SCAN_TIMEOUT_RECOVERED: previous scan exceeded the execution window.',
    new Date().toISOString(),
    repo.id,
    staleBefore,
  ]);

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

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  let repo;
  try {
    const access = await requireRepositoryAccess(id, user.id);
    repo = access.repository;
  } catch {
    return NextResponse.json({ error: 'Repository not found or access denied.', code: 'NOT_FOUND' }, { status: 404 });
  }

  const db = getDatabase();
  await db.execute('DELETE FROM repositories WHERE id = ?', [repo.id]);

  return NextResponse.json({ success: true, id: repo.id });
}
