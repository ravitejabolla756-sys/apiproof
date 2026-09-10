import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import type { RepositoryIdentity, GitHubOperation } from './types.js';
import type { SourceControlProvider } from './provider.js';
import type { GitHubAppConfig } from './config.js';

export interface InstallationTokenProvider {
  getToken(installationId: string, repositoryId: string): Promise<string>;
}

export interface GitHubReadTransport {
  request(path: string, token: string, options?: { method?: string }): Promise<{ status: number; body: unknown }>;
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

export const APPROVED_OBSERVE_REPOSITORY_IDS: ReadonlySet<string> = new Set(['1363070568', '1260141355']);

export class NodeGitHubAppTokenProvider implements InstallationTokenProvider {
  private cachedToken: { token: string; expiresAtMs: number } | null = null;

  constructor(private readonly config: GitHubAppConfig) {}

  async getToken(installationId: string, repositoryId: string): Promise<string> {
    const isApprovedRepo = APPROVED_OBSERVE_REPOSITORY_IDS.has(repositoryId) || repositoryId === this.config.repositoryId;
    if (installationId !== this.config.installationId || !isApprovedRepo) {
      throw new Error('GITHUB_REPOSITORY_NOT_APPROVED');
    }
    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAtMs > now + 60000) {
      return this.cachedToken.token;
    }

    let privateKeyPem: string;
    try {
      privateKeyPem = await fs.readFile(this.config.privateKeyPath, 'utf8');
    } catch {
      throw new Error('GITHUB_PRIVATE_KEY_UNREADABLE');
    }

    const jwt = this.createAppJwt(this.config.appId, privateKeyPem);
    const url = `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'APIProof-App',
        },
      });
      if (!response.ok) {
        throw new Error('GITHUB_AUTHENTICATION_FAILED');
      }
      const data = (await response.json()) as { token?: string; expires_at?: string };
      if (!data.token) throw new Error('GITHUB_AUTHENTICATION_FAILED');

      const expiresAtMs = data.expires_at ? new Date(data.expires_at).getTime() : now + 3600000;
      this.cachedToken = { token: data.token, expiresAtMs };
      return data.token;
    } catch (error) {
      if (String(error).includes('GITHUB_PRIVATE_KEY_UNREADABLE') || String(error).includes('GITHUB_REPOSITORY_NOT_APPROVED')) {
        throw error;
      }
      throw new Error('GITHUB_AUTHENTICATION_FAILED', { cause: error });
    }
  }

  private createAppJwt(appId: string, privateKeyPem: string): string {
    const nowSec = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({
      iat: nowSec - 60,
      exp: nowSec + (10 * 60),
      iss: appId,
    }));
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = base64url(sign.sign(privateKeyPem));
    return `${header}.${payload}.${signature}`;
  }
}

export class FetchGitHubReadTransport implements GitHubReadTransport {
  constructor(private readonly baseUrl = 'https://api.github.com') {}

  async request(path: string, token: string, options: { method?: string } = {}): Promise<{ status: number; body: unknown }> {
    const method = (options.method ?? 'GET').toUpperCase();
    if (method !== 'GET') {
      throw new Error('GITHUB_HTTP_METHOD_NOT_ALLOWED');
    }

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'APIProof-App',
        },
      });
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      return { status: response.status, body };
    } catch (error) {
      if (String(error).includes('GITHUB_HTTP_METHOD_NOT_ALLOWED')) throw error;
      throw new Error('GITHUB_TRANSPORT_FAILED', { cause: error });
    }
  }
}

export class GitHubAppSourceControlProvider implements Pick<SourceControlProvider, 'getRepository' | 'getDefaultBranch' | 'readTree' | 'readFile' | 'operationAllowed' | 'hasActiveProposal'> {
  constructor(
    private readonly config: GitHubAppConfig,
    private readonly tokens: InstallationTokenProvider,
    private readonly transport: GitHubReadTransport,
  ) {}

  private async read(path: string): Promise<{ status: number; body: unknown }> {
    const token = await this.tokens.getToken(this.config.installationId, this.config.repositoryId);
    try {
      return await this.transport.request(path, token, { method: 'GET' });
    } finally {
      /* token intentionally discarded */
    }
  }

  async getRepository(): Promise<RepositoryIdentity> {
    const result = await this.read(`/repos/${encodeURIComponent(this.config.owner)}/${encodeURIComponent(this.config.repository)}`);
    if (result.status !== 200 || typeof result.body !== 'object' || result.body === null) {
      throw new Error('GITHUB_REPOSITORY_NOT_FOUND');
    }
    const body = result.body as Record<string, unknown>;
    const returnedId = String(body.id ?? '');
    if (returnedId !== this.config.repositoryId) {
      throw new Error('GITHUB_REPOSITORY_NOT_APPROVED');
    }
    const ownerObj = typeof body.owner === 'object' && body.owner !== null ? (body.owner as Record<string, unknown>) : {};
    return {
      installationId: this.config.installationId,
      repositoryId: returnedId,
      owner: String(ownerObj.login ?? this.config.owner),
      repository: String(body.name ?? this.config.repository),
      defaultBranch: String(body.default_branch ?? 'main'),
    };
  }

  async getDefaultBranch(): Promise<{ name: string; sha: string }> {
    const repository = await this.getRepository();
    const result = await this.read(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/git/ref/heads/${encodeURIComponent(repository.defaultBranch)}`);
    if (result.status !== 200 || typeof result.body !== 'object' || result.body === null) {
      throw new Error('GITHUB_REF_NOT_FOUND');
    }
    const body = result.body as Record<string, unknown>;
    const objectObj = typeof body.object === 'object' && body.object !== null ? (body.object as Record<string, unknown>) : {};
    const sha = String(objectObj.sha ?? '');
    if (!sha) throw new Error('GITHUB_INVALID_RESPONSE');
    return { name: repository.defaultBranch, sha };
  }

  async readTree(sha: string): Promise<string[]> {
    const repository = await this.getRepository();
    const result = await this.read(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/git/trees/${encodeURIComponent(sha)}?recursive=1`);
    if (result.status !== 200 || typeof result.body !== 'object' || result.body === null) {
      return [];
    }
    const body = result.body as Record<string, unknown>;
    const tree = Array.isArray(body.tree) ? body.tree : [];
    return tree
      .filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null && entry.type === 'blob' && typeof entry.path === 'string')
      .map((entry) => String(entry.path));
  }

  async readFile(filePath: string, sha: string): Promise<string> {
    const repository = await this.getRepository();
    const result = await this.read(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/contents/${filePath}?ref=${encodeURIComponent(sha)}`);
    if (result.status !== 200 || typeof result.body !== 'object' || result.body === null) {
      throw new Error('GITHUB_FILE_NOT_FOUND');
    }
    const body = result.body as Record<string, unknown>;
    const content = String(body.content ?? '');
    return Buffer.from(content, 'base64').toString('utf8');
  }

  async getBranchRef(branchName: string): Promise<{ ref: string; sha: string } | null> {
    const repository = await this.getRepository();
    const cleanBranch = branchName.replace(/^refs\/heads\//, '').replace(/^apiproof\//, 'apiproof/');
    const result = await this.read(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/git/ref/heads/${encodeURIComponent(cleanBranch.replace(/^apiproof\//, 'apiproof/'))}`);
    if (result.status === 404) return null;
    if (result.status !== 200 || typeof result.body !== 'object' || result.body === null) return null;
    const body = result.body as Record<string, unknown>;
    const objectObj = typeof body.object === 'object' && body.object !== null ? (body.object as Record<string, unknown>) : {};
    const sha = String(objectObj.sha ?? '');
    return sha ? { ref: `refs/heads/${cleanBranch}`, sha } : null;
  }

  async getPullRequests(options: { head?: string; base?: string; state?: string } = {}): Promise<Array<{ number: number; url: string; head: string; base: string; draft: boolean }>> {
    const repository = await this.getRepository();
    const query = new URLSearchParams();
    query.set('state', options.state ?? 'open');
    if (options.base) query.set('base', options.base);
    if (options.head) query.set('head', `${repository.owner}:${options.head}`);
    const queryStr = `?${query.toString()}`;
    const result = await this.read(`/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repository)}/pulls${queryStr}`);
    if (result.status !== 200 || !Array.isArray(result.body)) return [];
    return (result.body as Array<Record<string, unknown>>).map((pr) => {
      const headObj = typeof pr.head === 'object' && pr.head !== null ? (pr.head as Record<string, unknown>) : {};
      const baseObj = typeof pr.base === 'object' && pr.base !== null ? (pr.base as Record<string, unknown>) : {};
      return {
        number: Number(pr.number ?? 0),
        url: String(pr.html_url ?? ''),
        head: String(headObj.ref ?? ''),
        base: String(baseObj.ref ?? ''),
        draft: Boolean(pr.draft ?? false),
      };
    });
  }

  async hasActiveProposal(): Promise<boolean> {
    return false;
  }

  operationAllowed(operation: GitHubOperation): boolean {
    return (['READ_REPOSITORY', 'READ_FILE', 'READ_TREE', 'READ_OWN_PULL_REQUEST'] as readonly GitHubOperation[]).includes(operation);
  }
}
