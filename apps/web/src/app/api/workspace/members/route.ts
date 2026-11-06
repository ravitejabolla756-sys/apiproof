import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { resolveWorkspaceForRequest, organizationErrorResponse } from '@/lib/server/organization-route.js';
import { listOrganizationMembers, removeOrganizationMember, updateMemberRole } from '@/lib/server/organization-service.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse } from '@/lib/server/validation.js';

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
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const body = await req.json() as { memberId?: unknown; role?: unknown };
    if (typeof body.memberId !== 'string' || (body.role !== 'owner' && body.role !== 'member')) return badRequestResponse('memberId and a valid role are required.');
    return NextResponse.json({ members: await updateMemberRole(user.id, workspace.id, body.memberId, body.role) });
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
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const body = await req.json() as { memberId?: unknown };
    if (typeof body.memberId !== 'string') return badRequestResponse('memberId is required.');
    await removeOrganizationMember(user.id, workspace.id, body.memberId);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return organizationErrorResponse(error);
  }
}
