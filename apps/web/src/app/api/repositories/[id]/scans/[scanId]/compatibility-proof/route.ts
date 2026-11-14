import { NextResponse } from 'next/server';
import { extractSessionId, getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { withPostgresTenantContext } from '@/lib/server/db/postgres-tenant-context.js';
import { requireRepositoryAccess } from '@/lib/server/workspace-service.js';
import { parseBoundedProductizationProjection } from '@/lib/server/productization-persistence.js';

const headers = { 'Cache-Control': 'private, no-store, max-age=0' };

/** Returns only the bounded structured Productization projection for an authorized repository scan. */
export async function GET(req: Request, props: { params: Promise<{ id: string; scanId: string }> }) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers });
  const { id, scanId } = await props.params;
  let access;
  try {
    access = await requireRepositoryAccess(id, user.id);
  } catch {
    return NextResponse.json({ error: 'Repository not found' }, { status: 404, headers });
  }
  const db = getDatabase();
  const scan = await withPostgresTenantContext(
    db,
    user.id,
    access.repository.workspace_id,
    (tx) => tx.queryOne<{ id: string; repository_id: string; sha: string; status: string; raw_result: string | null }>(
      'SELECT id, repository_id, sha, status, raw_result FROM scans WHERE id = ? AND repository_id = ?', [scanId, access.repository.id],
    ),
    extractSessionId(req),
  );
  if (!scan) return NextResponse.json({ error: 'Scan not found' }, { status: 404, headers });
  const raw: unknown = (() => { try { return scan.raw_result ? JSON.parse(scan.raw_result) : null; } catch { return null; } })();
  const projection = parseBoundedProductizationProjection(raw);
  return NextResponse.json({ ok: true, repositoryId: access.repository.id, scanId: scan.id, baselineSha: scan.sha, status: scan.status, productization: projection }, { headers });
}
