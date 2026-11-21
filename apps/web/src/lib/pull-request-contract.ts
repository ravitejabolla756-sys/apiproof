export interface PullRequestItem {
  id: string;
  number: number;
  title: string;
  branch_name: string;
  base_branch: string;
  url: string;
  state: string;
  created_at: string;
  patch_digest: string;
  repo_name: string;
  repo_full_name: string;
  symbol: string;
  file_path: string;
  change_id: string;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}

function text(value: unknown, maxLength: number): string | undefined {
  return typeof value === 'string' && value.length > 0 && value.length <= maxLength ? value : undefined;
}

function parsePullRequest(value: unknown): PullRequestItem | undefined {
  const row = record(value);
  if (!row) return undefined;
  const id = text(row.id, 256);
  const number = Number.isSafeInteger(row.number) && (row.number as number) >= 1 ? row.number as number : undefined;
  const title = text(row.title, 512);
  const branchName = text(row.branch_name, 256);
  const baseBranch = text(row.base_branch, 256);
  const url = text(row.url, 2048);
  const state = text(row.state, 64);
  const createdAt = text(row.created_at, 128);
  const patchDigest = text(row.patch_digest, 512);
  const repoName = text(row.repo_name, 256);
  const repoFullName = text(row.repo_full_name, 512);
  const symbol = text(row.symbol, 512);
  const filePath = text(row.file_path, 2000);
  const changeId = text(row.change_id, 256);
  if (!id || number === undefined || !title || !branchName || !baseBranch || !url || !/^https:\/\//i.test(url) || !state || !createdAt || !patchDigest || !repoName || !repoFullName || !symbol || !filePath || !changeId) return undefined;
  return { id, number, title, branch_name: branchName, base_branch: baseBranch, url, state, created_at: createdAt, patch_digest: patchDigest, repo_name: repoName, repo_full_name: repoFullName, symbol, file_path: filePath, change_id: changeId };
}

export function parsePullRequestResponse(value: unknown): PullRequestItem[] | undefined {
  const payload = record(value);
  if (!payload || !Array.isArray(payload.pullRequests) || payload.pullRequests.length > 2048) return undefined;
  const pullRequests = payload.pullRequests.map(parsePullRequest);
  return pullRequests.every((pullRequest): pullRequest is PullRequestItem => Boolean(pullRequest)) ? pullRequests : undefined;
}
