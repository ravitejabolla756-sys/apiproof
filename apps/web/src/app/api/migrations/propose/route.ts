import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { createGitHubProposal } from '@/lib/server/proposal-service.js';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit.js';
import {
  assertCsrfProtection,
  validateSafeId,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation.js';

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

    const proposal = await createGitHubProposal(idValidation.data, user.id);
    return NextResponse.json({ success: true, proposal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proposal generation failed.';
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
    console.error('Proposal generation failed:', error);
    return NextResponse.json({ error: message, code: 'PROPOSAL_FAILED' }, { status: 500 });
  }
}
