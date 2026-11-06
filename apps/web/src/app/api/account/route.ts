import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import {
  AccountServiceError,
  getAccountForUser,
  updateAccountDisplayName,
} from '@/lib/server/account-service.js';
import {
  assertCsrfProtection,
  badRequestResponse,
  forbiddenCsrfResponse,
  validateAccountDisplayNameInput,
} from '@/lib/server/validation.js';

function serviceErrorResponse(error: unknown): Response {
  if (error instanceof AccountServiceError) {
    const status = error.code === 'ACCOUNT_NOT_FOUND' ? 404 : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }
  console.error('Account request failed:', error);
  return NextResponse.json({ error: 'Account request could not be completed.', code: 'ACCOUNT_REQUEST_FAILED' }, { status: 500 });
}

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    return NextResponse.json({ account: await getAccountForUser(user.id) });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  try {
    const body = await req.json();
    const validation = validateAccountDisplayNameInput(body);
    if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'Invalid account update.');
    return NextResponse.json({ account: await updateAccountDisplayName(user.id, validation.data.name) });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return serviceErrorResponse(error);
  }
}

