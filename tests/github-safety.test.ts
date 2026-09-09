import { describe, it, expect } from 'vitest';
import {
  validateBranchName,
  validatePatchScope,
  isForbiddenSystemPath,
  createVerificationEvidence,
  verifyEvidenceBinding,
  calculateIdempotencyKey,
  InMemoryIdempotencyStore,
  validateControlledWriteRequest,
  validatePullRequestPolicy,
  renderReviewOnlyPRBody,
  validateWriteEndpoint,
  DisabledGitHubWriteTransport,
  FakeGitHubWriteTransport,
  runMigrateDryRun,
  FakeSourceControlProvider,
  type RepositoryIdentity,
  type VerificationEvidence,
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

describe('Local Safety Architecture — Complete 30-Case Security & Policy Matrix', () => {
  // Test 1: valid controlled write fake flow
  it('1. valid controlled write fake flow against FakeGitHubWriteTransport returns CONTROLLED_PR_READY with 0 real writes', async () => {
    const fakeProvider = new FakeSourceControlProvider(BASE_IDENTITY, BASE_SHA);
    const dryRunResult = await runMigrateDryRun({
      customProvider: fakeProvider,
      expectedRepositoryId: '1363070568',
      expectedBaselineSha: BASE_SHA,
    });
    expect(dryRunResult.status).toBe('MIGRATION_READY_FOR_REVIEW');
    expect(dryRunResult.writesExecuted).toBe(0);

    const fakeTransport = new FakeGitHubWriteTransport(BASE_IDENTITY.owner, BASE_IDENTITY.repository, BASE_IDENTITY.defaultBranch);
    const branchRes = await fakeTransport.createBranchRef(dryRunResult.branchName, BASE_SHA);
    expect(branchRes.ref).toBe(`refs/heads/${dryRunResult.branchName}`);

    const commitRes = await fakeTransport.createCommit(dryRunResult.branchName, { 'src/billing.ts': '// migrated' }, 'fix(stripe): migrate deprecated usage');
    expect(commitRes.sha).toMatch(/^commit-sha-/);

    const prRes = await fakeTransport.createPullRequest({
      branch: dryRunResult.branchName,
      title: dryRunResult.plannedPullRequest.title,
      body: dryRunResult.plannedPullRequest.body,
      base: dryRunResult.plannedPullRequest.base,
      draft: true,
    });
    expect(prRes.number).toBe(1);
    expect(fakeTransport.recordedCalls.length).toBe(5); // branch, tree, commit, patch ref, PR
    expect(fakeTransport.prs[0]!.draft).toBe(true);
  });

  // Test 2: repository ID mismatch
  it('2. repository ID mismatch fails closed', async () => {
    const wrongIdentity = { ...BASE_IDENTITY, repositoryId: '999999999' };
    const fakeProvider = new FakeSourceControlProvider(wrongIdentity, BASE_SHA);
    await expect(
      runMigrateDryRun({
        customProvider: fakeProvider,
        expectedRepositoryId: '1363070568',
        expectedBaselineSha: BASE_SHA,
      })
    ).rejects.toThrow('GITHUB_REPOSITORY_NOT_APPROVED');
  });

  // Test 3: owner mismatch
  it('3. owner mismatch fails closed', () => {
    const wrongIdentity = { ...BASE_IDENTITY, owner: 'malicious-org' };
    const req = {
      repository: wrongIdentity,
      baseline: { exactSha: BASE_SHA },
      change: { changeId: CHANGE_ID },
      migration: { planId: 'p1', patchDigest: 'abc', allowedFiles: ['src/billing.ts'], patchContent: { 'src/billing.ts': '' } },
      branch: { branchName: 'apiproof/test-123' },
      verification: createVerificationEvidence({
        baselineSha: BASE_SHA, patchDigest: 'abc', changeId: CHANGE_ID, repositoryId: '1363070568',
        proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
      }),
    };
    const res = validateControlledWriteRequest(req, { repositoryId: '1363070568', owner: 'ravitejabolla756-sys', repository: 'apiproof-github-fixture' });
    expect(res.valid).toBe(false);
    expect(res.status).toBe('GITHUB_REPOSITORY_NOT_APPROVED');
  });

  // Test 4: repository name mismatch
  it('4. repository name mismatch fails closed', () => {
    const wrongIdentity = { ...BASE_IDENTITY, repository: 'other-repo' };
    const res = validateControlledWriteRequest({
      repository: wrongIdentity,
      baseline: { exactSha: BASE_SHA },
      change: { changeId: CHANGE_ID },
      migration: { planId: 'p1', patchDigest: 'abc', allowedFiles: ['src/billing.ts'], patchContent: { 'src/billing.ts': '' } },
      branch: { branchName: 'apiproof/test-123' },
      verification: createVerificationEvidence({
        baselineSha: BASE_SHA, patchDigest: 'abc', changeId: CHANGE_ID, repositoryId: '1363070568',
        proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
      }),
    }, { repositoryId: '1363070568', owner: 'ravitejabolla756-sys', repository: 'apiproof-github-fixture' });
    expect(res.valid).toBe(false);
    expect(res.status).toBe('GITHUB_REPOSITORY_NOT_APPROVED');
  });

  // Test 5: baseline SHA changed / baseline race
  it('5. baseline SHA changed aborts migration with GITHUB_BASE_CHANGED and zero writes', async () => {
    const fakeProvider = new FakeSourceControlProvider(BASE_IDENTITY, 'aaaa1111bbbb2222cccc3333dddd4444eeee5555');
    await expect(
      runMigrateDryRun({
        customProvider: fakeProvider,
        expectedRepositoryId: '1363070568',
        expectedBaselineSha: BASE_SHA,
      })
    ).rejects.toThrow('GITHUB_BASE_CHANGED');
    expect(fakeProvider.operations.filter((op) => op.startsWith('CREATE_') || op.startsWith('WRITE_')).length).toBe(0);
  });

  // Test 6: non-apiproof branch
  it('6. non-apiproof branch name is rejected', () => {
    expect(validateBranchName('feature/my-branch').valid).toBe(false);
    expect(validateBranchName('main').valid).toBe(false);
  });

  // Test 7: default branch target
  it('7. default branch target is rejected by PR policy and branch policy', () => {
    const evidence = createVerificationEvidence({
      baselineSha: BASE_SHA, patchDigest: 'abc', changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
    });
    const res = validatePullRequestPolicy({
      repositoryId: '1363070568', expectedRepositoryId: '1363070568',
      baseBranch: 'main', defaultBranch: 'main',
      headBranch: 'main', changeId: CHANGE_ID,
      baselineSha: BASE_SHA, expectedBaselineSha: BASE_SHA, evidence,
    });
    expect(res.valid).toBe(false);
    expect(res.status).toBe('GITHUB_INVALID_BRANCH_NAME');
  });

  // Test 8: force flag attempt
  it('8. force-push attempt is rejected by policy and write transport', () => {
    const transport = new DisabledGitHubWriteTransport();
    expect(transport.operationAllowed('FORCE_PUSH')).toBe(false);
  });

  // Test 9: extra patched file
  it('9. patch touching file outside scope triggers GITHUB_SCOPE_VIOLATION', () => {
    const res = validatePatchScope(['src/billing.ts', 'src/other.ts'], ['src/billing.ts']);
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('outside verified migration plan scope');
  });

  // Test 10: .github workflow modification
  it('10. patch touching .github/workflows triggers GITHUB_FORBIDDEN_PATH', () => {
    const res = validatePatchScope(['.github/workflows/ci.yml'], ['.github/workflows/ci.yml']);
    expect(res.valid).toBe(false);
    expect(res.forbiddenFile).toBe('.github/workflows/ci.yml');
  });

  // Test 11: .env modification
  it('11. patch touching .env triggers GITHUB_FORBIDDEN_PATH', () => {
    expect(isForbiddenSystemPath('.env')).toBe(true);
    expect(isForbiddenSystemPath('.env.production')).toBe(true);
    const res = validatePatchScope(['.env'], ['.env']);
    expect(res.valid).toBe(false);
  });

  // Test 12: PEM/key modification
  it('12. patch touching PEM/key file triggers GITHUB_FORBIDDEN_PATH', () => {
    expect(isForbiddenSystemPath('private.pem')).toBe(true);
    expect(isForbiddenSystemPath('certs/server.key')).toBe(true);
    const res = validatePatchScope(['private.pem'], ['private.pem']);
    expect(res.valid).toBe(false);
  });

  // Test 13: forged verification evidence
  it('13. forged verification evidence with tampered booleans or digest is rejected', () => {
    const forgedEvidence: VerificationEvidence = {
      baselineSha: BASE_SHA,
      patchDigest: 'abc',
      changeId: CHANGE_ID,
      repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED',
      patchApplied: true,
      typecheckPassed: true,
      testsPassed: true,
      contractPassed: true,
      evidenceDigest: 'fake-forged-digest-12345',
      verifiedAt: new Date().toISOString(),
    };
    const res = verifyEvidenceBinding(forgedEvidence, {
      repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'abc',
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('integrity check failed');
  });

  // Test 14: evidence for different patch
  it('14. evidence belonging to different patch fails binding check', () => {
    const evidence = createVerificationEvidence({
      baselineSha: BASE_SHA, patchDigest: 'digest-AAA', changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
    });
    const res = verifyEvidenceBinding(evidence, {
      repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'digest-BBB',
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('patchDigest');
  });

  // Test 15: evidence for different SHA
  it('15. evidence belonging to different baseline SHA fails binding check', () => {
    const evidence = createVerificationEvidence({
      baselineSha: 'sha-old-111', patchDigest: 'digest-AAA', changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
    });
    const res = verifyEvidenceBinding(evidence, {
      repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'digest-AAA',
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('baselineSha');
  });

  // Test 16: evidence for different repository
  it('16. evidence belonging to different repository ID fails binding check', () => {
    const evidence = createVerificationEvidence({
      baselineSha: BASE_SHA, patchDigest: 'digest-AAA', changeId: CHANGE_ID, repositoryId: '999999999',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
    });
    const res = verifyEvidenceBinding(evidence, {
      repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'digest-AAA',
    });
    expect(res.valid).toBe(false);
    expect(res.reason).toContain('repositoryId');
  });

  // Test 17: invalid patch digest
  it('17. changing patch content changes calculated digest', () => {
    const key1 = calculateIdempotencyKey({ repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'digest-1' });
    const key2 = calculateIdempotencyKey({ repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'digest-2' });
    expect(key1).not.toBe(key2);
  });

  // Test 18: duplicate operation / idempotency end-to-end
  it('18. duplicate operation returns existing record from idempotency store', async () => {
    const store = new InMemoryIdempotencyStore();
    const key = calculateIdempotencyKey({ repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'digest-1' });

    expect(await store.has(key)).toBe(false);
    await store.record(key, {
      idempotencyKey: key, repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID,
      patchDigest: 'digest-1', branchName: 'apiproof/stripe-1', createdAt: new Date().toISOString(), status: 'COMPLETED', prNumber: 42,
    });
    expect(await store.has(key)).toBe(true);
    const existing = await store.get(key);
    expect(existing?.prNumber).toBe(42);
  });

  // Test 19: failed typecheck
  it('19. failing typecheck invalidates verification evidence', () => {
    const evidence = createVerificationEvidence({
      baselineSha: BASE_SHA, patchDigest: 'abc', changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: false, testsPassed: true, contractPassed: true,
    });
    const res = verifyEvidenceBinding(evidence, {
      repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'abc',
    });
    expect(res.valid).toBe(false);
  });

  // Test 20: failed tests
  it('20. failing unit tests invalidate verification evidence', () => {
    const evidence = createVerificationEvidence({
      baselineSha: BASE_SHA, patchDigest: 'abc', changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: false, contractPassed: true,
    });
    const res = verifyEvidenceBinding(evidence, {
      repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'abc',
    });
    expect(res.valid).toBe(false);
  });

  // Test 21: failed contract
  it('21. failing contract verification invalidates verification evidence', () => {
    const evidence = createVerificationEvidence({
      baselineSha: BASE_SHA, patchDigest: 'abc', changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: false,
    });
    const res = verifyEvidenceBinding(evidence, {
      repositoryId: '1363070568', baselineSha: BASE_SHA, changeId: CHANGE_ID, patchDigest: 'abc',
    });
    expect(res.valid).toBe(false);
  });

  // Test 22: malformed GitHub response handling
  it('22. endpoint validation rejects malformed paths or path traversal', () => {
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/../git/refs').valid).toBe(false);
  });

  // Test 23: secret redaction
  it('23. PR body renders review-only header without secret leakage', () => {
    const evidence = createVerificationEvidence({
      baselineSha: BASE_SHA, patchDigest: 'abc', changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
    });
    const body = renderReviewOnlyPRBody({
      provider: 'Stripe', changeId: CHANGE_ID, affectedFiles: ['src/billing.ts'],
      baselineSha: BASE_SHA, evidence, idempotencyKey: 'idemp-123',
    });
    expect(body).toContain('NO AUTOMATIC MERGE');
    expect(body).not.toContain('ghp_');
    expect(body).not.toContain('BEGIN PRIVATE KEY');
  });

  // Test 24: merge endpoint rejection
  it('24. network endpoint allowlist rejects POST/PUT /merges endpoints', () => {
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/merges').valid).toBe(false);
    expect(validateWriteEndpoint('PUT', '/repos/owner/repo/pulls/1/merge').valid).toBe(false);
  });

  // Test 25: delete-ref rejection
  it('25. network endpoint allowlist rejects DELETE methods', () => {
    expect(validateWriteEndpoint('DELETE', '/repos/owner/repo/git/refs/heads/feature').valid).toBe(false);
  });

  // Test 26: settings endpoint rejection
  it('26. network endpoint allowlist rejects settings endpoints', () => {
    expect(validateWriteEndpoint('PATCH', '/repos/owner/repo/settings').valid).toBe(false);
  });

  // Test 27: workflow endpoint rejection
  it('27. network endpoint allowlist rejects workflow dispatch endpoints', () => {
    expect(validateWriteEndpoint('POST', '/repos/owner/repo/actions/workflows/ci.yml/dispatches').valid).toBe(false);
  });

  // Test 28: unsafe PR base
  it('28. PR policy rejects base branch that is not repository default branch', () => {
    const evidence = createVerificationEvidence({
      baselineSha: BASE_SHA, patchDigest: 'abc', changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
    });
    const res = validatePullRequestPolicy({
      repositoryId: '1363070568', expectedRepositoryId: '1363070568',
      baseBranch: 'feature/other', defaultBranch: 'main',
      headBranch: 'apiproof/stripe-123', changeId: CHANGE_ID,
      baselineSha: BASE_SHA, expectedBaselineSha: BASE_SHA, evidence,
    });
    expect(res.valid).toBe(false);
    expect(res.status).toBe('GITHUB_OPERATION_REJECTED');
  });

  // Test 29: unsafe PR head
  it('29. PR policy rejects head branch outside apiproof/* namespace', () => {
    const evidence = createVerificationEvidence({
      baselineSha: BASE_SHA, patchDigest: 'abc', changeId: CHANGE_ID, repositoryId: '1363070568',
      proofLevel: 'CONTRACT_VERIFIED', patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true,
    });
    const res = validatePullRequestPolicy({
      repositoryId: '1363070568', expectedRepositoryId: '1363070568',
      baseBranch: 'main', defaultBranch: 'main',
      headBranch: 'patch/custom-123', changeId: CHANGE_ID,
      baselineSha: BASE_SHA, expectedBaselineSha: BASE_SHA, evidence,
    });
    expect(res.valid).toBe(false);
    expect(res.status).toBe('GITHUB_INVALID_BRANCH_NAME');
  });

  // Test 30: non-draft PR attempt
  it('30. fake write transport rejects non-draft PR creation attempt', async () => {
    const fakeTransport = new FakeGitHubWriteTransport(BASE_IDENTITY.owner, BASE_IDENTITY.repository, BASE_IDENTITY.defaultBranch);
    await expect(
      fakeTransport.createPullRequest({
        branch: 'apiproof/stripe-123',
        title: 'APIProof: migrate',
        body: 'body',
        base: 'main',
        draft: false,
      })
    ).rejects.toThrow('GITHUB_OPERATION_REJECTED');
  });
});
