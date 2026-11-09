export type MigrationWorkbenchProjection = {
  id: string;
  finding_id: string;
  repository_id: string;
  plan_id: string;
  status: string;
  patch_diff: string;
  patch_digest: string;
  created_at: string;
  finding_title: string;
  symbol: string;
  file_path: string;
  line_number: number;
  change_id: string;
  repo_name: string;
  repo_full_name: string;
  pr_number?: number | null;
  pr_url?: string | null;
  branch_name?: string | null;
  lifecycle_state?: 'Migration Planned' | 'Verification Pending' | 'Verification Passed' | 'Verification Failed' | 'Draft PR Created' | 'Pull Request Open' | 'Pull Request Closed' | 'Pull Request Merged' | 'Pull Request State Unavailable';
  pr_state?: string | null;
  execution_verified?: boolean;
};

const lifecycleStates = new Set<NonNullable<MigrationWorkbenchProjection['lifecycle_state']>>([
  'Migration Planned', 'Verification Pending', 'Verification Passed', 'Verification Failed', 'Draft PR Created',
  'Pull Request Open', 'Pull Request Closed', 'Pull Request Merged', 'Pull Request State Unavailable',
]);

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

function optionalText(value: unknown): string | null {
  return value === null || value === undefined ? null : text(value);
}

/** Validate the migration workbench projection before rendering review evidence. */
export function parseMigrationWorkbenchCollection(payload: unknown): MigrationWorkbenchProjection[] | null {
  if (!record(payload) || !Array.isArray(payload.migrations)) return null;
  const seen = new Set<string>();
  const migrations: MigrationWorkbenchProjection[] = [];
  for (const item of payload.migrations) {
    if (!record(item) || typeof item.line_number !== 'number' || !Number.isSafeInteger(item.line_number) || item.line_number < 1) return null;
    const id = text(item.id);
    const findingId = text(item.finding_id);
    const repositoryId = text(item.repository_id);
    const planId = text(item.plan_id);
    const status = text(item.status);
    const findingTitle = text(item.finding_title);
    const symbol = text(item.symbol);
    const filePath = text(item.file_path);
    const changeId = text(item.change_id);
    const repoName = text(item.repo_name);
    const repoFullName = text(item.repo_full_name);
    const lifecycleState = item.lifecycle_state === undefined || item.lifecycle_state === null ? undefined : item.lifecycle_state;
    if (!id || !findingId || !repositoryId || !planId || !status || !findingTitle || !symbol || !filePath || !changeId || !repoName || !repoFullName
      || seen.has(id) || (lifecycleState !== undefined && (typeof lifecycleState !== 'string' || !lifecycleStates.has(lifecycleState as NonNullable<MigrationWorkbenchProjection['lifecycle_state']>)))
      || (item.pr_number !== undefined && item.pr_number !== null && (typeof item.pr_number !== 'number' || !Number.isSafeInteger(item.pr_number) || item.pr_number < 1))) return null;
    seen.add(id);
    migrations.push({
      id, finding_id: findingId, repository_id: repositoryId, plan_id: planId, status,
      patch_diff: typeof item.patch_diff === 'string' ? item.patch_diff : '',
      patch_digest: typeof item.patch_digest === 'string' ? item.patch_digest.trim() : '',
      created_at: typeof item.created_at === 'string' ? item.created_at : '',
      finding_title: findingTitle, symbol, file_path: filePath, line_number: item.line_number,
      change_id: changeId, repo_name: repoName, repo_full_name: repoFullName,
      ...(item.pr_number === undefined ? {} : { pr_number: item.pr_number === null ? null : item.pr_number }),
      pr_url: optionalText(item.pr_url), branch_name: optionalText(item.branch_name),
      ...(lifecycleState === undefined ? {} : { lifecycle_state: lifecycleState as NonNullable<MigrationWorkbenchProjection['lifecycle_state']> }),
      ...(item.pr_state === undefined ? {} : { pr_state: optionalText(item.pr_state) }),
      execution_verified: item.execution_verified === true,
    });
  }
  return migrations;
}
