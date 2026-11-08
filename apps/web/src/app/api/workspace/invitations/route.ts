import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { resolveWorkspaceForRequest, organizationErrorResponse } from '@/lib/server/organization-route.js';
import { createWorkspaceInvitation, listWorkspaceInvitations, revokeWorkspaceInvitation } from '@/lib/server/organization-service.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse, validateSafeId } from '@/lib/server/validation.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    return NextResponse.json({ invitations: await listWorkspaceInvitations(user.id, workspace.id) });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

export async function POST(req: Request) {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const body = await req.json() as { email?: unknown; role?: unknown };
    if (typeof body.email !== 'string' || (body.role !== undefined && body.role !== 'member')) return badRequestResponse('A valid email and the member role are required.');
    const result = await createWorkspaceInvitation(user.id, workspace.id, body.email, 'member');
    const origin = new URL(req.url).origin;
    return NextResponse.json({ invitation: result.invitation, inviteToken: result.token, inviteUrl: `${origin}/invite/accept?token=${encodeURIComponent(result.token)}`, delivery: 'manual-copy-only' }, { status: 201 });
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
    const body = await req.json() as { invitationId?: unknown };
    const invitationValidation = validateSafeId(body.invitationId, 'invitationId');
    if (!invitationValidation.valid || !invitationValidation.data) return badRequestResponse(invitationValidation.error || 'A valid invitationId is required.');
    await revokeWorkspaceInvitation(user.id, workspace.id, invitationValidation.data);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return organizationErrorResponse(error);
  }
}
