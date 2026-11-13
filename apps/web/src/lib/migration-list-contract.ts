export type MigrationLifecycleState =
  | 'Migration Planned'
  | 'Verification Pending'
  | 'Verification Passed'
  | 'Verification Failed'
  | 'Draft PR Created'
  | 'Pull Request Open'
  | 'Pull Request Closed'
  | 'Pull Request Merged'
  | 'Pull Request State Unavailable';

export interface MigrationListItem {
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
  pr_number: number | null;
  pr_url: string | null;
  branch_name: string | null;
  lifecycle_state: MigrationLifecycleState;
  pr_state: string | null;
  execution_verified: boolean;
}

const MAX_ITEMS = 1024;
const MAX_PATCH_SIZE = 1024 * 1024;

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function text(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function nullableText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null) return null;
  return text(value, maxLength);
}

function safeInteger(value: unknown, minimum = 0): number | undefined {
  return Number.isSafeInteger(value) && (value as number) >= minimum ? value as number : undefined;
}

function parseItem(value: unknown): MigrationListItem | undefined {
  const row = record(value);
  if (!row) return undefined;
  const id = text(row.id, 256);
  const findingId = text(row.finding_id, 256);
  const repositoryId = text(row.repository_id, 256);
  const planId = text(row.plan_id, 256);
  const status = text(row.status, 128);
  const patchDiff = text(row.patch_diff, MAX_PATCH_SIZE);
  const patchDigest = text(row.patch_digest, 512);
  const createdAt = text(row.created_at, 128);
  const findingTitle = text(row.finding_title, 512);
  const symbol = text(row.symbol, 512);
  const filePath = text(row.file_path, 2000);
  const lineNumber = safeInteger(row.line_number, 1);
  const changeId = text(row.change_id, 256);
  const repoName = text(row.repo_name, 256);
  const repoFullName = text(row.repo_full_name, 512);
  const prNumber = row.pr_number === null ? null : safeInteger(row.pr_number, 1);
  const prUrl = nullableText(row.pr_url, 2048);
  const branchName = nullableText(row.branch_name, 256);
  const lifecycleState = row.lifecycle_state;
  const prState = nullableText(row.pr_state, 64);
  const executionVerified = row.execution_verified;
  const validLifecycle = lifecycleState === 'Migration Planned' || lifecycleState === 'Verification Pending' || lifecycleState === 'Verification Passed' || lifecycleState === 'Verification Failed' || lifecycleState === 'Draft PR Created' || lifecycleState === 'Pull Request Open' || lifecycleState === 'Pull Request Closed' || lifecycleState === 'Pull Request Merged' || lifecycleState === 'Pull Request State Unavailable';
  if (!id || !findingId || !repositoryId || !planId || !status || !patchDiff || !patchDigest || !createdAt || !findingTitle || !symbol || !filePath || lineNumber === undefined || !changeId || !repoName || !repoFullName || (row.pr_number !== null && prNumber === undefined) || prUrl === undefined || branchName === undefined || !validLifecycle || prState === undefined || typeof executionVerified !== 'boolean') return undefined;
  if (prUrl !== null && !/^https:\/\//i.test(prUrl)) return undefined;
  const normalizedPrNumber: number | null = prNumber ?? null;
  return { id, finding_id: findingId, repository_id: repositoryId, plan_id: planId, status, patch_diff: patchDiff, patch_digest: patchDigest, created_at: createdAt, finding_title: findingTitle, symbol, file_path: filePath, line_number: lineNumber, change_id: changeId, repo_name: repoName, repo_full_name: repoFullName, pr_number: normalizedPrNumber, pr_url: prUrl, branch_name: branchName, lifecycle_state: lifecycleState as MigrationLifecycleState, pr_state: prState, execution_verified: executionVerified };
}

export function parseMigrationListResponse(value: unknown): MigrationListItem[] | undefined {
  const payload = record(value);
  if (!payload || !Array.isArray(payload.migrations) || payload.migrations.length > MAX_ITEMS) return undefined;
  const migrations = payload.migrations.map(parseItem);
  return migrations.every((migration): migration is MigrationListItem => Boolean(migration)) ? migrations : undefined;
}
