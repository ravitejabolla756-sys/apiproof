import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDatabase } from '@/lib/server/db/index.js';
import { getUserWorkspaces } from '@/lib/server/workspace-service.js';
import { buildAccountDeletionDryRunPlan } from '@/lib/server/account-deletion-plan.js';
import { assertCsrfProtection, forbiddenCsrfResponse } from '@/lib/server/validation.js';
import { PRIVATE_NO_STORE_HEADERS } from '@/lib/server/organization-route.js';

/**
 * Returns deletion-readiness blockers only. This endpoint never executes or
 * queues deletion and never accepts policy approval from the browser.
 */
export async function POST(req: Request): Promise<Response> {
  const csrf = assertCsrfProtection(req);
  if (!csrf.valid) return forbiddenCsrfResponse(csrf.error);

  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      { status: 401, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }

  try {
    const memberships = await getUserWorkspaces(user.id);
    const ownerRows = await getDatabase().query<{ workspace_id: string; owner_count: number | string }>(`
      SELECT workspace_id, COUNT(*) AS owner_count
      FROM workspace_members
      WHERE role = 'owner'
      GROUP BY workspace_id
    `);
    const ownerCounts = new Map(ownerRows.map((row) => [row.workspace_id, Number(row.owner_count)]));
    const idempotencyKey = req.headers.get('idempotency-key') ?? '';
    const result = buildAccountDeletionDryRunPlan({
      security: {
        actorUserId: user.id,
        subjectUserId: user.id,
        reauthenticated: false,
        csrfValidated: true,
        idempotencyKey,
      },
      workspaces: memberships.map((workspace) => ({
        workspaceId: workspace.id,
        role: workspace.role,
        ownerCount: ownerCounts.get(workspace.id) ?? 0,
      })),
    });

    if (!result.ok) {
      return NextResponse.json(
        {
          status: 'blocked',
          code: 'DELETION_CONTRACT_PENDING',
          blockers: result.blockers,
          destructiveExecutionEnabled: false,
        },
        { status: 409, headers: PRIVATE_NO_STORE_HEADERS },
      );
    }

    return NextResponse.json({ plan: result.plan }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch {
    return NextResponse.json(
      { error: 'Deletion readiness is temporarily unavailable.', code: 'DELETION_PLAN_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}
