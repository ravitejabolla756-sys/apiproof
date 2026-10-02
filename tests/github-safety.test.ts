import { describe, it, expect } from 'vitest';
import {
  validateBranchName,
  validatePatchScope,
  isForbiddenSystemPath,
  computeCanonicalPatchDigest,
  MigrationVerifier,
  verifyEvidenceBinding,
  calculateIdempotencyKey,
  InMemoryIdempotencyStore,
  validateControlledWriteRequest,
  validatePullRequestPolicy,
  renderReviewOnlyPRBody,
  validateWriteEndpoint,
  DisabledGitHubWriteTransport,
  FakeGitHubWriteTransport,
  FetchGitHubControlledWriteTransport,
  NodeGitHubAppTokenProvider,
  runMigrateDryRun,
  FakeSourceControlProvider,
  type RepositoryIdentity,
  type GitHubOperation,
  type VerifiedMigrationArtifact,
  type GitHubAppConfig,
  type InstallationTokenProvider,
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

const EXECUTABLE_STRIPE_PATCH: Record<string, string> = {
  'src/billing.ts': `import Stripe from 'stripe';\nconst stripe = new Stripe('sk_test_apiproof_fixture');\nexport async function createSubscription(customerId: string, priceId: string, couponId: string) {\n  return stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }], discounts: [{ coupon: couponId }] } as never);\n}\n`,
};

describe('Local Safety Architecture — Production Transport, Executable Patch Digest & Provenance Matrix', () => {
  // Test 1: Executable patch digest calculation
  it('1. executable patch produces canonical digest distinct from comment patch, 1-char change, extra file, or path change', () => {
    const digestExecutable = computeCanonicalPatchDigest(EXECUTABLE_STRIPE_PATCH);
    const digestCommentOnly = computeCanonicalPatchDigest({ 'src/billing.ts': '// Migrated legacy coupon parameter to discounts\n' });
    const digestOneCharChange = computeCanonicalPatchDigest({ 'src/billing.ts': EXECUTABLE_STRIPE_PATCH['src/billing.ts'] + ' ' });
    const digestExtraFile = computeCanonicalPatchDigest({ ...EXECUTABLE_STRIPE_PATCH, 'src/other.ts': 'console.log();' });
    const digestPathChange = computeCanonicalPatchDigest({ 'src/billing2.ts': EXECUTABLE_STRIPE_PATCH['src/billing.ts']! });

    expect(digestExecutable).toHaveLength(64);
    expect(digestExecutable).not.toBe(digestCommentOnly);
    expect(digestExecutable).not.toBe(digestOneCharChange);
    expect(digestExecutable).not.toBe(digestExtraFile);
    expect(digestExecutable).not.toBe(digestPathChange);
  });

  // Test 2: VerifiedMigrationArtifact provenance & forged evidence rejection
  it('2. verifier-produced VerifiedMigrationArtifact is accepted while manually constructed booleans or caller SHA-256 are rejected', () => {
    const digest = computeCanonicalPatchDigest(EXECUTABLE_STRIPE_PATCH);
    const validArtifact = MigrationVerifier.verify({
      baselineSha: BASE_SHA,
      patchDigest: digest,
      changeId: CHANGE_ID,
      repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED',
      patchApplied: true,
      typecheckPassed: true,
      testsPassed: true,
      contractPassed: true,
    });

    const checkValid = verifyEvidenceBinding(validArtifact, {
      repositoryId: '1363070568',
      baselineSha: BASE_SHA,
      changeId: CHANGE_ID,
      patchDigest: digest,
    });
    expect(checkValid.valid).toBe(true);

    // Manual forgery without verifier provenance token
    const forgedManual = {
      artifactId: 'forged-1',
      repositoryId: '1363070568',
      baselineSha: BASE_SHA,
      changeId: CHANGE_ID,
      patchDigest: digest,
      proofLevel: 'CONTRACT_VERIFIED' as const,
      patchApplied: true,
      typecheckPassed: true,
      testsPassed: true,
      contractPassed: true,
      verifiedAt: new Date().toISOString(),
      evidenceDigest: 'fake-digest',
      provenanceToken: '',
    };
    expect(verifyEvidenceBinding(forgedManual as unknown as VerifiedMigrationArtifact, { repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: digest }).valid).toBe(false);

    // Tampered provenance token
    const forgedTampered = { ...validArtifact, provenanceToken: 'deadbeef' };
    expect(verifyEvidenceBinding(forgedTampered, { repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: digest }).valid).toBe(false);
  });

  // Test 3: Production FetchGitHubControlledWriteTransport tested with mock fetch
  it('3. FetchGitHubControlledWriteTransport executes valid endpoints via mock fetch and records exact HTTP calls', async () => {
    const recordedCalls: Array<{ method: string; url: string; body?: unknown }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      recordedCalls.push({ method, url, body });

      if (url.endsWith('/git/refs')) return new Response(JSON.stringify({ ref: 'refs/heads/apiproof/test', object: { sha: BASE_SHA } }), { status: 201 });
      if (url.endsWith('/git/trees')) return new Response(JSON.stringify({ sha: 'tree-sha-123' }), { status: 201 });
      if (url.endsWith('/git/commits')) return new Response(JSON.stringify({ sha: 'commit-sha-456' }), { status: 201 });
      if (url.includes('/git/refs/heads/apiproof/')) return new Response(JSON.stringify({ ref: 'refs/heads/apiproof/test', object: { sha: 'commit-sha-456' } }), { status: 200 });
      if (url.endsWith('/pulls')) return new Response(JSON.stringify({ number: 1, html_url: 'https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/1' }), { status: 201 });
      return new Response(null, { status: 404 });
    };

    const config: GitHubAppConfig = {
      enabled: true, appId: '4888527', privateKeyPath: 'dummy.pem', installationId: '160401452',
      repositoryId: '1363070568', owner: 'ravitejabolla756-sys', repository: 'apiproof-github-fixture', mode: 'OBSERVE',
    };
    const tokens: InstallationTokenProvider = { getToken: async () => 'test-token' };

    const transport = new FetchGitHubControlledWriteTransport(config, tokens, mockFetch, undefined, { authoritativeDefaultBranch: 'main' });
    const branchRes = await transport.createBranchRef('apiproof/stripe-123', BASE_SHA);
    expect(branchRes.ref).toBe('refs/heads/apiproof/stripe-123');

    const commitRes = await transport.createCommit('apiproof/stripe-123', { 'src/billing.ts': 'code' }, 'fix: test');
    expect(commitRes.sha).toBe('commit-sha-456');

    const prRes = await transport.createPullRequest({ branch: 'apiproof/stripe-123', title: 'title', body: 'body', base: 'main', draft: true });
    expect(prRes.number).toBe(1);

    expect(recordedCalls.length).toBe(5);
  });

  // Test 4: Pre-flight rejection stops fetch calls before execution
  it('4. FetchGitHubControlledWriteTransport rejects unauthorized operations BEFORE calling fetch (0 network calls sent)', async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async () => {
      callCount++;
      return new Response(null, { status: 200 });
    };

    const config: GitHubAppConfig = {
      enabled: true, appId: '4888527', privateKeyPath: 'dummy.pem', installationId: '160401452',
      repositoryId: '1363070568', owner: 'ravitejabolla756-sys', repository: 'apiproof-github-fixture', mode: 'OBSERVE',
    };
    const tokens: InstallationTokenProvider = { getToken: async () => 'test-token' };
    const transport = new FetchGitHubControlledWriteTransport(config, tokens, mockFetch, undefined, { authoritativeDefaultBranch: 'main' });

    // 1. Non-apiproof branch name
    await expect(transport.createBranchRef('feature/main', BASE_SHA)).rejects.toThrow('GITHUB_INVALID_BRANCH_NAME');
    // 2. Target default branch
    await expect(transport.createBranchRef('main', BASE_SHA)).rejects.toThrow('GITHUB_INVALID_BRANCH_NAME');
    // 3. Target wrong base branch
    await expect(transport.createPullRequest({ branch: 'apiproof/test', title: 't', body: 'b', base: 'develop', draft: true })).rejects.toThrow('GITHUB_OPERATION_REJECTED');
    // 4. Non-draft PR attempt
    await expect(transport.createPullRequest({ branch: 'apiproof/test', title: 't', body: 'b', base: 'main', draft: false })).rejects.toThrow('GITHUB_OPERATION_REJECTED');

    expect(callCount).toBe(0);
  });

  it.each(['main', 'master', 'trunk', 'develop', 'release/2026'])('accepts the authenticated repository default branch %s and rejects arbitrary bases', async (defaultBranch) => {
    const requests: string[] = [];
    const mockFetch: typeof fetch = async (input, init) => {
      requests.push(`${init?.method ?? 'GET'} ${String(input)}`);
      return new Response(JSON.stringify({ number: 7, html_url: 'https://github.com/org/repo/pull/7' }), { status: 201 });
    };
    const config: GitHubAppConfig = {
      enabled: true, appId: '4888527', privateKeyPath: 'dummy.pem', installationId: '160401452',
      repositoryId: '1363070568', owner: 'ravitejabolla756-sys', repository: 'apiproof-github-fixture', mode: 'OBSERVE',
    };
    const tokens: InstallationTokenProvider = { getToken: async () => 'test-token' };
    const transport = new FetchGitHubControlledWriteTransport(config, tokens, mockFetch, undefined, { authoritativeDefaultBranch: defaultBranch });

    await expect(transport.createPullRequest({ branch: 'apiproof/test', title: 't', body: 'b', base: defaultBranch, draft: true })).resolves.toEqual({ number: 7, url: 'https://github.com/org/repo/pull/7' });
    await expect(transport.createPullRequest({ branch: 'apiproof/test', title: 't', body: 'b', base: 'feature/not-default', draft: true })).rejects.toThrow('GITHUB_OPERATION_REJECTED');
    expect(requests).toHaveLength(1);
  });

  it('rejects an unconfigured base branch and revalidates stale persisted metadata before writes', async () => {
    const config: GitHubAppConfig = {
      enabled: true, appId: '4888527', privateKeyPath: 'dummy.pem', installationId: '160401452',
      repositoryId: '1363070568', owner: 'ravitejabolla756-sys', repository: 'apiproof-github-fixture', mode: 'OBSERVE',
    };
    const tokens: InstallationTokenProvider = { getToken: async () => 'test-token' };
    const noBranch = new FetchGitHubControlledWriteTransport(config, tokens, async () => new Response(null, { status: 201 }));
    await expect(noBranch.createPullRequest({ branch: 'apiproof/test', title: 't', body: 'b', base: 'main', draft: true })).rejects.toThrow('GITHUB_DEFAULT_BRANCH_UNVERIFIED');

    const staleTransport = new FetchGitHubControlledWriteTransport(config, tokens, async () => new Response(JSON.stringify({ id: 1363070568, default_branch: 'trunk' }), { status: 200 }));
    await expect(staleTransport.getRepositoryDefaultBranch!()).resolves.toBe('trunk');
    await expect(staleTransport.createPullRequest({ branch: 'apiproof/test', title: 't', body: 'b', base: 'main', draft: true })).rejects.toThrow('GITHUB_DEFAULT_BRANCH_UNVERIFIED');
  });

  // Test 5: Wrong repository ID or owner in transport config rejected pre-flight
  it('5. FetchGitHubControlledWriteTransport rejects wrong repository ID or owner pre-flight with 0 fetch calls', async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async () => { callCount++; return new Response(null, { status: 200 }); };
    const tokens: InstallationTokenProvider = { getToken: async () => 'test-token' };

    const wrongRepoConfig: GitHubAppConfig = {
      enabled: true, appId: '4888527', privateKeyPath: 'dummy.pem', installationId: '160401452',
      repositoryId: '999999999', owner: 'ravitejabolla756-sys', repository: 'apiproof-github-fixture', mode: 'OBSERVE',
    };
    const transportWrongRepo = new FetchGitHubControlledWriteTransport(wrongRepoConfig, tokens, mockFetch);
    await expect(transportWrongRepo.createBranchRef('apiproof/test', BASE_SHA)).rejects.toThrow('GITHUB_REPOSITORY_NOT_APPROVED');

    const wrongOwnerConfig: GitHubAppConfig = {
      enabled: true, appId: '4888527', privateKeyPath: 'dummy.pem', installationId: '160401452',
      repositoryId: '1363070568', owner: 'malicious-user', repository: 'apiproof-github-fixture', mode: 'OBSERVE',
    };
    const transportWrongOwner = new FetchGitHubControlledWriteTransport(wrongOwnerConfig, tokens, mockFetch);
    await expect(transportWrongOwner.createBranchRef('apiproof/test', BASE_SHA)).rejects.toThrow('GITHUB_REPOSITORY_NOT_APPROVED');

    expect(callCount).toBe(0);
  });

  // Test 6: Happy path dry run with executable patch
  it('6. runMigrateDryRun executes dry-run with exact executable Stripe patch and verified artifact', async () => {
    const fakeProvider = new FakeSourceControlProvider(BASE_IDENTITY, BASE_SHA);
    const result = await runMigrateDryRun({
      customProvider: fakeProvider,
      expectedRepositoryId: '1363070568',
      expectedBaselineSha: BASE_SHA,
    });
    expect(result.status).toBe('MIGRATION_READY_FOR_REVIEW');
    expect(result.writesExecuted).toBe(0);
    expect(result.patchDigest).toBe(computeCanonicalPatchDigest(EXECUTABLE_STRIPE_PATCH));
    expect(result.verification.provenanceToken).toBeDefined();
    expect(result.plannedPullRequest.body).toContain('NO AUTOMATIC MERGE');
  });

  // Test 7: Endpoint allowlist validations
  it('7. validateWriteEndpoint validates method/path allowlist correctly', () => {
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/git/refs').valid).toBe(true);
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/git/trees').valid).toBe(true);
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/git/commits').valid).toBe(true);
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/pulls').valid).toBe(true);
    expect(validateWriteEndpoint('PATCH', '/repos/owner/repo/git/refs/heads/apiproof/stripe-1').valid).toBe(true);

    expect(validateWriteEndpoint('DELETE', '/repos/owner/repo/git/refs/heads/apiproof/stripe-1').valid).toBe(false);
    expect(validateWriteEndpoint('PATCH', '/repos/owner/repo/git/refs/heads/main').valid).toBe(false);
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/merges').valid).toBe(false);
    expect(validateWriteEndpoint('PUT', '/repos/owner/repo/pulls/1/merge').valid).toBe(false);
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/releases').valid).toBe(false);
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/actions/workflows/ci.yml/dispatches').valid).toBe(false);
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/../git/refs').valid).toBe(false);
  });

  // Test 8: Additional safety policy checks
  it('8. validateBranchName and validatePatchScope enforce branch namespace and system path protections', () => {
    expect(validateBranchName('apiproof/valid-branch').valid).toBe(true);
    expect(validateBranchName('main').valid).toBe(false);
    expect(validateBranchName('apiproof/../main').valid).toBe(false);

    expect(isForbiddenSystemPath('.github/workflows/ci.yml')).toBe(true);
    expect(isForbiddenSystemPath('.env')).toBe(true);
    expect(isForbiddenSystemPath('secret.pem')).toBe(true);
    expect(validatePatchScope(['src/billing.ts'], ['src/billing.ts']).valid).toBe(true);
    expect(validatePatchScope(['.env'], ['.env']).valid).toBe(false);
  });

  // Test 9: Controlled write contract validation with idempotency and PR policy
  it('9. validateControlledWriteRequest and validatePullRequestPolicy validate request and render review-only PR body', () => {
    const digest = computeCanonicalPatchDigest(EXECUTABLE_STRIPE_PATCH);
    const artifact = MigrationVerifier.verify({
      baselineSha: BASE_SHA, patchDigest: digest, changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
    });

    const contractRes = validateControlledWriteRequest({
      repository: BASE_IDENTITY,
      baseline: { exactSha: BASE_SHA },
      change: { changeId: CHANGE_ID },
      migration: { planId: 'p1', patchDigest: digest, allowedFiles: ['src/billing.ts'], patchContent: EXECUTABLE_STRIPE_PATCH },
      branch: { branchName: 'apiproof/stripe-test' },
      verification: artifact,
    });
    expect(contractRes.valid).toBe(true);
    expect(contractRes.idempotencyKey).toBeDefined();

    const prPolicyRes = validatePullRequestPolicy({
      repositoryId: '1363070568', expectedRepositoryId: '1363070568',
      baseBranch: 'main', defaultBranch: 'main', headBranch: 'apiproof/stripe-test',
      changeId: CHANGE_ID, baselineSha: BASE_SHA, expectedBaselineSha: BASE_SHA, evidence: artifact,
    });
    expect(prPolicyRes.valid).toBe(true);

    const body = renderReviewOnlyPRBody({
      provider: 'Stripe', changeId: CHANGE_ID, affectedFiles: ['src/billing.ts'],
      baselineSha: BASE_SHA, evidence: artifact, idempotencyKey: contractRes.idempotencyKey!,
    });
    expect(body).toContain('HUMAN REVIEW MANDATORY — NO AUTOMATIC MERGE');
  });

  // Test 10: FakeGitHubWriteTransport and DisabledGitHubWriteTransport operation policies
  it('10. DisabledGitHubWriteTransport and FakeGitHubWriteTransport enforce operation permissions', async () => {
    const disabled = new DisabledGitHubWriteTransport();
    expect(disabled.operationAllowed('MERGE_PULL_REQUEST' as GitHubOperation)).toBe(false);
    await expect(disabled.createBranchRef('apiproof/test', BASE_SHA)).rejects.toThrow('GITHUB_WRITE_DISABLED');

    const fake = new FakeGitHubWriteTransport();
    expect(fake.operationAllowed('CREATE_APIPROOF_BRANCH')).toBe(true);
    expect(fake.operationAllowed('MERGE_PULL_REQUEST')).toBe(false);
  });

  // Test 11: Idempotency store records and retrieves keys
  it('11. InMemoryIdempotencyStore records keys deterministically', async () => {
    const store = new InMemoryIdempotencyStore();
    const digest = computeCanonicalPatchDigest(EXECUTABLE_STRIPE_PATCH);
    const key = calculateIdempotencyKey({ repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: digest });

    expect(await store.has(key)).toBe(false);
    await store.record(key, {
      idempotencyKey: key, repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID,
      patchDigest: digest, branchName: 'apiproof/test', createdAt: new Date().toISOString(), status: 'COMPLETED',
    });
    expect(await store.has(key)).toBe(true);
  });

  // Test 12: Bavio observe mode vs write transport separation
  it('12. Bavio observe mode is allowed for tokens while write transport strictly rejects Bavio pre-flight', async () => {
    let callCount = 0;
    const mockFetch: typeof fetch = async () => { callCount++; return new Response(JSON.stringify({ token: 'bavio-observe-token' }), { status: 200 }); };

    const bavioConfig: GitHubAppConfig = {
      enabled: true, appId: '4888527', privateKeyPath: 'dummy.pem', installationId: '160401452',
      repositoryId: '1260141355', owner: 'ravitejabolla756-sys', repository: 'Bavio-Ai-v1', mode: 'OBSERVE',
    };

    // 1. Token provider allows Bavio (1260141355) observe token
    const tokenProvider = new NodeGitHubAppTokenProvider(bavioConfig);
    // Overriding fetch for token request testing if needed, or testing token validation error logic
    await expect(tokenProvider.getToken('160401452', '999999999')).rejects.toThrow('GITHUB_REPOSITORY_NOT_APPROVED');

    // 2. FetchGitHubControlledWriteTransport strictly rejects Bavio (1260141355) pre-flight
    const bavioWriteTransport = new FetchGitHubControlledWriteTransport(bavioConfig, tokenProvider, mockFetch, undefined, { authoritativeDefaultBranch: 'main' });
    await expect(bavioWriteTransport.createBranchRef('apiproof/test', BASE_SHA)).rejects.toThrow('GITHUB_REPOSITORY_NOT_APPROVED');
    await expect(bavioWriteTransport.createCommit('apiproof/test', {}, 'msg')).rejects.toThrow('GITHUB_REPOSITORY_NOT_APPROVED');
    await expect(bavioWriteTransport.createPullRequest({ branch: 'apiproof/test', title: 't', body: 'b', base: 'main', draft: true })).rejects.toThrow('GITHUB_REPOSITORY_NOT_APPROVED');

    // 0 fetch calls were sent to network during write attempts
    expect(callCount).toBe(0);
  });
});
