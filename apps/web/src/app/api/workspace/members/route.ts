import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { revokeWorkspaceMember } from '@/lib/server/member-revocation.js';
import {
  mapMemberRevocationError,
  normalizeMemberRevocationRequest,
  type MemberRevocationApiRequest,
} from '@/lib/server/organization-integration-contract.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';

const noStore = { 'Cache-Control': 'private, no-store, max-age=0' };

function errorResponse(error: unknown): Response {
  const mapped = mapMemberRevocationError(error);
  const status = mapped.code === 'INTERNAL_ERROR'
    ? 500
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
