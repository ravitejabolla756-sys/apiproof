import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { enqueueMigrationProposal, getMigrationProposalJobStatus } from '@/lib/server/proposal-verification-jobs.js';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit.js';
import { isWorkspaceAuthorizationError } from '@/lib/server/workspace-service.js';
import {
  assertCsrfProtection,
  validateSafeId,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  const migrationId = new URL(req.url).searchParams.get('migrationId');
  const validation = validateSafeId(migrationId, 'migrationId');
  if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'migrationId is required.');
  try {
    const job = await getMigrationProposalJobStatus(validation.data, user.id);
    return NextResponse.json({ job }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Verification status unavailable.';
    return NextResponse.json({ error: message, code: 'NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  }
}

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) {
    return forbiddenCsrfResponse(csrf.error);
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

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
        }, { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
      }
      if (job.status === 'completed') return NextResponse.json({ success: true, proposal: job.proposal });
      return NextResponse.json({ success: true, job }, { status: 202, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
    }
    const { createGitHubProposal } = await import('@/lib/server/proposal-service.js');
    const proposal = await createGitHubProposal(idValidation.data, user.id);
    return NextResponse.json({ success: true, proposal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proposal generation failed.';
    if (isWorkspaceAuthorizationError(error)) {
      return NextResponse.json({ error: 'Resource not found or access denied.', code: 'NOT_FOUND' }, { status: 404 });
    }
    if (message.includes('PLAN_LIMIT_EXCEEDED')) {
      return NextResponse.json({ error: message, code: 'PLAN_LIMIT_EXCEEDED', metric: 'draft_prs' }, { status: 402 });
    }
    if (message.includes('not found') || message.includes('access denied')) {
      return NextResponse.json({ error: message, code: 'NOT_FOUND' }, { status: 404 });
    }
    if (message.includes('GITHUB_REPOSITORY_EMPTY') || message.includes('GITHUB_DEFAULT_BRANCH_NOT_FOUND')) {
      return NextResponse.json({
        error: 'Target repository is empty or has no commits on the default branch. Add an initial commit and run a fresh scan before proposing a migration.',
        code: 'REPOSITORY_EMPTY',
      }, { status: 422 });
    }
    if (message.includes('GITHUB_AUTHORIZATION_FAILED')) {
      return NextResponse.json({
        error: 'GitHub App is not authorized to access this repository. Check installation permissions.',
        code: 'GITHUB_UNAUTHORIZED',
      }, { status: 403 });
    }
    if (message.includes('REPOSITORY_HEAD_DIVERGED')) {
      return NextResponse.json({ error: message, code: 'REPOSITORY_HEAD_DIVERGED' }, { status: 409 });
    }
    if (message.includes('BASELINE_SHA_REPOSITORY_MISMATCH')) {
      return NextResponse.json({ error: message, code: 'BASELINE_SHA_REPOSITORY_MISMATCH' }, { status: 400 });
    }
    if (message.includes('BASELINE_SHA_INVALID')) {
      return NextResponse.json({ error: message, code: 'BASELINE_SHA_INVALID' }, { status: 400 });
    }
    if (message.includes('VERIFICATION_EXECUTION_UNAVAILABLE')) {
      return NextResponse.json({ error: 'Secure verification execution is not currently available. No Draft PR was created.', code: 'VERIFICATION_EXECUTION_UNAVAILABLE' }, { status: 503 });
    }
    console.error('Proposal generation failed:', error);
    return NextResponse.json({ error: message, code: 'PROPOSAL_FAILED' }, { status: 500 });
  }
}
