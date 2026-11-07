import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { organizationErrorResponse, WORKSPACE_CONTEXT_COOKIE } from '@/lib/server/organization-route.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse, validateSafeId } from '@/lib/server/validation.js';
import { requireWorkspaceMember } from '@/lib/server/workspace-service.js';
import { isProductionRuntime } from '@/lib/server/runtime-mode.js';

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });

  try {
    const body = await req.json() as { workspaceId?: unknown };
    if (typeof body.workspaceId !== 'string') return badRequestResponse('workspaceId is required.');
    const validation = validateSafeId(body.workspaceId, 'workspaceId');
    if (!validation.valid || !validation.data) return badRequestResponse(validation.error || 'Invalid workspaceId.');
    const workspace = await requireWorkspaceMember(user.id, validation.data);
    const response = NextResponse.json(
      { workspace },
      { headers: { 'Cache-Control': 'private, no-store, max-age=0' } },
    );
    response.cookies.set(WORKSPACE_CONTEXT_COOKIE, workspace.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: isProductionRuntime(),
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return response;
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return organizationErrorResponse(error);
  }
}
