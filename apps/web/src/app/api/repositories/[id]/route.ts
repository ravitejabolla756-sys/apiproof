import { NextResponse } from 'next/server';
import { extractSessionId, getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { withPostgresTenantContext } from '@/lib/server/db/postgres-tenant-context.js';
import { requireRepositoryAccess, requireWorkspaceCapability } from '@/lib/server/workspace-service.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';

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
  const sessionId = extractSessionId(req);
  const { findings, scans } = await withPostgresTenantContext(db, user.id, repo.workspace_id, async (tx) => {
    const staleBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    await tx.execute(`
      UPDATE scans
      SET status = 'failed', error_message = ?, completed_at = ?
      WHERE repository_id = ? AND status IN ('pending', 'running') AND started_at < ?
    `, [
      'SCAN_TIMEOUT_RECOVERED: previous scan exceeded the execution window.',
      new Date().toISOString(),
      repo.id,
      staleBefore,
    ]);

    const findings = await tx.query(`
      SELECT f.id, f.change_id, f.provider, f.title, f.description, f.severity, f.confidence,
             f.file_path, f.line_number, f.symbol, f.status, f.created_at
      FROM findings f
      WHERE f.repository_id = ?
      ORDER BY CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, f.line_number ASC
    `, [repo.id]);

    const scans = await tx.query(`
      SELECT s.id, s.sha, s.status, s.provider, s.files_analyzed, s.findings_count, s.started_at, s.completed_at
      FROM scans s
      WHERE s.repository_id = ?
      ORDER BY s.started_at DESC
      LIMIT 10
    `, [repo.id]);
    return { findings, scans };
  }, sessionId);

  return NextResponse.json({
    repository: repo,
    findings,
    scans,
  });
}

export async function DELETE(req: Request, props: { params: Promise<{ id: string }> }) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const { id } = await props.params;
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'workspace');
  if (verificationFailure) return verificationFailure;

  let repo;
  let workspace;
  try {
    const access = await requireRepositoryAccess(id, user.id);
    repo = access.repository;
    workspace = await requireWorkspaceCapability(user.id, repo.workspace_id, 'repository:write');
  } catch {
    return NextResponse.json({ error: 'Repository not found or access denied.', code: 'NOT_FOUND' }, { status: 404 });
  }

  const db = getDatabase();
  await withPostgresTenantContext(
    db,
    user.id,
    workspace.id,
    (tx) => tx.execute('DELETE FROM repositories WHERE id = ? AND workspace_id = ?', [repo.id, workspace.id]),
    extractSessionId(req),
  );

  return NextResponse.json({ success: true, id: repo.id });
}
