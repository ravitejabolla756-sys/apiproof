import type { GitHubOperation } from './types.js';
import {
  type GitHubControlledWriteTransport,
  PERMITTED_WRITE_OPERATIONS,
  STRICTLY_FORBIDDEN_WRITE_OPERATIONS,
  validateWriteEndpoint,
} from './write-transport.js';

export interface RecordedHttpCall {
  method: string;
  path: string;
  body?: unknown;
}

export class FakeGitHubWriteTransport implements GitHubControlledWriteTransport {
  public readonly recordedCalls: RecordedHttpCall[] = [];
  public readonly branches = new Map<string, string>();
  public readonly prs: Array<{
    number: number;
    url: string;
    title: string;
    body: string;
    head: string;
    base: string;
    draft: boolean;
  }> = [];

  public defaultBranchSha: string | undefined;
  public emptyRepository = false;

  constructor(
    private readonly repositoryOwner = 'ravitejabolla756-sys',
    private readonly repositoryName = 'apiproof-github-fixture',
    private readonly defaultBranch = 'main',
    defaultBranchSha?: string
  ) {
    this.defaultBranchSha = defaultBranchSha;
  }

  async getDefaultBranchSha(_branchName: string): Promise<string> {
    if (this.emptyRepository) {
      throw new Error(`GITHUB_REPOSITORY_EMPTY: Remote repository '${this.repositoryOwner}/${this.repositoryName}' has no commits on default branch '${this.defaultBranch}'.`);
    }
    return this.defaultBranchSha ?? '';
  }

  async getRepositoryDefaultBranch(): Promise<string> {
    return this.defaultBranch;
  }

  operationAllowed(operation: GitHubOperation): boolean {
    if (STRICTLY_FORBIDDEN_WRITE_OPERATIONS.includes(operation)) return false;
    return (PERMITTED_WRITE_OPERATIONS as readonly GitHubOperation[]).includes(operation);
  }

  async getBranchRef(branchName: string): Promise<{ ref: string; sha: string } | null> {
    if (!branchName.startsWith('apiproof/')) {
      throw new Error('GITHUB_INVALID_BRANCH_NAME: Branch name must start with apiproof/');
    }
    if (this.branches.has(branchName)) {
      return { ref: `refs/heads/${branchName}`, sha: this.branches.get(branchName)! };
    }
    return null;
  }

  async findOpenPullRequestByHead(branchName: string): Promise<{ number: number; url: string; title: string; body: string; head: string; base: string; draft: boolean } | null> {
    if (!branchName.startsWith('apiproof/')) {
      throw new Error('GITHUB_INVALID_BRANCH_NAME: Head branch must be in apiproof/* namespace');
    }
    const pr = this.prs.find((p) => p.head === branchName);
    if (!pr) return null;
    return { ...pr };
  }

  async createBranchRef(branchName: string, sha: string): Promise<{ ref: string; sha: string }> {
    if (!branchName.startsWith('apiproof/')) {
      throw new Error('GITHUB_INVALID_BRANCH_NAME: Branch name must start with apiproof/');
    }
    const path = `/repos/${this.repositoryOwner}/${this.repositoryName}/git/refs`;
    const check = validateWriteEndpoint('POST', path);
    if (!check.valid) throw new Error(check.reason);

    this.recordedCalls.push({
      method: 'POST',
      path,
      body: { ref: `refs/heads/${branchName}`, sha },
    });

    if (this.branches.has(branchName)) {
      const existingSha = this.branches.get(branchName);
      if (existingSha === sha) {
        return { ref: `refs/heads/${branchName}`, sha };
      }
      throw new Error(`GITHUB_BRANCH_CONFLICT: Branch '${branchName}' already exists at unexpected SHA (${existingSha} !== expected ${sha})`);
    }
    this.branches.set(branchName, sha);
    return { ref: `refs/heads/${branchName}`, sha };
  }

  async createCommit(branchName: string, files: Record<string, string>, message: string, parentSha?: string): Promise<{ sha: string }> {
    if (!branchName.startsWith('apiproof/')) {
      throw new Error('GITHUB_INVALID_BRANCH_NAME: Cannot commit to non-apiproof branch');
    }
    const treePath = `/repos/${this.repositoryOwner}/${this.repositoryName}/git/trees`;
    const commitPath = `/repos/${this.repositoryOwner}/${this.repositoryName}/git/commits`;
    const refPath = `/repos/${this.repositoryOwner}/${this.repositoryName}/git/refs/heads/${branchName}`;

    const checkTree = validateWriteEndpoint('POST', treePath);
    if (!checkTree.valid) throw new Error(checkTree.reason);
    this.recordedCalls.push({ method: 'POST', path: treePath, body: { files, base_tree: parentSha ? `${parentSha}-tree` : undefined } });

    const checkCommit = validateWriteEndpoint('POST', commitPath);
    if (!checkCommit.valid) throw new Error(checkCommit.reason);
    const newSha = `commit-sha-${Date.now()}`;
    this.recordedCalls.push({ method: 'POST', path: commitPath, body: { message, tree: 'tree-sha', parents: parentSha ? [parentSha] : [] } });

    const checkRef = validateWriteEndpoint('PATCH', refPath);
    if (!checkRef.valid) throw new Error(checkRef.reason);
    this.recordedCalls.push({ method: 'PATCH', path: refPath, body: { sha: newSha } });

    this.branches.set(branchName, newSha);
    return { sha: newSha };
  }

  async createPullRequest(input: {
    branch: string;
    title: string;
    body: string;
    base: string;
    draft?: boolean;
  }): Promise<{ number: number; url: string }> {
    if (input.base !== this.defaultBranch) {
      throw new Error(`GITHUB_OPERATION_REJECTED: Base branch must be default branch ${this.defaultBranch}`);
    }
    if (!input.branch.startsWith('apiproof/')) {
      throw new Error('GITHUB_INVALID_BRANCH_NAME: Head branch must be in apiproof/* namespace');
    }
    if (!input.draft) {
      throw new Error('GITHUB_OPERATION_REJECTED: PR must be opened as a draft for review safety');
    }

    const prPath = `/repos/${this.repositoryOwner}/${this.repositoryName}/pulls`;
    const checkPr = validateWriteEndpoint('POST', prPath);
    if (!checkPr.valid) throw new Error(checkPr.reason);

    const prNumber = this.prs.length + 1;
    const url = `https://github.com/${this.repositoryOwner}/${this.repositoryName}/pull/${prNumber}`;

    this.recordedCalls.push({
      method: 'POST',
      path: prPath,
      body: { title: input.title, head: input.branch, base: input.base, draft: true },
    });

    const pr = {
      number: prNumber,
      url,
      title: input.title,
      body: input.body,
      head: input.branch,
      base: input.base,
      draft: true,
    };
    this.prs.push(pr);

    return { number: prNumber, url };
  }
}
