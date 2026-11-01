import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/server/auth.js';
import { seedOfficialProviderReviewQueue } from '../../../../lib/server/provider-review-queue-seed.js';
import { getDefaultWorkspaceForUser, requireWorkspaceOwner } from '../../../../lib/server/workspace-service.js';
import { assertCsrfProtection } from '../../../../lib/server/validation.js';

const privateNoStore = { 'Cache-Control': 'private, no-store, max-age=0' };

/**
 * Populate the evidence-backed provider review queue for a fresh workspace.
 *
 * This endpoint deliberately does not approve rules, enqueue rescans, or write
 * to connected repositories. Every imported candidate remains needs_review.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const csrf = assertCsrfProtection(request);
  if (!csrf.valid) {
    return NextResponse.json(
      { error: csrf.error ?? 'Forbidden: Cross-site request rejected.', code: 'CSRF_REJECTED' },
      { status: 403, headers: privateNoStore },
    );
  }

  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401, headers: privateNoStore });

  try {
    const workspace = await getDefaultWorkspaceForUser(user.id);
    await requireWorkspaceOwner(user.id, workspace.id);
    const result = await seedOfficialProviderReviewQueue();
    return NextResponse.json({
      ok: true,
      ...result,
      safety: 'evidence-only; imported candidates remain needs_review; no rescans or repository writes were performed',
    }, { headers: privateNoStore });
  } catch (error) {
    if (error instanceof Error && error.message.includes('access denied')) {
      return NextResponse.json({ error: 'Forbidden', code: 'WORKSPACE_OWNER_REQUIRED' }, { status: 403, headers: privateNoStore });
    }
    return NextResponse.json({ error: 'Unable to populate provider review queue.', code: 'INTERNAL_ERROR' }, { status: 500, headers: privateNoStore });
  }
}
