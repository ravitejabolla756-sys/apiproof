import type { GitHubOperation } from './types.js';

export interface GitHubControlledWriteTransport {
  createBranchRef(branchName: string, sha: string): Promise<{ ref: string; sha: string }>;
  createCommit(branchName: string, files: Record<string, string>, message: string): Promise<{ sha: string }>;
  createPullRequest(input: { branch: string; title: string; body: string; base: string; draft?: boolean }): Promise<{ number: number; url: string }>;
  operationAllowed(operation: GitHubOperation): boolean;
}

export const PERMITTED_WRITE_OPERATIONS: readonly GitHubOperation[] = [
  'CREATE_APIPROOF_BRANCH',
  'WRITE_AUTHORIZED_FILES',
  'CREATE_APIPROOF_COMMIT',
  'CREATE_PULL_REQUEST',
] as const;

export const STRICTLY_FORBIDDEN_WRITE_OPERATIONS: readonly GitHubOperation[] = [
  'MERGE_PULL_REQUEST',
  'ENABLE_AUTO_MERGE',
  'PUSH_DEFAULT_BRANCH',
  'FORCE_PUSH',
  'EDIT_REPOSITORY_SETTINGS',
  'EDIT_BRANCH_PROTECTION',
  'EDIT_SECRETS',
  'EDIT_ACTIONS',
  'CREATE_RELEASE',
  'CREATE_DEPLOYMENT',
] as const;

export function validateWriteEndpoint(method: string, path: string): { valid: boolean; reason?: string } {
  const m = method.toUpperCase();
  const p = path.replace(/\\/g, '/');

  if (m !== 'POST' && m !== 'PATCH') {
    return { valid: false, reason: `GITHUB_ENDPOINT_NOT_ALLOWED: Method ${m} is not permitted for controlled writes.` };
  }

  if (p.includes('..') || p.includes('/merges') || p.includes('/merge') || p.includes('/releases') || p.includes('/actions/') || p.includes('/workflows/') || p.includes('/secrets/') || p.includes('/settings') || p.includes('/collaborators') || p.includes('/protection')) {
    return { valid: false, reason: `GITHUB_ENDPOINT_NOT_ALLOWED: Target path ${p} contains forbidden operation endpoint.` };
  }

  if (m === 'POST' && p.endsWith('/git/refs')) return { valid: true };
  if (m === 'POST' && p.endsWith('/git/trees')) return { valid: true };
  if (m === 'POST' && p.endsWith('/git/commits')) return { valid: true };
  if (m === 'POST' && p.endsWith('/pulls')) return { valid: true };
  if (m === 'PATCH' && p.includes('/git/refs/heads/apiproof/')) {
    if (p.endsWith('/main') || p.endsWith('/master') || p.endsWith('/develop')) {
      return { valid: false, reason: `GITHUB_ENDPOINT_NOT_ALLOWED: Cannot PATCH default or protected branch ${p}.` };
    }
    return { valid: true };
  }

  return { valid: false, reason: `GITHUB_ENDPOINT_NOT_ALLOWED: Endpoint ${m} ${p} is not in the controlled write allowlist.` };
}

export class DisabledGitHubWriteTransport implements GitHubControlledWriteTransport {
  operationAllowed(operation: GitHubOperation): boolean {
    if (STRICTLY_FORBIDDEN_WRITE_OPERATIONS.includes(operation)) return false;
    return (PERMITTED_WRITE_OPERATIONS as readonly GitHubOperation[]).includes(operation);
  }

  async createBranchRef(_branchName: string, _sha: string): Promise<{ ref: string; sha: string }> {
    throw new Error('GITHUB_WRITE_DISABLED: Remote writes are strictly disabled in this phase.');
  }

  async createCommit(_branchName: string, _files: Record<string, string>, _message: string): Promise<{ sha: string }> {
    throw new Error('GITHUB_WRITE_DISABLED: Remote writes are strictly disabled in this phase.');
  }

  async createPullRequest(_input: { branch: string; title: string; body: string; base: string; draft?: boolean }): Promise<{ number: number; url: string }> {
    throw new Error('GITHUB_WRITE_DISABLED: Remote writes are strictly disabled in this phase.');
  }
}
