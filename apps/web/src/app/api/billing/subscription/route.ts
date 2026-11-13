import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { requireWorkspaceCapability } from '@/lib/server/workspace-service';
import { resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { getWorkspaceUsageSummary } from '@/lib/server/billing/service';
import { PLANS } from '@/lib/server/billing/plans';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = await resolveWorkspaceForRequest(req, user.id);
  try {
    await requireWorkspaceCapability(user.id, workspace.id, 'billing:manage');
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKSPACE_CAPABILITY_DENIED') {
      return NextResponse.json({ error: 'Billing access denied.', code: error.message }, { status: 403 });
    }
    throw error;
  }
  const summary = await getWorkspaceUsageSummary(workspace.id);

  return NextResponse.json({
    subscription: summary.subscription,
    plan: summary.plan,
    metrics: summary.metrics,
    availablePlans: Object.values(PLANS),
  });
}
