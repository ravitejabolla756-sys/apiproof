import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/server/auth';
import { organizationErrorResponse, PRIVATE_NO_STORE_HEADERS, resolveWorkspaceForRequest } from '@/lib/server/organization-route.js';
import { getDashboardData } from '@/lib/server/dashboard/get-dashboard-data.js';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: PRIVATE_NO_STORE_HEADERS });
  }

  try {
    const workspace = await resolveWorkspaceForRequest(req, user.id);
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
    }, { headers: PRIVATE_NO_STORE_HEADERS });
  } catch (error) {
    return organizationErrorResponse(error);
  }
}
