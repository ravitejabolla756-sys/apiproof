import { toSafeExternalUrl } from './external-link-contract.js';

export type PullRequestProjection = {
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
}

/** Validate the server-owned pull-request collection before rendering provider data. */
export function parsePullRequestCollection(payload: unknown): PullRequestProjection[] | null {
  if (!isRecord(payload) || !Array.isArray(payload.pullRequests)) return null;
  const seen = new Set<string>();
  const pullRequests: PullRequestProjection[] = [];
  for (const item of payload.pullRequests) {
    if (!isRecord(item)) return null;
    const number = item.number;
    if (typeof number !== 'number' || !Number.isSafeInteger(number) || number <= 0) return null;
    const id = text(item.id);
    const title = text(item.title);
    const branchName = text(item.branch_name);
    const baseBranch = text(item.base_branch);
    const state = text(item.state);
    const repoName = text(item.repo_name);
    const repoFullName = text(item.repo_full_name);
    const symbol = text(item.symbol);
    const filePath = text(item.file_path);
    const changeId = text(item.change_id);
    if (!id || !title || !branchName || !baseBranch || !state || !repoName || !repoFullName || !symbol || !filePath || !changeId || seen.has(id)) return null;
    seen.add(id);
    pullRequests.push({
      id,
      number,
      title,
      branch_name: branchName,
      base_branch: baseBranch,
      url: typeof item.url === 'string' ? item.url.trim() : '',
      state,
      created_at: typeof item.created_at === 'string' ? item.created_at : '',
      patch_digest: typeof item.patch_digest === 'string' ? item.patch_digest.trim() : '',
      repo_name: repoName,
      repo_full_name: repoFullName,
      symbol,
      file_path: filePath,
      change_id: changeId,
    });
  }
  return pullRequests;
}

/**
 * Keep provider-supplied pull-request links inert unless they are absolute,
 * credential-free HTTPS URLs. Host allowlisting remains a shared backend
 * contract decision and is intentionally not inferred by this adapter.
 */
export function toSafePullRequestUrl(value: string | null | undefined): string | null {
  return toSafeExternalUrl(value);
}
