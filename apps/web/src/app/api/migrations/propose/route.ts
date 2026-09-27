import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { createGitHubProposal } from '@/lib/server/proposal-service';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit';
import {
  assertCsrfProtection,
  validateSafeId,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation';

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
    const body = await req.json();
    const idValidation = validateSafeId(body?.migrationId, 'migrationId');
    if (!idValidation.valid || !idValidation.data) {
      return badRequestResponse(idValidation.error || 'migrationId is required.');
    }

    const proposal = await createGitHubProposal(idValidation.data, user.id);
    return NextResponse.json({ success: true, proposal });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Proposal generation failed.';
    console.error('Proposal generation failed:', error);
    return NextResponse.json({ error: message, code: 'PROPOSAL_FAILED' }, { status: 500 });
  }
}

