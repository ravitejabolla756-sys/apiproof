const statKeys = ['connectedRepositories', 'scansCompleted', 'openFindings', 'criticalFindings', 'draftPrsCount', 'providerRulesPending', 'providerRulesApproved', 'rescansPending', 'rescansProcessing', 'rescansFailed'] as const;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function count(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

/** Guard the overview envelope before the dashboard dereferences nested collections. */
export function isOverviewResponse(value: unknown): boolean {
  if (!record(value) || !record(value.stats) || !Array.isArray(value.repositories) || !Array.isArray(value.recentActivities)
    || !Array.isArray(value.recentProviderChanges) || !Array.isArray(value.findingsThisWeek) || !Array.isArray(value.recentFixes)) return false;
  const stats = value.stats;
  return statKeys.every((key) => count(stats[key]));
}
