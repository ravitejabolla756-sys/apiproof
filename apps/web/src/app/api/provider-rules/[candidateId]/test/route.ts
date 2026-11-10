import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db';
import { getDefaultWorkspaceForUser, isWorkspaceAuthorizationError, requireWorkspaceOwner } from '@/lib/server/workspace-service';
import { assertCsrfProtection } from '@/lib/server/validation';
import { collectProviderRuleTestTokens, findProviderRuleTestMatches } from '@/lib/server/provider-rule-test.js';

type RouteContext = { params: Promise<{ candidateId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const csrf = assertCsrfProtection(request);
  if (!csrf.valid) return NextResponse.json({ error: csrf.error ?? 'Forbidden: Cross-site request rejected.', code: 'CSRF_REJECTED' }, { status: 403 });
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const workspace = await getDefaultWorkspaceForUser(user.id);
    await requireWorkspaceOwner(user.id, workspace.id);
    const { candidateId } = await context.params;
    const body = await request.json() as { code?: unknown; filePath?: unknown };
    const code = typeof body.code === 'string' ? body.code : '';
    if (!code || code.length > 100_000) return NextResponse.json({ error: 'Sample code is required and must be at most 100 KB.', code: 'INVALID_SAMPLE' }, { status: 400 });
    const candidate = await getDatabase().queryOne<{ payload_json: string; provider_id: string }>(
      'SELECT payload_json, provider_id FROM provider_rule_candidates WHERE id = ? AND (workspace_id IS NULL OR workspace_id = ?)', [candidateId, workspace.id],
    );
    if (!candidate) return NextResponse.json({ error: 'Rule candidate not found.', code: 'NOT_FOUND' }, { status: 404 });
    let payload: Record<string, unknown>;
    try {
      const parsed = JSON.parse(candidate.payload_json) as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid payload');
      payload = parsed as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Rule candidate payload is invalid.', code: 'INVALID_RULE_PAYLOAD' }, { status: 409 });
    }
    const tokens = collectProviderRuleTestTokens(payload);
    const matches = findProviderRuleTestMatches(code, tokens);
    return NextResponse.json({ ok: true, providerId: candidate.provider_id, filePath: typeof body.filePath === 'string' ? body.filePath : 'sample.ts', matches, testedTokens: tokens });
  } catch (error) {
    if (isWorkspaceAuthorizationError(error)) return NextResponse.json({ error: 'Forbidden', code: 'WORKSPACE_OWNER_REQUIRED' }, { status: 403 });
    return NextResponse.json({ error: 'Unable to test provider rule.', code: 'INTERNAL_ERROR' }, { status: 500 });
  }
}
