import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth.js';
import { getDefaultWorkspaceForUser, isWorkspaceAuthorizationError } from '@/lib/server/workspace-service.js';
import { getDashboardData } from '@/lib/server/dashboard/get-dashboard-data.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve user's active/default workspace
  let workspace: Awaited<ReturnType<typeof getDefaultWorkspaceForUser>>;
  try {
    workspace = await getDefaultWorkspaceForUser(user.id);
  } catch (error: unknown) {
    if (isWorkspaceAuthorizationError(error)) {
      return NextResponse.json({ error: 'Workspace access denied.', code: 'FORBIDDEN' }, { status: 403 });
    }
    throw error;
  }
  const dashboard = await getDashboardData(workspace.id);

  return NextResponse.json({
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role: workspace.role,
      repositoryCount: dashboard.repositoryCount,
      scanCount: dashboard.scanCount,
      openFindingCount: dashboard.openFindingCount,
      hasGitHubInstallation: dashboard.hasGitHubInstallation,
      installationStatus: dashboard.installationStatus,
      installationAccount: dashboard.installationAccount,
    },
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    stats: dashboard.stats,
    repositories: dashboard.repositories,
    criticalFinding: dashboard.criticalFinding,
    recentActivities: dashboard.recentActivities,
    recentProviderChanges: dashboard.recentProviderChanges,
    findingsThisWeek: dashboard.findingsThisWeek,
    recentFixes: dashboard.recentFixes,
  });
}
