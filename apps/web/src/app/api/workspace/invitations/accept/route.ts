import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { acceptWorkspaceInvitation } from '@/lib/server/organization-service.js';
import { organizationErrorResponse } from '@/lib/server/organization-route.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse } from '@/lib/server/validation.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const body = await req.json() as { token?: unknown };
    if (typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) return badRequestResponse('A valid invitation token is required.');
    return NextResponse.json({ workspace: await acceptWorkspaceInvitation(user.id, body.token) });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return organizationErrorResponse(error);
  }
}
