import { describe, it, expect } from 'vitest';
import {
  runMigrateLive,
  FakeSourceControlProvider,
  InMemoryIdempotencyStore,
  generateDeterministicBranchName,
  FetchGitHubControlledWriteTransport,
  type RepositoryIdentity,
  type GitHubAppConfig,
  type GitHubControlledWriteTransport,
} from '@apiproof/core';


const BASE_IDENTITY: RepositoryIdentity = {
  installationId: '160401452',
  repositoryId: '1363070568',
  owner: 'ravitejabolla756-sys',
  repository: 'apiproof-github-fixture',
  defaultBranch: 'main',
};

const BASE_SHA = 'b1be45b401f41106ecfd489bbbb1fff71639c763';
const CHANGE_ID = 'stripe-subscription-coupon-removed';
const PATCH_DIGEST = 'dd6a85b54d25ee64c911992bb4fd8082b75ee2dfc2c121c99a5b5e1f9a445917';

const TEST_CONFIG: GitHubAppConfig = {
  enabled: true,
  writeEnabled: true,
  appId: '4888527',
  privateKeyPath: 'dummy.pem',
  installationId: '160401452',
  repositoryId: '1363070568',
  owner: 'ravitejabolla756-sys',
  repository: 'apiproof-github-fixture',
  mode: 'PROPOSE',
};

describe('github-migrate-live — Remote Idempotency & Deterministic Branch Protections', () => {
  // Test 1: Deterministic branch name calculation
  it('1. generateDeterministicBranchName produces identical branch across instances and changes on input variations', () => {
    const branch1 = generateDeterministicBranchName({
      repositoryId: '1363070568',
      baselineSha: BASE_SHA,
      changeId: CHANGE_ID,
      patchDigest: PATCH_DIGEST,
    });
    const branch2 = generateDeterministicBranchName({
      repositoryId: '1363070568',
      baselineSha: BASE_SHA,
      changeId: CHANGE_ID,
      patchDigest: PATCH_DIGEST,
    });
    expect(branch1).toBe('apiproof/stripe-subscription-coupon-removed-9cc601a8');
    expect(branch1).toBe(branch2);

    const branchDifferentDigest = generateDeterministicBranchName({
      repositoryId: '1363070568',
      baselineSha: BASE_SHA,
      changeId: CHANGE_ID,
      patchDigest: '0000000000000000000000000000000000000000000000000000000000000000',
    });
    expect(branchDifferentDigest).not.toBe(branch1);

    const branchDifferentBaseline = generateDeterministicBranchName({
      repositoryId: '1363070568',
      baselineSha: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      changeId: CHANGE_ID,
      patchDigest: PATCH_DIGEST,
    });
    expect(branchDifferentBaseline).not.toBe(branch1);
  });

  // Test 2: Fresh-process duplicate test (Authoritative Remote Idempotency)
  it('2. fresh process instance discovers remote branch and PR, returning CONTROLLED_MIGRATION_ALREADY_EXISTS with 0 write calls', async () => {
    const expectedBranch = 'apiproof/stripe-subscription-coupon-removed-9cc601a8';

    // Instance 1: Executes migration and records remote state
    let writeCallsInstance1 = 0;
    const mockWriteTransport1: GitHubControlledWriteTransport = {
      operationAllowed: () => true,
      createBranchRef: async () => { writeCallsInstance1++; return { ref: `refs/heads/${expectedBranch}`, sha: BASE_SHA }; },
      createCommit: async () => { writeCallsInstance1 += 3; return { sha: 'commit-sha-456' }; },
      createPullRequest: async () => { writeCallsInstance1++; return { number: 42, url: 'https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/42' }; },
    };

    const providerInstance1 = new FakeSourceControlProvider(BASE_IDENTITY, BASE_SHA);
    const res1 = await runMigrateLive({
      config: TEST_CONFIG,
      customReadProvider: providerInstance1,
      customWriteTransport: mockWriteTransport1,
      confirmControlledWrite: true,
      idempotencyStore: new InMemoryIdempotencyStore(), // Instance 1 store
    });

    expect(res1.status).toBe('CONTROLLED_DRAFT_PR_CREATED');
    expect(writeCallsInstance1).toBe(5);

    // Instance 2: NEW process instance (NEW empty idempotency store), remote GET discovers existing branch & PR
    const providerInstance2 = {
      getRepository: async () => BASE_IDENTITY,
      getDefaultBranch: async () => ({ name: 'main', sha: BASE_SHA }),
      readTree: async () => ['src/billing.ts', 'package.json'],
      readFile: async () => '',
      getBranchRef: async (b: string) => (b === expectedBranch ? { ref: `refs/heads/${expectedBranch}`, sha: 'commit-sha-456' } : null),
      getPullRequests: async () => [
        { number: 42, url: 'https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/42', head: expectedBranch, base: 'main', draft: true },
      ],
    };

    let writeCallsInstance2 = 0;
    const mockWriteTransport2: GitHubControlledWriteTransport = {
      operationAllowed: () => true,
      createBranchRef: async () => { writeCallsInstance2++; return { ref: 'ref', sha: BASE_SHA }; },
      createCommit: async () => { writeCallsInstance2 += 3; return { sha: 'sha' }; },
      createPullRequest: async () => { writeCallsInstance2++; return { number: 99, url: 'url' }; },
    };

    const res2 = await runMigrateLive({
      config: TEST_CONFIG,
      customReadProvider: providerInstance2,
      customWriteTransport: mockWriteTransport2,
      confirmControlledWrite: true,
      idempotencyStore: new InMemoryIdempotencyStore(), // NEW fresh process store
    });

    expect(res2.status).toBe('CONTROLLED_MIGRATION_ALREADY_EXISTS');
    expect(res2.writesExecuted).toBe(0);
    expect(res2.pullRequestNumber).toBe(42);
    expect(res2.branchName).toBe(expectedBranch);
    expect(writeCallsInstance2).toBe(0); // ZERO write requests sent!
  });

  // Test 3: Partial previous operation — branch exists, PR absent -> resumes PR creation (1 write call)
  it('3. branch exists but PR absent resumes draft PR creation with exactly 1 write call', async () => {
    const expectedBranch = 'apiproof/stripe-subscription-coupon-removed-9cc601a8';
    const providerBranchOnly = {
      getRepository: async () => BASE_IDENTITY,
      getDefaultBranch: async () => ({ name: 'main', sha: BASE_SHA }),
      readTree: async () => ['src/billing.ts', 'package.json'],
      readFile: async () => '',
      getBranchRef: async (b: string) => (b === expectedBranch ? { ref: `refs/heads/${expectedBranch}`, sha: 'commit-sha-456' } : null),
      getPullRequests: async () => [],
    };

    let writeCalls = 0;
    const mockWriteTransport: GitHubControlledWriteTransport = {
      operationAllowed: () => true,
      createBranchRef: async () => { writeCalls++; return { ref: 'ref', sha: BASE_SHA }; },
      createCommit: async () => { writeCalls += 3; return { sha: 'sha' }; },
      createPullRequest: async () => { writeCalls++; return { number: 43, url: 'https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/43' }; },
    };

    const res = await runMigrateLive({
      config: TEST_CONFIG,
      customReadProvider: providerBranchOnly,
      customWriteTransport: mockWriteTransport,
      confirmControlledWrite: true,
    });

    expect(res.status).toBe('CONTROLLED_DRAFT_PR_CREATED');
    expect(res.writesExecuted).toBe(1); // Only 1 write call (create PR)
    expect(res.pullRequestNumber).toBe(43);
    expect(writeCalls).toBe(1);
  });

  // Test 4: Existing branch with unexpected SHA -> REMOTE_IDEMPOTENCY_STATE_CONFLICT
  it('4. existing branch with unexpected commit SHA stops with REMOTE_IDEMPOTENCY_STATE_CONFLICT and 0 writes', async () => {
    const expectedBranch = 'apiproof/stripe-subscription-coupon-removed-9cc601a8';
    const providerBadSha = {
      getRepository: async () => BASE_IDENTITY,
      getDefaultBranch: async () => ({ name: 'main', sha: BASE_SHA }),
      readTree: async () => ['src/billing.ts', 'package.json'],
      readFile: async () => '',
      getBranchRef: async (b: string) => (b === expectedBranch ? { ref: `refs/heads/${expectedBranch}`, sha: 'unexpected-unknown-sha' } : null),
      getPullRequests: async () => [],
    };

    let writeCalls = 0;
    const mockWriteTransport: GitHubControlledWriteTransport = {
      operationAllowed: () => true,
      createBranchRef: async () => { writeCalls++; return { ref: 'ref', sha: BASE_SHA }; },
      createCommit: async () => { writeCalls += 3; return { sha: 'sha' }; },
      createPullRequest: async () => { writeCalls++; return { number: 1, url: 'url' }; },
    };

    const res = await runMigrateLive({
      config: TEST_CONFIG,
      customReadProvider: providerBadSha,
      customWriteTransport: mockWriteTransport,
      confirmControlledWrite: true,
    });

    expect(res.status).toBe('REMOTE_IDEMPOTENCY_STATE_CONFLICT');
    expect(res.writesExecuted).toBe(0);
    expect(writeCalls).toBe(0);
  });

  // Test 5: PR exists with conflicting base -> REMOTE_IDEMPOTENCY_STATE_CONFLICT
  it('5. PR existing with conflicting base branch stops with REMOTE_IDEMPOTENCY_STATE_CONFLICT and 0 writes', async () => {
    const expectedBranch = 'apiproof/stripe-subscription-coupon-removed-9cc601a8';
    const providerBadBasePR = {
      getRepository: async () => BASE_IDENTITY,
      getDefaultBranch: async () => ({ name: 'main', sha: BASE_SHA }),
      readTree: async () => ['src/billing.ts', 'package.json'],
      readFile: async () => '',
      getBranchRef: async (b: string) => (b === expectedBranch ? { ref: `refs/heads/${expectedBranch}`, sha: 'commit-sha-456' } : null),
      getPullRequests: async () => [
        { number: 44, url: 'url', head: expectedBranch, base: 'develop', draft: true },
      ],
    };

    let writeCalls = 0;
    const mockWriteTransport: GitHubControlledWriteTransport = {
      operationAllowed: () => true,
      createBranchRef: async () => { writeCalls++; return { ref: 'ref', sha: BASE_SHA }; },
      createCommit: async () => { writeCalls += 3; return { sha: 'sha' }; },
      createPullRequest: async () => { writeCalls++; return { number: 1, url: 'url' }; },
    };

    const res = await runMigrateLive({
      config: TEST_CONFIG,
      customReadProvider: providerBadBasePR,
      customWriteTransport: mockWriteTransport,
      confirmControlledWrite: true,
    });

    expect(res.status).toBe('REMOTE_IDEMPOTENCY_STATE_CONFLICT');
    expect(res.writesExecuted).toBe(0);
    expect(writeCalls).toBe(0);
  });

  // Test 6: Write flag false -> zero writes
  it('6. write flag false returns LIVE_GITHUB_WRITE_NOT_ENABLED with 0 writes', async () => {
    const fakeProvider = new FakeSourceControlProvider(BASE_IDENTITY, BASE_SHA);
    const configWithoutWrite: GitHubAppConfig = { ...TEST_CONFIG, writeEnabled: false };
    const result = await runMigrateLive({
      config: configWithoutWrite,
      customReadProvider: fakeProvider,
      confirmControlledWrite: true,
    });
    expect(result.status).toBe('LIVE_GITHUB_WRITE_NOT_ENABLED');
    expect(result.writesExecuted).toBe(0);
  });

  // Test 7: Confirmation missing -> zero writes
  it('7. missing confirmControlledWrite returns CONTROLLED_WRITE_CONFIRMATION_REQUIRED with 0 writes', async () => {
    const fakeProvider = new FakeSourceControlProvider(BASE_IDENTITY, BASE_SHA);
    const result = await runMigrateLive({
      config: TEST_CONFIG,
      customReadProvider: fakeProvider,
      confirmControlledWrite: false,
    });
    expect(result.status).toBe('CONTROLLED_WRITE_CONFIRMATION_REQUIRED');
    expect(result.writesExecuted).toBe(0);
  });

  // Test 8: Stale baseline -> zero writes
  it('8. stale baseline SHA is rejected with GITHUB_BASE_CHANGED and 0 writes', async () => {
    const staleProvider = new FakeSourceControlProvider(BASE_IDENTITY, 'deadbeef1234567890abcdef1234567890abcdef');
    await expect(
      runMigrateLive({
        config: TEST_CONFIG,
        customReadProvider: staleProvider,
        confirmControlledWrite: true,
      })
    ).rejects.toThrow('GITHUB_BASE_CHANGED');
  });

  // Test 9: Pre-flight SHA race -> zero mutation calls
  it('9. race condition on baseline SHA immediately pre-write cancels mutation with 0 write calls', async () => {
    let readCallCount = 0;
    const racingReadProvider = {
      getRepository: async () => BASE_IDENTITY,
      getDefaultBranch: async () => {
        readCallCount++;
        if (readCallCount === 1) return { name: 'main', sha: BASE_SHA };
        return { name: 'main', sha: 'new-sha-another-commit-happened' };
      },
      readTree: async () => ['src/billing.ts', 'package.json'],
      readFile: async () => 'code',
    };

    let writeCallCount = 0;
    const mockWriteTransport: GitHubControlledWriteTransport = {
      operationAllowed: () => true,
      createBranchRef: async () => { writeCallCount++; return { ref: 'ref', sha: BASE_SHA }; },
      createCommit: async () => { writeCallCount += 3; return { sha: 'c1' }; },
      createPullRequest: async () => { writeCallCount++; return { number: 1, url: 'url' }; },
    };

    await expect(
      runMigrateLive({
        config: TEST_CONFIG,
        customReadProvider: racingReadProvider,
        customWriteTransport: mockWriteTransport,
        confirmControlledWrite: true,
      })
    ).rejects.toThrow('GITHUB_BASE_CHANGED');

    expect(writeCallCount).toBe(0);
  });

  // Test 10: Token/error redaction
  it('10. token and PEM contents are redacted in error messages', async () => {
    const failingWriteTransport: GitHubControlledWriteTransport = {
      operationAllowed: () => true,
      createBranchRef: async () => { throw new Error('API Failure with token ghs_1234567890abcdef and Bearer ghs_secret'); },
      createCommit: async () => ({ sha: 'sha' }),
      createPullRequest: async () => ({ number: 1, url: 'url' }),
    };

    const fakeReadProvider = new FakeSourceControlProvider(BASE_IDENTITY, BASE_SHA);
    const result = await runMigrateLive({
      config: TEST_CONFIG,
      customReadProvider: fakeReadProvider,
      customWriteTransport: failingWriteTransport,
      confirmControlledWrite: true,
    });

    expect(result.status).toBe('CONTROLLED_WRITE_PARTIAL_FAILURE');
    expect(result.reason).not.toContain('ghs_1234567890abcdef');
    expect(result.reason).toContain('[REDACTED]');
  });

  // Test 11: Partial state recovery — branch exists at baseline SHA, PR absent -> resumes tree, commit and PR creation (4 write calls)
  it('11. partial state recovery (branch at baseline SHA, PR absent) resumes tree/commit creation with exactly 4 write calls', async () => {
    const expectedBranch = 'apiproof/stripe-subscription-coupon-removed-9cc601a8';
    const providerBranchAtBaseline = {
      getRepository: async () => BASE_IDENTITY,
      getDefaultBranch: async () => ({ name: 'main', sha: BASE_SHA }),
      readTree: async () => ['src/billing.ts', 'package.json'],
      readFile: async () => '',
      getBranchRef: async (b: string) => (b === expectedBranch ? { ref: `refs/heads/${expectedBranch}`, sha: BASE_SHA } : null),
      getPullRequests: async () => [],
    };

    let createBranchRefCalled = false;
    let createCommitCalled = false;
    let createPRCalled = false;
    let writeCalls = 0;
    const mockWriteTransport: GitHubControlledWriteTransport = {
      operationAllowed: () => true,
      createBranchRef: async () => { createBranchRefCalled = true; writeCalls++; return { ref: 'ref', sha: BASE_SHA }; },
      createCommit: async (_b, _f, _m, parentSha) => {
        createCommitCalled = true;
        writeCalls += 3;
        expect(parentSha).toBe(BASE_SHA);
        return { sha: 'commit-sha-new' };
      },
      createPullRequest: async () => { createPRCalled = true; writeCalls++; return { number: 44, url: 'https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/44' }; },
    };

    const res = await runMigrateLive({
      config: TEST_CONFIG,
      customReadProvider: providerBranchAtBaseline,
      customWriteTransport: mockWriteTransport,
      confirmControlledWrite: true,
    });

    expect(res.status).toBe('CONTROLLED_DRAFT_PR_CREATED');
    expect(createBranchRefCalled).toBe(false); // NO createBranchRef call!
    expect(createCommitCalled).toBe(true);
    expect(createPRCalled).toBe(true);
    expect(res.writesExecuted).toBe(4); // Exactly 4 write calls (POST tree, POST commit, PATCH ref, POST draft PR)
    expect(writeCalls).toBe(4);
  });

  // Test 12: FetchGitHubControlledWriteTransport resolves base_tree from parent commit metadata and sets parents array
  it('12. FetchGitHubControlledWriteTransport resolves base_tree from baseline commit metadata and sets parents array', async () => {
    const recordedRequests: Array<{ url: string; method: string; body?: { base_tree?: string; parents?: string[] } | undefined }> = [];
    const mockFetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const urlStr = String(url);
      const method = init?.method ?? 'GET';
      const body = init?.body ? (JSON.parse(String(init.body)) as { base_tree?: string; parents?: string[] }) : undefined;
      recordedRequests.push({ url: urlStr, method, body });

      if (method === 'GET' && urlStr.includes('/git/commits/b1be45b401f41106ecfd489bbbb1fff71639c763')) {
        return new Response(JSON.stringify({ sha: 'b1be45b401f41106ecfd489bbbb1fff71639c763', tree: { sha: 'baseline-tree-sha-123' } }), { status: 200 });
      }
      if (method === 'POST' && urlStr.endsWith('/git/trees')) {
        return new Response(JSON.stringify({ sha: 'new-tree-sha-456' }), { status: 201 });
      }
      if (method === 'POST' && urlStr.endsWith('/git/commits')) {
        return new Response(JSON.stringify({ sha: 'new-commit-sha-789' }), { status: 201 });
      }
      if (method === 'PATCH' && urlStr.includes('/git/refs/heads/')) {
        return new Response(JSON.stringify({ ref: 'refs/heads/branch' }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 404 });
    };

    const tokenProvider = { getToken: async () => 'mock-token' };
    const transport = new FetchGitHubControlledWriteTransport(TEST_CONFIG, tokenProvider as never, mockFetch as never);

    const result = await transport.createCommit('apiproof/test-branch', { 'src/billing.ts': 'patched content' }, 'fix: test', 'b1be45b401f41106ecfd489bbbb1fff71639c763');

    expect(result.sha).toBe('new-commit-sha-789');

    const getCommitReq = recordedRequests.find(r => r.method === 'GET' && r.url.includes('/git/commits/b1be45b401f41106ecfd489bbbb1fff71639c763'));
    expect(getCommitReq).toBeDefined();

    const treeReq = recordedRequests.find(r => r.method === 'POST' && r.url.endsWith('/git/trees'));
    expect(treeReq).toBeDefined();
    expect(treeReq?.body?.base_tree).toBe('baseline-tree-sha-123'); // base_tree equals baseline commit's tree SHA!
    expect(treeReq?.body?.base_tree).not.toBe('b1be45b401f41106ecfd489bbbb1fff71639c763'); // base_tree is NOT blindly the commit SHA!

    const commitReq = recordedRequests.find(r => r.method === 'POST' && r.url.endsWith('/git/commits'));
    expect(commitReq).toBeDefined();
    expect(commitReq?.body?.parents).toEqual(['b1be45b401f41106ecfd489bbbb1fff71639c763']); // parents contains parent commit SHA!
  });
});
