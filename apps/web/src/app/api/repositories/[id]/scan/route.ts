import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit';
import { requireRepositoryAccess } from '@/lib/server/workspace-service';
import { getDatabase } from '@/lib/server/db/index.js';
import { enqueueRepositoryScan, resolveRepositoryHead } from '@/lib/server/scan-request-service.js';
import {
  assertCsrfProtection,
  validateSafeId,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation';
import { checkWorkspaceLimit, recordWorkspaceUsage } from '@/lib/server/billing/service';
import { logger, safeErrorCode } from '@/lib/server/logger.js';

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
  const rateCheck = await checkRateLimit(`scan:${user.id}:${idValidation.data}`, 10, 5 * 60 * 1000, { failClosed: true });
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.resetInMs);
  }

  // Verify workspace repository access (central authorization / IDOR protection)
  let repo;
  let workspaceId: string;
  try {
    const access = await requireRepositoryAccess(idValidation.data, user.id);
    repo = access.repository;
    workspaceId = access.workspace.id;
  } catch {
    return NextResponse.json({ error: 'Repository not found or access denied.', code: 'NOT_FOUND' }, { status: 404 });
  }

  // Billing plan scan limit check (runs after authorization)
  const limitCheck = await checkWorkspaceLimit(workspaceId, 'scans');
  if (!limitCheck.allowed) {
    return NextResponse.json({
      error: limitCheck.reason,
      code: 'PLAN_LIMIT_EXCEEDED',
      metric: 'scans',
      limit: limitCheck.limit,
      current: limitCheck.current,
    }, { status: 402 });
  }

  try {
    const head = await resolveRepositoryHead(repo);
    const scan = await enqueueRepositoryScan({
      workspaceId,
      repositoryId: repo.id,
      commitSha: head.commitSha,
      ref: head.ref,
    });

    if (scan.created) {
      await recordWorkspaceUsage(workspaceId, 'scans', `${repo.id}:${scan.commitSha}`);
      await getDatabase().execute(`
        INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        `act_${crypto.randomBytes(10).toString('hex')}`,
        user.id,
        repo.id,
        'scan_started',
        'Scan Queued',
        `AST compatibility scan queued for ${repo.full_name}.`,
        new Date().toISOString(),
      ]);
    }

    const status = scan.state === 'completed' ? 200 : 202;
    return NextResponse.json({
      success: true,
      state: scan.state,
      requestId: scan.requestId,
      scanId: scan.scanId,
      commitSha: scan.commitSha,
      ref: scan.ref,
      created: scan.created,
    }, { status });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scan failed.';
    logger.warn('repository_scan_execution_failed', { reasonCode: safeErrorCode(error, 'SCAN_FAILED') }, error);
    if (message.includes('GITHUB_REPOSITORY_EMPTY')) {
      return NextResponse.json({
        error: 'Target repository is empty or has no commits on the default branch. Add an initial commit and run a fresh scan.',
        code: 'REPOSITORY_EMPTY',
      }, { status: 422 });
    }
    if (message.includes('GITHUB_DEFAULT_BRANCH_NOT_FOUND')) {
      return NextResponse.json({
        error: `Default branch '${repo.default_branch}' not found in remote repository.`,
        code: 'DEFAULT_BRANCH_NOT_FOUND',
      }, { status: 422 });
    }
    if (message.includes('GITHUB_AUTHORIZATION_FAILED')) {
      return NextResponse.json({
        error: 'GitHub App is not authorized to access this repository. Check installation permissions.',
        code: 'GITHUB_UNAUTHORIZED',
      }, { status: 403 });
    }
    return NextResponse.json({ error: 'Unable to start the repository scan right now.', code: 'SCAN_FAILED' }, { status: 500 });
  }
}
