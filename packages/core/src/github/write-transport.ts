import type { GitHubOperation } from './types.js';
import type { GitHubAppConfig } from './config.js';
import type { InstallationTokenProvider } from './live-provider.js';

export interface GitHubControlledWriteTransport {
  createBranchRef(branchName: string, sha: string): Promise<{ ref: string; sha: string }>;
  createCommit(branchName: string, files: Record<string, string>, message: string, parentSha?: string): Promise<{ sha: string }>;
  createPullRequest(input: { branch: string; title: string; body: string; base: string; draft?: boolean }): Promise<{ number: number; url: string }>;
  getBranchRef?(branchName: string): Promise<{ ref: string; sha: string } | null>;
  findOpenPullRequestByHead?(branchName: string): Promise<{ number: number; url: string; title: string; body: string; head: string; base: string; draft: boolean } | null>;
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

  if (
    p.includes('..') ||
    p.includes('/merges') ||
    p.includes('/merge') ||
    p.includes('/releases') ||
    p.includes('/actions/') ||
    p.includes('/workflows/') ||
    p.includes('/secrets/') ||
    p.includes('/settings') ||
    p.includes('/collaborators') ||
    p.includes('/protection')
  ) {
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

  async createCommit(_branchName: string, _files: Record<string, string>, _message: string, _parentSha?: string): Promise<{ sha: string }> {
    throw new Error('GITHUB_WRITE_DISABLED: Remote writes are strictly disabled in this phase.');
  }

  async createPullRequest(_input: { branch: string; title: string; body: string; base: string; draft?: boolean }): Promise<{ number: number; url: string }> {
    throw new Error('GITHUB_WRITE_DISABLED: Remote writes are strictly disabled in this phase.');
  }
}

export interface ControlledWriteTransportOptions {
  workspaceAuthorized?: boolean;
}

export class FetchGitHubControlledWriteTransport implements GitHubControlledWriteTransport {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly config: GitHubAppConfig,
    private readonly tokens: InstallationTokenProvider,
    customFetch?: typeof fetch,
    private readonly baseUrl = 'https://api.github.com',
    private readonly options?: ControlledWriteTransportOptions
  ) {
    this.fetchImpl = customFetch ?? globalThis.fetch;
  }

  operationAllowed(operation: GitHubOperation): boolean {
    if (STRICTLY_FORBIDDEN_WRITE_OPERATIONS.includes(operation)) return false;
    return (PERMITTED_WRITE_OPERATIONS as readonly GitHubOperation[]).includes(operation);
  }

  private validatePreFlight(operation: {
    method: string;
    path: string;
    branchName?: string;
    baseBranch?: string;
    draft?: boolean;
    force?: boolean;
  }): void {
    if (this.options?.workspaceAuthorized) {
      if (!this.config.repositoryId || !/^\d+$/.test(this.config.repositoryId)) {
        throw new Error(`GITHUB_REPOSITORY_NOT_APPROVED: Write transport repository ID mismatch (${this.config.repositoryId})`);
      }
      if (!this.config.owner || !this.config.repository) {
        throw new Error(`GITHUB_REPOSITORY_NOT_APPROVED: Write transport target repository mismatch (${this.config.owner}/${this.config.repository})`);
      }
    } else {
      if (this.config.repositoryId !== '1363070568') {
        throw new Error(`GITHUB_REPOSITORY_NOT_APPROVED: Write transport repository ID mismatch (${this.config.repositoryId} !== 1363070568)`);
      }
      if (this.config.owner !== 'ravitejabolla756-sys' || this.config.repository !== 'apiproof-github-fixture') {
        throw new Error(`GITHUB_REPOSITORY_NOT_APPROVED: Write transport target repository mismatch (${this.config.owner}/${this.config.repository})`);
      }
    }

    if (operation.force === true) {
      throw new Error('GITHUB_OPERATION_REJECTED: Force operations are strictly forbidden.');
    }

    if (operation.branchName) {
      if (!operation.branchName.startsWith('apiproof/')) {
        throw new Error(`GITHUB_INVALID_BRANCH_NAME: Head branch '${operation.branchName}' must start with apiproof/ namespace.`);
      }
      if (operation.branchName === 'main' || operation.branchName === 'master' || operation.branchName === 'develop') {
        throw new Error(`GITHUB_INVALID_BRANCH_NAME: Cannot target default or protected branch '${operation.branchName}'.`);
      }
    }

    if (operation.baseBranch !== undefined && operation.baseBranch !== 'main') {
      throw new Error(`GITHUB_OPERATION_REJECTED: PR base branch '${operation.baseBranch}' must equal default branch main.`);
    }

    if (operation.draft !== undefined && operation.draft !== true) {
      throw new Error('GITHUB_OPERATION_REJECTED: PR creation must strictly set draft=true.');
    }

    const endpointCheck = validateWriteEndpoint(operation.method, operation.path);
    if (!endpointCheck.valid) {
      throw new Error(endpointCheck.reason);
    }
  }

  async getBranchRef(branchName: string): Promise<{ ref: string; sha: string } | null> {
    if (!branchName.startsWith('apiproof/')) {
      throw new Error(`GITHUB_INVALID_BRANCH_NAME: Head branch '${branchName}' must start with apiproof/ namespace.`);
    }
    const cleanRef = branchName.replace(/^refs\/heads\//, '');
    const path = `/repos/${this.config.owner}/${this.config.repository}/git/ref/heads/${encodeURIComponent(cleanRef)}`;
    const token = await this.tokens.getToken(this.config.installationId, this.config.repositoryId);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'APIProof-App' },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error('GITHUB_READ_FAILED');
    const data = (await response.json()) as { object?: { sha?: string }; ref?: string };
    return { ref: data.ref || `refs/heads/${branchName}`, sha: data.object?.sha || '' };
  }

  async findOpenPullRequestByHead(branchName: string): Promise<{ number: number; url: string; title: string; body: string; head: string; base: string; draft: boolean } | null> {
    if (!branchName.startsWith('apiproof/')) {
      throw new Error(`GITHUB_INVALID_BRANCH_NAME: Head branch '${branchName}' must start with apiproof/ namespace.`);
    }
    const headQuery = `${this.config.owner}:${branchName}`;
    const path = `/repos/${this.config.owner}/${this.config.repository}/pulls?head=${encodeURIComponent(headQuery)}&state=open`;
    const token = await this.tokens.getToken(this.config.installationId, this.config.repositoryId);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'APIProof-App' },
    });
    if (!response.ok) return null;
    const prs = (await response.json()) as Array<{
      number?: number;
      html_url?: string;
      title?: string;
      body?: string;
      head?: { ref?: string };
      base?: { ref?: string };
      draft?: boolean;
    }>;
    if (!Array.isArray(prs) || prs.length === 0) return null;
    const matching = prs.find((p) => p.head?.ref === branchName);
    if (!matching) return null;
    return {
      number: Number(matching.number),
      url: String(matching.html_url ?? ''),
      title: String(matching.title ?? ''),
      body: String(matching.body ?? ''),
      head: String(matching.head?.ref ?? ''),
      base: String(matching.base?.ref ?? ''),
      draft: matching.draft === true,
    };
  }

  async createBranchRef(branchName: string, sha: string): Promise<{ ref: string; sha: string }> {
    const path = `/repos/${this.config.owner}/${this.config.repository}/git/refs`;
    this.validatePreFlight({ method: 'POST', path, branchName });

    const token = await this.tokens.getToken(this.config.installationId, this.config.repositoryId);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'APIProof-App' },
      body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
    });

    if (response.ok) {
      return { ref: `refs/heads/${branchName}`, sha };
    }

    // GAP 1: If branch already exists (HTTP 422), check if existing ref matches expected baseline SHA
    if (response.status === 422) {
      const existing = await this.getBranchRef(branchName);
      if (existing && existing.sha === sha) {
        return { ref: `refs/heads/${branchName}`, sha };
      }
      if (existing && existing.sha !== sha) {
        throw new Error(`GITHUB_BRANCH_CONFLICT: Branch '${branchName}' already exists at unexpected SHA (${existing.sha} !== expected ${sha})`);
      }
    }

    throw new Error('GITHUB_WRITE_FAILED');
  }

  async createCommit(branchName: string, files: Record<string, string>, message: string, parentSha?: string): Promise<{ sha: string }> {
    const treePath = `/repos/${this.config.owner}/${this.config.repository}/git/trees`;
    const commitPath = `/repos/${this.config.owner}/${this.config.repository}/git/commits`;
    const refPath = `/repos/${this.config.owner}/${this.config.repository}/git/refs/heads/${branchName}`;

    this.validatePreFlight({ method: 'POST', path: treePath, branchName });
    this.validatePreFlight({ method: 'POST', path: commitPath, branchName });
    this.validatePreFlight({ method: 'PATCH', path: refPath, branchName });

    const token = await this.tokens.getToken(this.config.installationId, this.config.repositoryId);

    let baseTreeSha: string | undefined;
    if (parentSha) {
      const parentCommitPath = `/repos/${this.config.owner}/${this.config.repository}/git/commits/${parentSha}`;
      const parentRes = await this.fetchImpl(`${this.baseUrl}${parentCommitPath}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'APIProof-App' },
      });
      if (parentRes.ok) {
        const parentData = (await parentRes.json()) as { tree?: { sha?: string } };
        baseTreeSha = parentData.tree?.sha;
      }
    }

    const treeBody: Record<string, unknown> = {
      tree: Object.entries(files).map(([p, c]) => ({ path: p, mode: '100644', type: 'blob', content: c })),
    };
    if (baseTreeSha) {
      treeBody.base_tree = baseTreeSha;
    }

    // Create tree
    const treeRes = await this.fetchImpl(`${this.baseUrl}${treePath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'APIProof-App' },
      body: JSON.stringify(treeBody),
    });
    if (!treeRes.ok) throw new Error('GITHUB_WRITE_FAILED');
    const treeData = (await treeRes.json()) as { sha?: string };

    // Create commit
    const commitBody: Record<string, unknown> = {
      message,
      tree: treeData.sha,
      parents: parentSha ? [parentSha] : [],
    };
    const commitRes = await this.fetchImpl(`${this.baseUrl}${commitPath}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'APIProof-App' },
      body: JSON.stringify(commitBody),
    });
    if (!commitRes.ok) throw new Error('GITHUB_WRITE_FAILED');
    const commitData = (await commitRes.json()) as { sha?: string };

    // Update ref
    const refRes = await this.fetchImpl(`${this.baseUrl}${refPath}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'APIProof-App' },
      body: JSON.stringify({ sha: commitData.sha }),
    });
    if (!refRes.ok) throw new Error('GITHUB_WRITE_FAILED');

    return { sha: String(commitData.sha ?? '') };
  }

  async createPullRequest(input: { branch: string; title: string; body: string; base: string; draft?: boolean }): Promise<{ number: number; url: string }> {
    const path = `/repos/${this.config.owner}/${this.config.repository}/pulls`;
    this.validatePreFlight({ method: 'POST', path, branchName: input.branch, baseBranch: input.base, draft: input.draft ?? true });

    const token = await this.tokens.getToken(this.config.installationId, this.config.repositoryId);
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'APIProof-App' },
      body: JSON.stringify({ title: input.title, body: input.body, head: input.branch, base: input.base, draft: true }),
    });

    if (!response.ok) throw new Error('GITHUB_WRITE_FAILED');
    const data = (await response.json()) as { number?: number; html_url?: string };
    return { number: Number(data.number ?? 1), url: String(data.html_url ?? '') };
  }
}
