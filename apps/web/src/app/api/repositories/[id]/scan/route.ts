import { NextResponse } from 'next/server';
import { extractSessionId, getCurrentUser } from '@/lib/server/auth';
import { runRepositoryScan } from '@/lib/server/scan-service';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit';
import { requireRepositoryAccess } from '@/lib/server/workspace-service';
import {
  assertCsrfProtection,
  validateSafeId,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation';
import { checkWorkspaceLimit, recordWorkspaceUsage } from '@/lib/server/billing/service';
import { assertFounderScanAuthorization, FounderScanAuthorizationError } from '@/lib/server/founder-scan-authorization';
import { safeFailureCode } from '@/lib/server/productization-persistence';
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/server/organization-route.js';

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
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'workspace');
  if (verificationFailure) return verificationFailure;

  try {
    assertFounderScanAuthorization(user.id);
  } catch (error) {
    if (error instanceof FounderScanAuthorizationError && error.code === 'FOUNDER_SCAN_ID_NOT_CONFIGURED') {
      return NextResponse.json({ error: 'Live scan authorization is not configured.', code: error.code }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: 'Live scans are restricted to the authorized founder account.', code: 'FOUNDER_SCAN_NOT_AUTHORIZED' }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
  }

  // Rate limit: 10 scans per 5 minutes per user
  const rateCheck = await checkRateLimit(`scan:${user.id}:${idValidation.data}`, 10, 5 * 60 * 1000);
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
    return NextResponse.json({ error: 'Repository not found or access denied.', code: 'NOT_FOUND' }, { status: 404, headers: PRIVATE_NO_STORE_HEADERS });
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
    }, { status: 402, headers: PRIVATE_NO_STORE_HEADERS });
  }

  try {
    const result = await runRepositoryScan(repo.id, user.id, undefined, extractSessionId(req));
    await recordWorkspaceUsage(workspaceId, 'scans');
    return NextResponse.json({ success: true, result }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Scan failed.';
    console.error('Scan execution failed', { code: safeFailureCode(error, 'SCAN_FAILED') });
    if (message.includes('GITHUB_REPOSITORY_EMPTY')) {
      return NextResponse.json({
        error: 'Target repository is empty or has no commits on the default branch. Add an initial commit and run a fresh scan.',
        code: 'REPOSITORY_EMPTY',
      }, { status: 422, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('GITHUB_DEFAULT_BRANCH_NOT_FOUND')) {
      return NextResponse.json({
        error: `Default branch '${repo.default_branch}' not found in remote repository.`,
        code: 'DEFAULT_BRANCH_NOT_FOUND',
      }, { status: 422, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('GITHUB_AUTHORIZATION_FAILED')) {
      return NextResponse.json({
        error: 'GitHub App is not authorized to access this repository. Check installation permissions.',
        code: 'GITHUB_UNAUTHORIZED',
      }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
    }
    return NextResponse.json({ error: 'Scan failed. Review the repository status and try again.', code: 'SCAN_FAILED' }, { status: 500, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
