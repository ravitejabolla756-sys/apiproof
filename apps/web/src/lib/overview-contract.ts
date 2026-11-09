const statKeys = ['connectedRepositories', 'scansCompleted', 'openFindings', 'criticalFindings', 'draftPrsCount', 'providerRulesPending', 'providerRulesApproved', 'rescansPending', 'rescansProcessing', 'rescansFailed'] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export type OverviewSidebarProjection = {
  openFindingsCount: number | null;
  workspaceName: string | null;
  userEmail: string | null;
};

/** Validate only the overview fields consumed by the persistent dashboard sidebar. */
export function parseOverviewSidebarProjection(value: unknown): OverviewSidebarProjection | null {
  if (!record(value) || !record(value.stats)) return null;
  const workspace = value.workspace;
  const user = value.user;
  const workspaceName = workspace === undefined || workspace === null ? null : record(workspace) && typeof workspace.name === 'string' && workspace.name.trim() ? workspace.name.trim() : null;
  const userEmail = user === undefined || user === null ? null : record(user) && typeof user.email === 'string' && user.email.trim() ? user.email.trim() : null;
  if ((workspace !== undefined && workspace !== null && workspaceName === null) || (user !== undefined && user !== null && userEmail === null)) return null;
  return {
    openFindingsCount: count(value.stats.openFindings) ? value.stats.openFindings : null,
    workspaceName,
    userEmail,
  };
}

/** Guard the overview envelope before the dashboard dereferences nested collections. */
export function isOverviewResponse(value: unknown): boolean {
  if (!record(value) || !record(value.stats) || !Array.isArray(value.repositories) || !Array.isArray(value.recentActivities)
    || !Array.isArray(value.recentProviderChanges) || !Array.isArray(value.findingsThisWeek) || !Array.isArray(value.recentFixes)) return false;
  const stats = value.stats;
  return statKeys.every((key) => count(stats[key]));
}
