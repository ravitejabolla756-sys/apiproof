import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { requireWorkspaceCapability } from '@/lib/server/workspace-service';
import { organizationErrorResponse, PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { OrganizationServiceError } from '@/lib/server/organization-service.js';
import { getWorkspaceUsageSummary } from '@/lib/server/billing/service';
import { PLANS } from '@/lib/server/billing/plans';
import { extractSessionId } from '@/lib/server/auth';
import { getDatabase } from '@/lib/server/db/index.js';
import { withPostgresTenantContext } from '@/lib/server/db/postgres-tenant-context.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    await requireWorkspaceCapability(user.id, workspace.id, 'billing:manage');
    const summary = await withPostgresTenantContext(
      getDatabase(),
      user.id,
      workspace.id,
      (tx) => getWorkspaceUsageSummary(workspace.id, tx),
      extractSessionId(req),
    );
    return NextResponse.json({
      subscription: summary.subscription,
      plan: summary.plan,
      metrics: summary.metrics,
      availablePlans: Object.values(PLANS),
    }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    if (error instanceof OrganizationServiceError || (error instanceof Error && error.message.includes('access denied'))) {
      return organizationErrorResponse(error);
    }
    if (error instanceof Error && error.message === 'WORKSPACE_CAPABILITY_DENIED') {
      return NextResponse.json({ error: 'Billing access denied.', code: error.message }, { status: 403, headers: PRIVATE_NO_STORE_HEADERS });
    }
    return NextResponse.json(
      { error: 'Billing summary is temporarily unavailable.', code: 'BILLING_UNAVAILABLE' },
      { status: 503, headers: PRIVATE_NO_STORE_HEADERS },
    );
  }
}
