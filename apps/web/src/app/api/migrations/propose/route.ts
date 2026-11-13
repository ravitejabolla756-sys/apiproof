import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { enqueueMigrationProposal, getMigrationProposalJobStatus } from '@/lib/server/proposal-verification-jobs.js';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit.js';
import {
  assertCsrfProtection,
  validateSafeId,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation.js';
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/server/organization-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  const migrationId = new URL(req.url).searchParams.get('migrationId');
  const validation = validateSafeId(migrationId, 'migrationId');
  if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'migrationId is required.');
  try {
    const job = await getMigrationProposalJobStatus(validation.data, user.id);
    return NextResponse.json({ job }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch {
    return NextResponse.json({ error: 'Verification status is unavailable.', code: 'VERIFICATION_STATUS_UNAVAILABLE' }, { status: 404, headers: PRIVATE_NO_STORE_HEADERS });
  }
}

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) {
    return forbiddenCsrfResponse(csrf.error);
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'workspace');
  if (verificationFailure) return verificationFailure;

  // Rate limit: 10 migration proposals per 5 minutes per user
  const rateCheck = await checkRateLimit(`propose:${user.id}`, 10, 5 * 60 * 1000);
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.resetInMs);
  }

  try {
    const body = (await req.json()) as { migrationId?: unknown };
    const idValidation = validateSafeId(body?.migrationId, 'migrationId');
    if (!idValidation.valid || !idValidation.data) {
      return badRequestResponse(idValidation.error || 'migrationId is required.');
    }

    if (process.env.NODE_ENV === 'production') {
      const job = await enqueueMigrationProposal(idValidation.data, user.id);
      if (job.status === 'execution_unavailable') {
        return NextResponse.json({
          error: 'Secure verification execution is not currently available. No Draft PR was created; try again when the verification worker is online.',
          code: job.errorCode,
          status: job.status,
        }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
      }
      if (job.status === 'completed') return NextResponse.json({ success: true, proposal: job.proposal }, { headers: PRIVATE_NO_STORE_HEADERS });
      return NextResponse.json({ success: true, job }, { status: 202, headers: PRIVATE_NO_STORE_HEADERS });
    }
    const { createGitHubProposal } = await import('@/lib/server/proposal-service.js');
    const proposal = await createGitHubProposal(idValidation.data, user.id);
    return NextResponse.json({ success: true, proposal }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proposal generation failed.';
    if (message.includes('PLAN_LIMIT_EXCEEDED')) {
      return NextResponse.json({ error: 'Draft proposal limit is unavailable or exceeded.', code: 'PLAN_LIMIT_EXCEEDED', metric: 'draft_prs' }, { status: 402, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('not found') || message.includes('access denied')) {
      return NextResponse.json({ error: 'Migration or repository was not found or is not accessible.', code: 'NOT_FOUND' }, { status: 404, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('GITHUB_REPOSITORY_EMPTY') || message.includes('GITHUB_DEFAULT_BRANCH_NOT_FOUND')) {
      return NextResponse.json({
        error: 'Target repository is empty or has no commits on the default branch. Add an initial commit and run a fresh scan before proposing a migration.',
        code: 'REPOSITORY_EMPTY',
      }, { status: 422, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('GITHUB_AUTHORIZATION_FAILED')) {
      return NextResponse.json({
        error: 'GitHub App is not authorized to access this repository. Check installation permissions.',
        code: 'GITHUB_UNAUTHORIZED',
      }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('REPOSITORY_HEAD_DIVERGED')) {
      return NextResponse.json({ error: 'Repository changed after the scan baseline. Run a fresh scan before proposing a migration.', code: 'REPOSITORY_HEAD_DIVERGED' }, { status: 409, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('BASELINE_SHA_REPOSITORY_MISMATCH')) {
      return NextResponse.json({ error: 'The migration baseline does not match the selected repository.', code: 'BASELINE_SHA_REPOSITORY_MISMATCH' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('BASELINE_SHA_INVALID')) {
      return NextResponse.json({ error: 'The migration baseline is invalid.', code: 'BASELINE_SHA_INVALID' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
    }
    if (message.includes('VERIFICATION_EXECUTION_UNAVAILABLE')) {
      return NextResponse.json({ error: 'Secure verification execution is not currently available. No Draft PR was created.', code: 'VERIFICATION_EXECUTION_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
    }
    console.error('Proposal generation failed:', { code: 'PROPOSAL_UNAVAILABLE' });
    return NextResponse.json({ error: 'Draft proposal generation is temporarily unavailable.', code: 'PROPOSAL_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
