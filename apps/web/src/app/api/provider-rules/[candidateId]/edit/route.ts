import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { organizationErrorResponse, PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { requireWorkspaceOwner } from '@/lib/server/workspace-service';
import { assertCsrfProtection } from '@/lib/server/validation';
import { editProviderRuleCandidate } from '@/lib/server/provider-rule-service';

type RouteContext = { params: Promise<{ candidateId: string }> };

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const csrf = assertCsrfProtection(request);
  if (!csrf.valid) return NextResponse.json({ error: csrf.error ?? 'Forbidden: Cross-site request rejected.', code: 'CSRF_REJECTED' }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  try {
    const workspace = await resolveWorkspaceForRequest(request, user.id);
    await requireWorkspaceOwner(user.id, workspace.id);
    const { candidateId } = await context.params;
    const body = await request.json() as { title?: unknown; description?: unknown; apiOperationPatterns?: unknown; replacement?: unknown; migrationTemplate?: unknown; notes?: unknown };
    const notes = typeof body.notes === 'string' ? body.notes : '';
    const result = await editProviderRuleCandidate(candidateId, user.id, {
      ...(body.title !== undefined ? { title: body.title } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.apiOperationPatterns !== undefined ? { apiOperationPatterns: body.apiOperationPatterns } : {}),
      ...(body.replacement !== undefined ? { replacement: body.replacement } : {}),
      ...(body.migrationTemplate !== undefined ? { migrationTemplate: body.migrationTemplate } : {}),
    }, notes, workspace.id);
    return NextResponse.json({ ok: true, ...result }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (errorCode === 'INVALID_WORKSPACE_ID') return organizationErrorResponse(error) as NextResponse;
    if (error instanceof Error && error.message.includes('access denied')) return NextResponse.json({ error: 'Forbidden', code: 'WORKSPACE_OWNER_REQUIRED' }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
    const code = error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message) ? error.message : 'INVALID_RULE_EDIT';
    const status = code.includes('NOT_FOUND') ? 404 : code.includes('NOT_REVIEWABLE') || code.includes('CONFLICT') ? 409 : 400;
    return NextResponse.json({ error: 'Provider rule edit failed.', code }, { status, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
