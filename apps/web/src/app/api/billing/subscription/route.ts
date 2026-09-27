import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { getDefaultWorkspaceForUser } from '@/lib/server/workspace-service';
import { getWorkspaceUsageSummary } from '@/lib/server/billing/service';
import { PLANS } from '@/lib/server/billing/plans';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const workspace = await getDefaultWorkspaceForUser(user.id);
  const summary = await getWorkspaceUsageSummary(workspace.id);

  return NextResponse.json({
    subscription: summary.subscription,
    plan: summary.plan,
    metrics: summary.metrics,
    availablePlans: Object.values(PLANS),
  });
}
