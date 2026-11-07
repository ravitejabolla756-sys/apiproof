import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { resolveWorkspaceForRequest, organizationErrorResponse } from '@/lib/server/organization-route.js';
import { listOrganizationMembers, removeOrganizationMember, updateMemberRole } from '@/lib/server/organization-service.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse, validateSafeId } from '@/lib/server/validation.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    return NextResponse.json({ workspace, members: await listOrganizationMembers(user.id, workspace.id) });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

export async function PATCH(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const body = await req.json() as { workspaceId?: unknown; userId?: unknown; role?: unknown };
    const workspaceValidation = validateSafeId(body.workspaceId, 'workspaceId');
    const userValidation = validateSafeId(body.userId, 'userId');
    if (!workspaceValidation.valid || !workspaceValidation.data) return badRequestResponse(workspaceValidation.error || 'A valid workspaceId is required.');
    if (!userValidation.valid || !userValidation.data) return badRequestResponse(userValidation.error || 'A valid userId is required.');
    if (body.role !== 'owner' && body.role !== 'member') return badRequestResponse('A valid role is required.');
    const workspace = await resolveWorkspaceForRequest(req, user.id, workspaceValidation.data);
    return NextResponse.json({ members: await updateMemberRole(user.id, workspace.id, userValidation.data, body.role) });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return organizationErrorResponse(error);
  }
}

export async function DELETE(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const body = await req.json() as { workspaceId?: unknown; userId?: unknown };
    const workspaceValidation = validateSafeId(body.workspaceId, 'workspaceId');
    const userValidation = validateSafeId(body.userId, 'userId');
    if (!workspaceValidation.valid || !workspaceValidation.data) return badRequestResponse(workspaceValidation.error || 'A valid workspaceId is required.');
    if (!userValidation.valid || !userValidation.data) return badRequestResponse(userValidation.error || 'A valid userId is required.');
    const workspace = await resolveWorkspaceForRequest(req, user.id, workspaceValidation.data);
    await removeOrganizationMember(user.id, workspace.id, userValidation.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return organizationErrorResponse(error);
  }
}
