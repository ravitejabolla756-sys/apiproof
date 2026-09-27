import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { generateMigrationForFinding } from '@/lib/server/planning-service';
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

  // Rate limit: 20 migration plans per 5 minutes per user
  const rateCheck = await checkRateLimit(`plan:${user.id}`, 20, 5 * 60 * 1000);
  if (!rateCheck.allowed) {
    return rateLimitResponse(rateCheck.resetInMs);
  }

  try {
    const body = await req.json();
    const idValidation = validateSafeId(body?.findingId, 'findingId');
    if (!idValidation.valid || !idValidation.data) {
      return badRequestResponse(idValidation.error || 'findingId is required.');
    }

    const migration = await generateMigrationForFinding(idValidation.data, user.id);
    return NextResponse.json({ success: true, migration });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Migration planning failed.';
    console.error('Migration planning failed:', error);
    return NextResponse.json({ error: message, code: 'PLANNING_FAILED' }, { status: 500 });
  }
}

