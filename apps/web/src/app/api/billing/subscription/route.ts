import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { organizationErrorResponse, PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { getWorkspaceUsageSummary } from '@/lib/server/billing/service';
import { PLANS } from '@/lib/server/billing/plans.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
    const summary = await getWorkspaceUsageSummary(workspace.id);

    return NextResponse.json({
      subscription: summary.subscription,
      plan: summary.plan,
      metrics: summary.metrics,
      availablePlans: Object.values(PLANS),
    }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}
