import { NextResponse } from 'next/server';
import { extractSessionId, getCurrentUser } from '@/lib/server/auth.js';
import { AccountServiceError, changeAccountPassword } from '@/lib/server/account-service.js';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/server/rate-limit.js';
import {
  assertCsrfProtection,
  badRequestResponse,
  forbiddenCsrfResponse,
  validatePasswordChangeInput,
} from '@/lib/server/validation.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  const sessionId = extractSessionId(req);
  if (!user || !sessionId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  try {
    const rateCheck = await checkRateLimit(`auth:password-change:${user.id}:${getClientIp(req)}`, 5, 15 * 60 * 1000, { failClosed: true });
    if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetInMs);
    const body = await req.json();
    const validation = validatePasswordChangeInput(body);
    if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'Invalid password update.');
    await changeAccountPassword(user.id, sessionId, validation.data.currentPassword, validation.data.newPassword);
    return NextResponse.json({ success: true, message: 'Password updated. Other sessions were signed out.' });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    if (error instanceof AccountServiceError) {
      const status = error.code === 'ACCOUNT_NOT_FOUND' ? 404 : 400;
      return NextResponse.json({ error: error.message, code: error.code }, { status });
    }
    console.error('Password change request failed:', error);
    return NextResponse.json({ error: 'Password change could not be completed.', code: 'PASSWORD_CHANGE_FAILED' }, { status: 500 });
  }
}
