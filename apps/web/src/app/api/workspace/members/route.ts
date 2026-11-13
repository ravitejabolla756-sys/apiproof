import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { revokeWorkspaceMember } from '@/lib/server/member-revocation.js';
import { PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest, organizationErrorResponse } from '@/lib/server/organization-route.js';
import { listOrganizationMembers, updateMemberRole } from '@/lib/server/organization-service.js';
import {
  mapMemberRevocationError,
  normalizeMemberRevocationRequest,
  type MemberRevocationApiRequest,
} from '@/lib/server/organization-integration-contract.js';
import { assertCsrfProtection, badRequestResponse, forbiddenCsrfResponse, validateSafeId } from '@/lib/server/validation.js';
import { verifiedUserRouteFailure } from '@/lib/server/verified-user-route.js';

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' };

export async function GET(request: Request): Promise<Response> {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  try {
    const workspace = await resolveWorkspaceForRequest(request, user.id);
    return NextResponse.json({ workspace, members: await listOrganizationMembers(user.id, workspace.id) }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}

export async function PATCH(request: Request): Promise<Response> {
  const csrf = assertCsrfProtection(request);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'workspace');
  if (verificationFailure) return verificationFailure;
  try {
    const body = await request.json() as { workspaceId?: unknown; userId?: unknown; role?: unknown };
    const workspaceValidation = validateSafeId(body.workspaceId, 'workspaceId');
    const userValidation = validateSafeId(body.userId, 'userId');
    if (!workspaceValidation.valid || !workspaceValidation.data) return badRequestResponse(workspaceValidation.error || 'A valid workspaceId is required.');
    if (!userValidation.valid || !userValidation.data) return badRequestResponse(userValidation.error || 'A valid userId is required.');
    if (body.role !== 'owner' && body.role !== 'member') return badRequestResponse('A valid role is required.');
    const workspace = await resolveWorkspaceForRequest(request, user.id, workspaceValidation.data);
    return NextResponse.json({ members: await updateMemberRole(user.id, workspace.id, userValidation.data, body.role) }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof SyntaxError) return badRequestResponse('Request body must be valid JSON.');
    return organizationErrorResponse(error);
  }
}

function errorResponse(error: unknown): Response {
  const mapped = mapMemberRevocationError(error);
  const status = mapped.code === 'INTERNAL_ERROR'
    ? 500
    : mapped.code === 'REVOCATION_SCHEMA_UNAVAILABLE' ? 503
    : mapped.code === 'WORKSPACE_ACCESS_DENIED' ? 404
      : mapped.code === 'WORKSPACE_CAPABILITY_DENIED' ? 403
        : 400;
  return NextResponse.json(mapped, { status, headers: noStore });
}

export async function DELETE(request: Request): Promise<Response> {
  const csrf = assertCsrfProtection(request);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: noStore });
  const verificationFailure = await verifiedUserRouteFailure(user.id, 'workspace');
  if (verificationFailure) return verificationFailure;

  let body: MemberRevocationApiRequest;
  try {
    body = await request.json() as MemberRevocationApiRequest;
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.', code: 'INVALID_REQUEST_PAYLOAD' }, { status: 400, headers: noStore });
  }

  let normalized: ReturnType<typeof normalizeMemberRevocationRequest>;
  try {
    normalized = normalizeMemberRevocationRequest(body);
  } catch {
    return NextResponse.json({ error: 'workspaceId and userId are required.', code: 'INVALID_REQUEST_PAYLOAD' }, { status: 400, headers: noStore });
  }
  if (!normalized.idempotencyKey) {
    return NextResponse.json({ error: 'An idempotencyKey is required for member removal.', code: 'REVOCATION_IDEMPOTENCY_KEY_REQUIRED' }, { status: 400, headers: noStore });
  }

  try {
    const result = await revokeWorkspaceMember(user.id, {
      workspaceId: normalized.workspaceId,
      userId: normalized.userId,
      reason: normalized.reason,
      idempotencyKey: normalized.idempotencyKey,
    });
    return NextResponse.json({
      success: true,
      revocation: {
        requestId: result.requestId,
        eventId: result.eventId,
        status: result.status,
        workspaceId: result.workspaceId,
        subjectUserId: result.subjectUserId,
        subjectMembershipId: result.subjectMembershipId,
        idempotencyKey: result.idempotencyKey,
      },
    }, { headers: noStore });
  } catch (error) {
    return errorResponse(error);
  }
}
