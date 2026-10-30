import { getDatabase } from '@/lib/server/db';

export interface DashboardData {
  repositoryCount: number;
  scanCount: number;
  openFindingCount: number;
  hasGitHubInstallation: boolean;
  installationStatus: string;
  installationAccount: string | null;
  stats: {
    connectedRepositories: number;
    scansCompleted: number;
    openFindings: number;
    criticalFindings: number;
    draftPrsCount: number;
    providerRulesPending: number;
    providerRulesApproved: number;
    rescansPending: number;
    rescansProcessing: number;
    rescansFailed: number;
  };
  repositories: Array<{
    id: string;
    name: string;
    owner: string;
    full_name: string;
    default_branch: string;
    status: string;
    last_scan_at: string | null;
    findings_count: number;
  }>;
  criticalFinding: {
    id: string;
    title: string;
    description: string;
    severity: string;
    symbol: string;
    file_path: string;
    status: string;
    repo_name: string;
    repo_full_name: string;
  } | null;
  recentActivities: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    created_at: string;
    repo_name: string | null;
  }>;
  recentProviderChanges: Array<{
    id: string;
    provider_id: string;
    title: string;
    description: string;
    source_url: string;
    published_at: string | null;
    first_seen_at: string;
  }>;
  findingsThisWeek: Array<{
    day: string;
    total: number;
    critical: number;
    high: number;
    warning: number;
  }>;
  recentFixes: Array<{
    id: string;
    status: string;
    created_at: string;
    finding_title: string;
    repo_name: string;
    pr_url: string | null;
    pr_state: string | null;
  }>;
}

export async function getDashboardData(workspaceId: string): Promise<DashboardData> {
  const db = getDatabase();
  const repoStats = await db.queryOne<{ count: number }>(`
    SELECT COUNT(*) AS count FROM repositories WHERE workspace_id = ? AND lifecycle = 'active'
  `, [workspaceId]);
  const scanStats = await db.queryOne<{ count: number }>(`
    SELECT COUNT(*) AS count FROM scans s
    JOIN repositories r ON r.id = s.repository_id
    WHERE r.workspace_id = ? AND r.lifecycle = 'active' AND s.status = 'completed'
  `, [workspaceId]);
  const findingStats = await db.queryOne<{ open_count: number | null; critical_count: number | null }>(`
    SELECT SUM(CASE WHEN f.status = 'open' THEN 1 ELSE 0 END) AS open_count,
           SUM(CASE WHEN f.severity = 'critical' AND f.status = 'open' THEN 1 ELSE 0 END) AS critical_count
    FROM findings f JOIN repositories r ON r.id = f.repository_id
    WHERE r.workspace_id = ? AND r.lifecycle = 'active'
  `, [workspaceId]);
  const prStats = await db.queryOne<{ count: number }>(`
    SELECT COUNT(*) AS count FROM pull_requests pr
    JOIN repositories r ON r.id = pr.repository_id
    WHERE r.workspace_id = ? AND r.lifecycle = 'active'
  `, [workspaceId]);
  const providerStats = await db.queryOne<{
    pending_rules: number; approved_rules: number; pending_rescans: number;
    processing_rescans: number; failed_rescans: number;
  }>(`
    SELECT
      (SELECT COUNT(*) FROM provider_rule_candidates WHERE status = 'needs_review') AS pending_rules,
      (SELECT COUNT(*) FROM provider_rule_candidates WHERE status = 'approved') AS approved_rules,
      (SELECT COUNT(*) FROM provider_rescan_jobs j JOIN repositories r ON r.id = j.repository_id WHERE r.workspace_id = ? AND j.status = 'pending') AS pending_rescans,
      (SELECT COUNT(*) FROM provider_rescan_jobs j JOIN repositories r ON r.id = j.repository_id WHERE r.workspace_id = ? AND j.status = 'processing') AS processing_rescans,
      (SELECT COUNT(*) FROM provider_rescan_jobs j JOIN repositories r ON r.id = j.repository_id WHERE r.workspace_id = ? AND j.status = 'failed') AS failed_rescans
  `, [workspaceId, workspaceId, workspaceId]);
  const repositories = await db.query<DashboardData['repositories'][number]>(`
    SELECT r.id, r.name, r.owner, r.full_name, r.default_branch, r.status, r.last_scan_at,
           (SELECT COUNT(*) FROM findings f WHERE f.repository_id = r.id) AS findings_count
    FROM repositories r WHERE r.workspace_id = ? AND r.lifecycle = 'active'
    ORDER BY r.created_at DESC
  `, [workspaceId]);
  const criticalFinding = await db.queryOne<NonNullable<DashboardData['criticalFinding']>>(`
    SELECT f.id, f.title, f.description, f.severity, f.symbol, f.file_path, f.status,
           r.name AS repo_name, r.full_name AS repo_full_name
    FROM findings f JOIN repositories r ON r.id = f.repository_id
    WHERE r.workspace_id = ? AND r.lifecycle = 'active'
    ORDER BY CASE f.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 ELSE 3 END, f.created_at DESC
    LIMIT 1
  `, [workspaceId]);
  const recentActivities = await db.query<DashboardData['recentActivities'][number]>(`
    SELECT a.id, a.type, a.title, a.description, a.created_at, r.name AS repo_name
    FROM activity_events a JOIN repositories r ON r.id = a.repository_id
    WHERE r.workspace_id = ? AND r.lifecycle = 'active'
    ORDER BY a.created_at DESC LIMIT 6
  `, [workspaceId]);
  const recentProviderChanges = await db.query<DashboardData['recentProviderChanges'][number]>(`
    SELECT id, provider_id, title, description, source_url, published_at, first_seen_at
    FROM provider_changelog_entries
    ORDER BY COALESCE(published_at, first_seen_at) DESC, id DESC LIMIT 6
  `);
  const findingsThisWeek = await db.query<DashboardData['findingsThisWeek'][number]>(`
    SELECT date(f.created_at) AS day, COUNT(*) AS total,
           SUM(CASE WHEN f.severity = 'critical' THEN 1 ELSE 0 END) AS critical,
           SUM(CASE WHEN f.severity = 'high' THEN 1 ELSE 0 END) AS high,
           SUM(CASE WHEN f.severity NOT IN ('critical', 'high') THEN 1 ELSE 0 END) AS warning
    FROM findings f JOIN repositories r ON r.id = f.repository_id
    WHERE r.workspace_id = ? AND r.lifecycle = 'active' AND f.created_at >= datetime('now', '-7 days')
    GROUP BY date(f.created_at) ORDER BY day ASC
  `, [workspaceId]);
  const recentFixes = await db.query<DashboardData['recentFixes'][number]>(`
    SELECT m.id, m.status, m.created_at, f.title AS finding_title, r.name AS repo_name,
           pr.url AS pr_url, pr.state AS pr_state
    FROM migrations m JOIN findings f ON f.id = m.finding_id JOIN repositories r ON r.id = m.repository_id
    LEFT JOIN pull_requests pr ON pr.migration_id = m.id
    WHERE r.workspace_id = ? AND r.lifecycle = 'active'
    ORDER BY m.created_at DESC LIMIT 6
  `, [workspaceId]);
  const installation = await db.queryOne<{ status: string; account_login: string }>(`
    SELECT status, account_login FROM github_installations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 1
  `, [workspaceId]);
  const connectedRepositories = Number(repoStats?.count ?? 0);
  const scansCompleted = Number(scanStats?.count ?? 0);
  const openFindings = Number(findingStats?.open_count ?? 0);
  return {
    repositoryCount: connectedRepositories,
    scanCount: scansCompleted,
    openFindingCount: openFindings,
    hasGitHubInstallation: Boolean(installation?.status === 'active'),
    installationStatus: installation?.status ?? 'none',
    installationAccount: installation?.account_login ?? null,
    stats: {
      connectedRepositories, scansCompleted, openFindings,
      criticalFindings: Number(findingStats?.critical_count ?? 0),
      draftPrsCount: Number(prStats?.count ?? 0),
      providerRulesPending: Number(providerStats?.pending_rules ?? 0),
      providerRulesApproved: Number(providerStats?.approved_rules ?? 0),
      rescansPending: Number(providerStats?.pending_rescans ?? 0),
      rescansProcessing: Number(providerStats?.processing_rescans ?? 0),
      rescansFailed: Number(providerStats?.failed_rescans ?? 0),
    },
    repositories, criticalFinding: criticalFinding ?? null, recentActivities,
    recentProviderChanges, findingsThisWeek, recentFixes,
  };
}
