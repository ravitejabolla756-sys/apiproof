import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { AccountServiceError, getAccountForUser, updateAccountDisplayName } from '@/lib/server/account-service.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse, validateAccountDisplayNameInput } from '@/lib/server/validation.js';

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' };

function failure(error: unknown): Response {
  if (error instanceof AccountServiceError) return NextResponse.json({ error: error.message, code: error.code }, { status: 404, headers: noStore });
  console.error('Account request failed:', error);
  return NextResponse.json({ error: 'Account request could not be completed.', code: 'ACCOUNT_REQUEST_FAILED' }, { status: 500, headers: noStore });
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: noStore });
  try { return NextResponse.json({ account: await getAccountForUser(user.id) }, { headers: noStore }); } catch (error) { return failure(error); }
}

export async function PATCH(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: noStore });
  try {
    const validation = validateAccountDisplayNameInput(await req.json());
    if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'Invalid account update.');
    return NextResponse.json({ account: await updateAccountDisplayName(user.id, validation.data.name) }, { headers: noStore });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return failure(error);
  }
}
