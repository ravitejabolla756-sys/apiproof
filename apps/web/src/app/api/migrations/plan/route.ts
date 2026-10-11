import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { generateMigrationForFinding } from '@/lib/server/planning-service.js';
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit.js';
import {
  assertCsrfProtection,
  validateSafeId,
  badRequestResponse,
  forbiddenCsrfResponse,
} from '@/lib/server/validation.js';
import { logger, safeErrorCode } from '@/lib/server/logger.js';
import { migrationProposalsEnabled } from '@/lib/server/migration-proposal-capability.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) {
    return forbiddenCsrfResponse(csrf.error);
  }

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (!migrationProposalsEnabled()) {
    return NextResponse.json(
      {
        error: 'Migration planning is unavailable during the detection-only beta.',
        code: 'MIGRATION_PROPOSALS_UNAVAILABLE',
      },
      { status: 503, headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
  }

  // Rate limit: 20 migration plans per 5 minutes per user
  const rateCheck = await checkRateLimit(`plan:${user.id}`, 20, 5 * 60 * 1000, { failClosed: true });
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.resetInMs);
  }

  try {
    const body = await req.json() as { findingId?: unknown };
    const idValidation = validateSafeId(body?.findingId, 'findingId');
    if (!idValidation.valid || !idValidation.data) {
      return badRequestResponse(idValidation.error || 'findingId is required.');
    }

    const migration = await generateMigrationForFinding(idValidation.data, user.id);
    return NextResponse.json({ success: true, migration });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Migration planning failed.';
    if (message.includes('not found') || message.includes('access denied')) {
      return NextResponse.json({ error: 'Finding not found or access denied.', code: 'NOT_FOUND' }, { status: 404 });
    }
    logger.warn('migration_planning_failed', { reasonCode: safeErrorCode(error, 'PLANNING_FAILED') }, error);
    return NextResponse.json({ error: 'Unable to plan this migration right now.', code: 'PLANNING_FAILED' }, { status: 500 });
  }
}
