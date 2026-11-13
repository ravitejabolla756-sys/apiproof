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
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/server/organization-route.js';

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
    return NextResponse.json({ success: true, migration }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Migration planning failed.';
    if (message.includes('not found') || message.includes('access denied')) {
      return NextResponse.json({ error: 'Migration finding was not found or is not accessible.', code: 'NOT_FOUND' }, { status: 404, headers: PRIVATE_NO_STORE_HEADERS });
    }
    console.error('Migration planning failed:', { code: 'PLANNING_UNAVAILABLE' });
    return NextResponse.json({ error: 'Migration planning is temporarily unavailable.', code: 'PLANNING_UNAVAILABLE' }, { status: 503, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
