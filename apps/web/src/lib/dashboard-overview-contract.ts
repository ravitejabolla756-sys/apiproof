export interface OverviewData {
  workspace: { id: string; name: string; slug: string; role: string; repositoryCount: number; scanCount: number; openFindingCount: number; hasGitHubInstallation: boolean; installationStatus: string; installationAccount: string | null };
  stats: { connectedRepositories: number; scansCompleted: number; openFindings: number; criticalFindings: number; draftPrsCount: number; providerRulesPending: number; providerRulesApproved: number; rescansPending: number; rescansProcessing: number; rescansFailed: number };
  repositories: Array<{ id: string; name: string; owner: string; full_name: string; default_branch: string; status: string; last_scan_at: string | null; findings_count: number }>;
  criticalFinding: { id: string; title: string; description: string; severity: string; symbol: string; file_path: string; status: string; repo_name: string; repo_full_name: string } | null;
  recentActivities: Array<{ id: string; type: string; title: string; description: string; created_at: string; repo_name: string | null }>;
  recentProviderChanges: Array<{ id: string; provider_id: string; title: string; description: string; source_url: string; published_at: string | null; first_seen_at: string }>;
  findingsThisWeek: Array<{ day: string; total: number; critical: number; high: number; warning: number }>;
  recentFixes: Array<{ id: string; status: string; created_at: string; finding_title: string; repo_name: string; pr_url: string | null; pr_state: string | null }>;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function nullableText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) return null;
  return text(value, maxLength);
}

function count(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= 0 ? value as number : undefined;
}

function parseRepository(value: unknown): OverviewData['repositories'][number] | undefined {
  const row = record(value);
  if (!row) return undefined;
  const id = text(row.id, 256); const name = text(row.name, 256); const owner = text(row.owner, 256);
  const fullName = text(row.full_name, 512); const branch = text(row.default_branch, 256); const status = text(row.status, 128);
  const lastScanAt = nullableText(row.last_scan_at, 128); const findings = count(row.findings_count);
  return id && name && owner && fullName && branch && status && lastScanAt !== undefined && findings !== undefined
    ? { id, name, owner, full_name: fullName, default_branch: branch, status, last_scan_at: lastScanAt, findings_count: findings } : undefined;
}

function parseStats(value: unknown): OverviewData['stats'] | undefined {
  const row = record(value);
  if (!row) return undefined;
  const keys = ['connectedRepositories', 'scansCompleted', 'openFindings', 'criticalFindings', 'draftPrsCount', 'providerRulesPending', 'providerRulesApproved', 'rescansPending', 'rescansProcessing', 'rescansFailed'] as const;
  const values = Object.fromEntries(keys.map((key) => [key, count(row[key])]));
  return keys.every((key) => values[key] !== undefined) ? values as OverviewData['stats'] : undefined;
}

function parseCritical(value: unknown): OverviewData['criticalFinding'] | null | undefined {
  if (value === null) return null;
  const row = record(value);
  if (!row) return undefined;
  const fields = { id: text(row.id, 256), title: text(row.title, 512), description: text(row.description, 4000), severity: text(row.severity, 128), symbol: text(row.symbol, 512), file_path: text(row.file_path, 2000), status: text(row.status, 128), repo_name: text(row.repo_name, 256), repo_full_name: text(row.repo_full_name, 512) };
  return Object.values(fields).every((field) => field !== undefined) ? fields as OverviewData['criticalFinding'] : undefined;
}

function parseActivity(value: unknown): OverviewData['recentActivities'][number] | undefined {
  const row = record(value); if (!row) return undefined;
  const id = text(row.id, 256); const type = text(row.type, 128); const title = text(row.title, 512); const description = text(row.description, 4000); const createdAt = text(row.created_at, 128); const repoName = nullableText(row.repo_name, 256);
  return id && type && title && description && createdAt && repoName !== undefined ? { id, type, title, description, created_at: createdAt, repo_name: repoName } : undefined;
}

function parseProviderChange(value: unknown): OverviewData['recentProviderChanges'][number] | undefined {
  const row = record(value); if (!row) return undefined;
  const id = text(row.id, 256); const providerId = text(row.provider_id, 256); const title = text(row.title, 512); const description = text(row.description, 4000); const sourceUrl = text(row.source_url, 2048); const publishedAt = nullableText(row.published_at, 128); const firstSeenAt = text(row.first_seen_at, 128);
  return id && providerId && title && description && sourceUrl && /^https:\/\//i.test(sourceUrl) && publishedAt !== undefined && firstSeenAt ? { id, provider_id: providerId, title, description, source_url: sourceUrl, published_at: publishedAt, first_seen_at: firstSeenAt } : undefined;
}

function parseWeek(value: unknown): OverviewData['findingsThisWeek'][number] | undefined {
  const row = record(value); if (!row) return undefined;
  const day = text(row.day, 32); const total = count(row.total); const critical = count(row.critical); const high = count(row.high); const warning = count(row.warning);
  return day && total !== undefined && critical !== undefined && high !== undefined && warning !== undefined ? { day, total, critical, high, warning } : undefined;
}

function parseFix(value: unknown): OverviewData['recentFixes'][number] | undefined {
  const row = record(value); if (!row) return undefined;
  const id = text(row.id, 256); const status = text(row.status, 128); const createdAt = text(row.created_at, 128); const title = text(row.finding_title, 512); const repoName = text(row.repo_name, 256); const prUrl = nullableText(row.pr_url, 2048); const prState = nullableText(row.pr_state, 64);
  return id && status && createdAt && title && repoName && prUrl !== undefined && prState !== undefined && (prUrl === null || /^https:\/\//i.test(prUrl)) ? { id, status, created_at: createdAt, finding_title: title, repo_name: repoName, pr_url: prUrl, pr_state: prState } : undefined;
}

export function parseOverviewResponse(value: unknown): OverviewData | undefined {
  const payload = record(value); if (!payload) return undefined;
  const workspaceRow = record(payload.workspace); const workspaceStats = workspaceRow ? { id: text(workspaceRow.id, 256), name: text(workspaceRow.name, 512), slug: text(workspaceRow.slug, 256), role: text(workspaceRow.role, 128), repositoryCount: count(workspaceRow.repositoryCount), scanCount: count(workspaceRow.scanCount), openFindingCount: count(workspaceRow.openFindingCount), hasGitHubInstallation: workspaceRow.hasGitHubInstallation, installationStatus: text(workspaceRow.installationStatus, 128), installationAccount: nullableText(workspaceRow.installationAccount, 256) } : undefined;
  const stats = parseStats(payload.stats);
  const repositories = Array.isArray(payload.repositories) && payload.repositories.length <= 2048 ? payload.repositories.map(parseRepository) : undefined;
  const criticalFinding = parseCritical(payload.criticalFinding);
  const recentActivities = Array.isArray(payload.recentActivities) && payload.recentActivities.length <= 128 ? payload.recentActivities.map(parseActivity) : undefined;
  const recentProviderChanges = Array.isArray(payload.recentProviderChanges) && payload.recentProviderChanges.length <= 128 ? payload.recentProviderChanges.map(parseProviderChange) : undefined;
  const findingsThisWeek = Array.isArray(payload.findingsThisWeek) && payload.findingsThisWeek.length <= 31 ? payload.findingsThisWeek.map(parseWeek) : undefined;
  const recentFixes = Array.isArray(payload.recentFixes) && payload.recentFixes.length <= 128 ? payload.recentFixes.map(parseFix) : undefined;
  if (!workspaceStats || typeof workspaceStats.hasGitHubInstallation !== 'boolean' || workspaceStats.repositoryCount === undefined || workspaceStats.scanCount === undefined || workspaceStats.openFindingCount === undefined || workspaceStats.installationStatus === undefined || workspaceStats.installationAccount === undefined || !stats || !repositories || !repositories.every(Boolean) || criticalFinding === undefined || !recentActivities || !recentActivities.every(Boolean) || !recentProviderChanges || !recentProviderChanges.every(Boolean) || !findingsThisWeek || !findingsThisWeek.every(Boolean) || !recentFixes || !recentFixes.every(Boolean)) return undefined;
  return { workspace: workspaceStats as OverviewData['workspace'], stats, repositories: repositories as OverviewData['repositories'], criticalFinding, recentActivities: recentActivities as OverviewData['recentActivities'], recentProviderChanges: recentProviderChanges as OverviewData['recentProviderChanges'], findingsThisWeek: findingsThisWeek as OverviewData['findingsThisWeek'], recentFixes: recentFixes as OverviewData['recentFixes'] };
}
