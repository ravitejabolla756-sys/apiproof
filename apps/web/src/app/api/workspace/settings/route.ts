import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest, organizationErrorResponse } from '@/lib/server/organization-route.js';
import { updateWorkspaceSettings } from '@/lib/server/organization-service.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse } from '@/lib/server/validation.js';
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  try {
    return NextResponse.json({ workspace: await resolveWorkspaceForRequest(req, user.id) }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'workspace');
  if (verificationFailure) return verificationFailure;
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const body = await req.json() as { name?: unknown; slug?: unknown };
    if (typeof body.name !== 'string' || typeof body.slug !== 'string') return badRequestResponse('Workspace name and slug are required.');
    return NextResponse.json({ workspace: await updateWorkspaceSettings(user.id, workspace.id, body.name, body.slug) }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return organizationErrorResponse(error);
  }
}
