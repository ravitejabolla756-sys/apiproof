import { describe, expect, it } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertLiveConfig,
  loadGitHubAppConfig,
  FetchGitHubReadTransport,
  GitHubAppSourceControlProvider,
  NodeGitHubAppTokenProvider,
  FORBIDDEN_GITHUB_OPERATIONS,
  ApiProof,
  type GitHubAppConfig,
  type GitHubReadTransport,
  type InstallationTokenProvider,
  type GitHubOperation,
} from '@apiproof/core';
import { TypeScriptRepositoryAnalyzer, RepositorySnapshot } from '@apiproof/analyzers';
import { StripeProvider, loadStripeRegistry } from '@apiproof/providers';

const toolRoot = fileURLToPath(new URL('../', import.meta.url));

describe('Live GitHub Observe-Only Wiring & Safety', () => {
  const validConfig: GitHubAppConfig = {
    enabled: true,
    appId: '12345',
    privateKeyPath: 'dummy.pem',
    installationId: '67890',
    repositoryId: '99999',
    owner: 'test-owner',
    repository: 'test-repo',
    mode: 'OBSERVE',
  };

  it('A. keeps live mode disabled by default and performs zero requests', () => {
    const config = loadGitHubAppConfig({});
    expect(config.enabled).toBe(false);
    expect(() => assertLiveConfig(config)).toThrow('LIVE_GITHUB_OBSERVE_NOT_EXECUTED');
  });

  it('B. fails closed when required configuration is missing', () => {
    const incomplete = { ...validConfig, appId: '' };
    expect(() => assertLiveConfig(incomplete)).toThrow('GITHUB_CONFIG_MISSING_APPID');
  });

  it('C. rejects invalid non-numeric IDs in configuration', () => {
    expect(() => assertLiveConfig({ ...validConfig, appId: 'invalid' })).toThrow('GITHUB_CONFIG_INVALID_APP_ID');
    expect(() => assertLiveConfig({ ...validConfig, installationId: 'abc' })).toThrow('GITHUB_CONFIG_INVALID_INSTALLATION_ID');
    expect(() => assertLiveConfig({ ...validConfig, repositoryId: '123-id' })).toThrow('GITHUB_CONFIG_INVALID_REPOSITORY_ID');
  });

  it('D. sanitizes token & authentication errors without exposing credentials', async () => {
    const tokenProvider = new NodeGitHubAppTokenProvider({ ...validConfig, privateKeyPath: 'non-existent-key.pem' });
    await expect(tokenProvider.getToken('67890', '99999')).rejects.toThrow('GITHUB_PRIVATE_KEY_UNREADABLE');
    await expect(tokenProvider.getToken('wrong-inst', '99999')).rejects.toThrow('GITHUB_REPOSITORY_NOT_APPROVED');
  });

  it('E. enforces GET-only transport and rejects non-GET HTTP methods before network execution', async () => {
    const transport = new FetchGitHubReadTransport();
    await expect(transport.request('/test', 'dummy-token', { method: 'POST' })).rejects.toThrow('GITHUB_HTTP_METHOD_NOT_ALLOWED');
    await expect(transport.request('/test', 'dummy-token', { method: 'DELETE' })).rejects.toThrow('GITHUB_HTTP_METHOD_NOT_ALLOWED');
    await expect(transport.request('/test', 'dummy-token', { method: 'PUT' })).rejects.toThrow('GITHUB_HTTP_METHOD_NOT_ALLOWED');
  });

  it('F. pin-checks repository identity and rejects mismatches immediately', async () => {
    let requestsCount = 0;
    const fakeTokens: InstallationTokenProvider = { getToken: async () => 'test-token' };
    const fakeTransport: GitHubReadTransport = {
      request: async (p) => {
        requestsCount++;
        if (p.includes('/repos/test-owner/test-repo')) {
          return { status: 200, body: { id: 88888, name: 'test-repo', owner: { login: 'test-owner' }, default_branch: 'main' } };
        }
        return { status: 404, body: null };
      },
    };
    const provider = new GitHubAppSourceControlProvider(validConfig, fakeTokens, fakeTransport);
    await expect(provider.getRepository()).rejects.toThrow('GITHUB_REPOSITORY_NOT_APPROVED');
    expect(requestsCount).toBe(1);
  });

  it('G. structurally prevents write operations and respects forbidden policies', () => {
    const fakeTokens: InstallationTokenProvider = { getToken: async () => 'test-token' };
    const fakeTransport: GitHubReadTransport = { request: async () => ({ status: 200, body: {} }) };
    const provider = new GitHubAppSourceControlProvider(validConfig, fakeTokens, fakeTransport);

    expect(provider.operationAllowed('READ_REPOSITORY')).toBe(true);
    expect(provider.operationAllowed('READ_FILE')).toBe(true);
    expect(provider.operationAllowed('READ_TREE')).toBe(true);

    expect(provider.operationAllowed('CREATE_APIPROOF_BRANCH' as GitHubOperation)).toBe(false);
    expect(provider.operationAllowed('CREATE_PULL_REQUEST' as GitHubOperation)).toBe(false);
    expect(provider.operationAllowed('MERGE_PULL_REQUEST' as GitHubOperation)).toBe(false);
    expect(FORBIDDEN_GITHUB_OPERATIONS).toContain('MERGE_PULL_REQUEST');
  });

  it('H. protects against TOCTOU race condition by pinning SHA across all file reads', async () => {
    let currentHeadSha = 'sha-v1-initial';
    const readPaths: string[] = [];

    const fakeTokens: InstallationTokenProvider = { getToken: async () => 'test-token' };
    const fakeTransport: GitHubReadTransport = {
      request: async (p) => {
        readPaths.push(p);
        if (p.endsWith('/repos/test-owner/test-repo')) {
          return { status: 200, body: { id: 99999, name: 'test-repo', owner: { login: 'test-owner' }, default_branch: 'main' } };
        }
        if (p.includes('/git/ref/heads/main')) {
          return { status: 200, body: { object: { sha: currentHeadSha } } };
        }
        if (p.includes(`/git/trees/${currentHeadSha}`)) {
          return { status: 200, body: { tree: [{ path: 'src/billing.ts', type: 'blob' }] } };
        }
        if (p.includes('/contents/src/billing.ts')) {
          expect(p).toContain('ref=sha-v1-initial');
          return { status: 200, body: { content: Buffer.from('console.log("billing");').toString('base64') } };
        }
        return { status: 404, body: null };
      },
    };

    const provider = new GitHubAppSourceControlProvider(validConfig, fakeTokens, fakeTransport);
    const head = await provider.getDefaultBranch();
    expect(head.sha).toBe('sha-v1-initial');

    currentHeadSha = 'sha-v2-new-commit-on-main';

    const fileContent = await provider.readFile('src/billing.ts', head.sha);
    expect(fileContent).toBe('console.log("billing");');
  });

  it('I. executes full APIProof analysis on simulated GitHub fixture repository (Stripe coupon legacy usage)', async () => {
    const httpMethodsRecorded: string[] = [];

    const fakeTokens: InstallationTokenProvider = { getToken: async () => 'test-token' };
    const fakeTransport: GitHubReadTransport = {
      request: async (p, _tok, opts) => {
        httpMethodsRecorded.push(opts?.method ?? 'GET');
        if (p.endsWith('/repos/test-owner/test-repo')) {
          return { status: 200, body: { id: 99999, name: 'test-repo', owner: { login: 'test-owner' }, default_branch: 'main' } };
        }
        if (p.includes('/git/ref/heads/main')) {
          return { status: 200, body: { object: { sha: 'b1be45b401f41106ecfd489bbbb1fff71639c763' } } };
        }
        if (p.includes('/git/trees/b1be45b401f41106ecfd489bbbb1fff71639c763')) {
          return {
            status: 200,
            body: {
              tree: [
                { path: 'package.json', type: 'blob' },
                { path: 'src/billing.ts', type: 'blob' },
              ],
            },
          };
        }
        if (p.includes('/contents/package.json')) {
          return {
            status: 200,
            body: {
              content: Buffer.from(JSON.stringify({ name: 'github-fixture', dependencies: { stripe: '^16.0.0' } })).toString('base64'),
            },
          };
        }
        if (p.includes('/contents/src/billing.ts')) {
          const code = `import Stripe from 'stripe';
const stripe = new Stripe('sk_test_123');
export async function createSubscription(customerId: string) {
  return stripe.subscriptions.create({
    customer: customerId,
    coupon: '25OFF',
  });
}`;
          return { status: 200, body: { content: Buffer.from(code).toString('base64') } };
        }
        return { status: 404, body: null };
      },
    };

    const provider = new GitHubAppSourceControlProvider(validConfig, fakeTokens, fakeTransport);
    const identity = await provider.getRepository();
    expect(identity.repositoryId).toBe('99999');

    const head = await provider.getDefaultBranch();
    const tree = await provider.readTree(head.sha);

    const filesMap = new Map<string, string>();
    for (const filePath of tree) {
      const content = await provider.readFile(filePath, head.sha);
      filesMap.set(filePath, content);
    }

    const remoteSnapshot = RepositorySnapshot.fromMemory(path.join(toolRoot, '.tmp/remote-fixture'), filesMap);
    const registry = await loadStripeRegistry(path.join(toolRoot, 'registry/stripe'));
    const change = registry.find((c: { id: string }) => c.id === 'stripe-subscription-coupon-removed');
    expect(change).toBeDefined();

    const proof = new ApiProof(new TypeScriptRepositoryAnalyzer(), new StripeProvider());
    const impact = await proof.impact(remoteSnapshot, change!);

    expect(impact.status).toBe('potentially-affected');
    expect(impact.impacts.length).toBe(1);
    expect(impact.impacts[0]!.location.file).toBe('src/billing.ts');
    expect(impact.impacts[0]!.changeId).toBe('stripe-subscription-coupon-removed');

    expect(httpMethodsRecorded.every((m) => m === 'GET')).toBe(true);
  });

  it('J. ensures synthetic errors do not leak tokens, private keys, or Bearer auth', async () => {
    const fakeTokens: InstallationTokenProvider = { getToken: async () => 'secret-bearer-token-12345' };
    const fakeTransport: GitHubReadTransport = {
      request: async () => {
        throw new Error('Network failure with auth context');
      },
    };
    const provider = new GitHubAppSourceControlProvider(validConfig, fakeTokens, fakeTransport);
    try {
      await provider.getRepository();
      expect.unreachable();
    } catch (err) {
      const msg = String(err);
      expect(msg).not.toContain('secret-bearer-token-12345');
      expect(msg).not.toContain('Bearer');
    }
  });
});
