import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { requireWorkspaceOwner } from '@/lib/server/workspace-service';
import { assertCsrfProtection } from '@/lib/server/validation';
import { approveProviderRuleCandidate, rejectProviderRuleCandidate } from '@/lib/server/provider-rule-service';
import { processRepositoryRescans } from '@/lib/server/repository-rescan-worker.js';

type RouteContext = { params: Promise<{ candidateId: string }> };

export async function POST(request: Request, context: RouteContext): Promise<NextResponse> {
  const csrf = assertCsrfProtection(request);
  if (!csrf.valid) return NextResponse.json({ error: csrf.error ?? 'Forbidden: Cross-site request rejected.', code: 'CSRF_REJECTED' }, { status: 403 });
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  try {
    const workspace = await resolveWorkspaceForRequest(request, user.id);
    await requireWorkspaceOwner(user.id, workspace.id);
    const { candidateId } = await context.params;
    const body = await request.json() as { decision?: unknown; notes?: unknown; reviewEvidence?: unknown };
    const decision = body.decision === 'approve' || body.decision === 'reject' ? body.decision : null;
    const notes = typeof body.notes === 'string' ? body.notes : '';
    if (!decision || notes.trim().length < 1 || notes.trim().length > 2_000) {
      return NextResponse.json({ error: 'A decision and review notes are required.', code: 'INVALID_REVIEW' }, { status: 400 });
    }
    const result = decision === 'approve'
      ? await approveProviderRuleCandidate(candidateId, user.id, notes, workspace.id, body.reviewEvidence)
      : await rejectProviderRuleCandidate(candidateId, user.id, notes, workspace.id);
    let rescan: Record<string, unknown> | null = null;
    if (decision === 'approve' && result && result.repositoriesQueued > 0) {
      try {
        const processed = await processRepositoryRescans({
          batchSize: Math.min(result.repositoriesQueued, 25),
          timeoutMs: 45_000,
        });
        rescan = { started: true, ...processed };
      } catch {
        // The durable provider_rescan_jobs rows remain available to the
        // scheduled worker when GitHub or the scan worker is temporarily down.
        rescan = { started: false, fallback: 'scheduled_rescan' };
      }
    }
    return NextResponse.json({ ok: true, decision, ...(result ?? {}), ...(rescan ? { rescan } : {}) });
  } catch (error) {
    if (error instanceof Error && error.message.includes('access denied')) {
      return NextResponse.json({ error: 'Forbidden', code: 'WORKSPACE_OWNER_REQUIRED' }, { status: 403 });
    }
    const code = error instanceof Error && /^[A-Z0-9_:-]+$/.test(error.message) ? error.message : 'INTERNAL_ERROR';
    const status = code.includes('NOT_FOUND') ? 404 : code.includes('REVIEWABLE') || code.includes('STRUCTURED') || code.includes('EVIDENCE') ? 409 : 500;
    return NextResponse.json({ error: 'Provider rule review failed.', code }, { status });
  }
}

