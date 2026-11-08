import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db.js';
import { organizationErrorResponse, PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { requireWorkspaceOwner } from '@/lib/server/workspace-service';
import { assertCsrfProtection } from '@/lib/server/validation';
import { collectProviderRuleTestTokens, findProviderRuleTestMatches } from '@/lib/server/provider-rule-test';

type RouteContext = { params: Promise<{ candidateId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const csrf = assertCsrfProtection(request);
  if (!csrf.valid) return NextResponse.json({ error: csrf.error ?? 'Forbidden: Cross-site request rejected.', code: 'CSRF_REJECTED' }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  try {
    const workspace = await resolveWorkspaceForRequest(request, user.id);
    await requireWorkspaceOwner(user.id, workspace.id);
    const { candidateId } = await context.params;
    const body = await request.json() as { code?: unknown; filePath?: unknown };
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code || code.length > 100_000) return NextResponse.json({ error: 'Sample code is required and must be at most 100 KB.', code: 'INVALID_SAMPLE' }, { status: 400, headers: PRIVATE_NO_STORE_HEADERS });
    const candidate = await getDatabase().queryOne<{ payload_json: string; provider_id: string }>(
      'SELECT payload_json, provider_id FROM provider_rule_candidates WHERE id = ? AND (workspace_id IS NULL OR workspace_id = ?)', [candidateId, workspace.id],
    );
    if (!candidate) return NextResponse.json({ error: 'Rule candidate not found.', code: 'NOT_FOUND' }, { status: 404, headers: PRIVATE_NO_STORE_HEADERS });
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(candidate.payload_json) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid payload');
      payload = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Rule candidate payload is invalid.', code: 'INVALID_RULE_PAYLOAD' }, { status: 409, headers: PRIVATE_NO_STORE_HEADERS });
    }
    const tokens = collectProviderRuleTestTokens(payload);
    const matches = findProviderRuleTestMatches(code, tokens);
    return NextResponse.json({ ok: true, providerId: candidate.provider_id, filePath: typeof body.filePath === 'string' ? body.filePath : 'sample.ts', matches, testedTokens: tokens }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    const errorCode = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined;
    if (errorCode === 'INVALID_WORKSPACE_ID') return organizationErrorResponse(error) as NextResponse;
    if (error instanceof Error && error.message.includes('access denied')) return NextResponse.json({ error: 'Forbidden', code: 'WORKSPACE_OWNER_REQUIRED' }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
    return NextResponse.json({ error: 'Unable to test provider rule.', code: 'INTERNAL_ERROR' }, { status: 500, headers: PRIVATE_NO_STORE_HEADERS });
  }
}
