import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDefaultWorkspaceForUser, isWorkspaceAuthorizationError } from '@/lib/server/workspace-service.js';
import { getWorkspaceUsageSummary } from '@/lib/server/billing/service.js';
import { PLANS } from '@/lib/server/billing/plans.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let workspace: Awaited<ReturnType<typeof getDefaultWorkspaceForUser>>;
  try {
    workspace = await getDefaultWorkspaceForUser(user.id);
  } catch (error: unknown) {
    if (isWorkspaceAuthorizationError(error)) {
      return NextResponse.json({ error: 'Workspace access denied.', code: 'FORBIDDEN' }, { status: 403 });
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
