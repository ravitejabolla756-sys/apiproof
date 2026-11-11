import { NextResponse } from 'next/server';
import { extractSessionId, getCurrentUser } from '@/lib/server/auth.js';
import { AccountServiceError, changeAccountPassword } from '@/lib/server/account-service.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse, validatePasswordChangeInput } from '@/lib/server/validation.js';

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  const sessionId = extractSessionId(req);
  if (!user || !sessionId) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: noStore });
  try {
    const validation = validatePasswordChangeInput(await req.json());
    if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'Invalid password update.');
    await changeAccountPassword(user.id, sessionId, validation.data.currentPassword, validation.data.newPassword);
    return NextResponse.json({ success: true, message: 'Password updated. Other sessions were signed out.' }, { headers: noStore });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    if (error instanceof AccountServiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: 400, headers: noStore });
    console.error('Password change request failed:', error);
    return NextResponse.json({ error: 'Password change could not be completed.', code: 'PASSWORD_CHANGE_FAILED' }, { status: 500, headers: noStore });
  }
}
