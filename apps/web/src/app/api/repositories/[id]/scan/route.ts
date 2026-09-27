import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { runRepositoryScan } from '@/lib/server/scan-service';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit';
import {
  assertCsrfProtection,
  validateSafeId,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation';

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) {
    return forbiddenCsrfResponse(csrf.error);
  }

  const { id } = await props.params;
  const idValidation = validateSafeId(id, 'repository ID');
  if (!idValidation.valid || !idValidation.data) {
    return badRequestResponse(idValidation.error || 'Invalid repository identifier.');
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  // Rate limit: 10 scans per 5 minutes per user
  const rateCheck = await checkRateLimit(`scan:${user.id}:${idValidation.data}`, 10, 5 * 60 * 1000);
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.resetInMs);
  }

  const db = getDatabase();
  // Resolve repo ID by ID or slug with user_id tenant enforcement
  const repo = await db.queryOne<{ id: string; full_name: string }>(`
    SELECT id, full_name FROM repositories
    WHERE (id = ? OR name = ? OR full_name = ?) AND user_id = ?
  `, [idValidation.data, idValidation.data, idValidation.data, user.id]);

  if (!repo) {
    return NextResponse.json({ error: 'Repository not found or access denied.', code: 'NOT_FOUND' }, { status: 404 });
  }

  try {
    const result = await runRepositoryScan(repo.id, user.id);
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scan failed.';
    console.error('Scan execution error:', error);
    return NextResponse.json({ error: message, code: 'SCAN_FAILED' }, { status: 500 });
  }
}

