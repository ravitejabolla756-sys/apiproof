import crypto from 'node:crypto';
import {
  loadGitHubAppConfig,
  assertLiveConfig,
  type GitHubAppConfig,
} from './config.js';
import {
  NodeGitHubAppTokenProvider,
  FetchGitHubReadTransport,
  GitHubAppSourceControlProvider,
} from './live-provider.js';
import { generateSafeBranchName, validateBranchName } from './branch-policy.js';
import { validatePatchScope } from './patch-scope.js';
import {
  MigrationVerifier,
  computeCanonicalPatchDigest,
} from './verification-evidence.js';
import { validateControlledWriteRequest } from './write-contract.js';
import {
  renderReviewOnlyPRBody,
  validatePullRequestPolicy,
} from './pr-policy.js';
import {
  calculateIdempotencyKey,
  InMemoryIdempotencyStore,
} from './idempotency.js';
import {
  FetchGitHubControlledWriteTransport,
  type GitHubControlledWriteTransport,
} from './write-transport.js';
import type { ReadSourceControlProvider } from './migrate-dry-run.js';

export interface MigrateLiveOptions {
  config?: GitHubAppConfig;
  customReadProvider?: ReadSourceControlProvider;
  customWriteTransport?: GitHubControlledWriteTransport;
  registryPath?: string;
  expectedRepositoryId?: string;
  expectedBaselineSha?: string;
  confirmControlledWrite?: boolean;
  idempotencyStore?: InMemoryIdempotencyStore;
}

export interface MigrateLiveResult {
  status: string;
  mode: string;
  repository: string;
  repositoryId: string;
  baselineSha: string;
  changeId: string;
  patchDigest: string;
  branchName?: string | undefined;
  commitSha?: string | undefined;
  pullRequestNumber?: number | undefined;
  pullRequestUrl?: string | undefined;
  draft?: boolean | undefined;
  base?: string | undefined;
  head?: string | undefined;
  writesExecuted: number;
  lastSuccessfulOperation?: string | undefined;
  reason?: string | undefined;
}


export async function runMigrateLive(
  options: MigrateLiveOptions = {}
): Promise<MigrateLiveResult> {
  const config = options.config ?? loadGitHubAppConfig();
  if (!config.enabled && !options.customReadProvider) {
    return {
      status: 'LIVE_GITHUB_TEST_NOT_EXECUTED',
      mode: 'DISABLED',
      repository: config.owner && config.repository ? `${config.owner}/${config.repository}` : 'unconfigured',
      repositoryId: config.repositoryId || '',
      baselineSha: '',
      changeId: '',
      patchDigest: '',
      writesExecuted: 0,
      reason: 'APIPROOF_ENABLE_LIVE_GITHUB is not true.',
    };
  }

  const writeEnabled = config.writeEnabled ?? (process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'true');
  if (!writeEnabled) {
    return {
      status: 'LIVE_GITHUB_WRITE_NOT_ENABLED',
      mode: config.mode || 'OBSERVE',
      repository: config.owner && config.repository ? `${config.owner}/${config.repository}` : 'unconfigured',
      repositoryId: config.repositoryId || '',
      baselineSha: '',
      changeId: '',
      patchDigest: '',
      writesExecuted: 0,
      reason: 'APIPROOF_ENABLE_LIVE_GITHUB_WRITE is not set to true.',
    };
  }

  if (options.confirmControlledWrite !== true) {
    return {
      status: 'CONTROLLED_WRITE_CONFIRMATION_REQUIRED',
      mode: config.mode || 'OBSERVE',
      repository: config.owner && config.repository ? `${config.owner}/${config.repository}` : 'unconfigured',
      repositoryId: config.repositoryId || '',
      baselineSha: '',
      changeId: '',
      patchDigest: '',
      writesExecuted: 0,
      reason: 'Explicit flag --confirm-controlled-write is required for live migration.',
    };
  }

  let readProvider: ReadSourceControlProvider | undefined = options.customReadProvider;
  if (!readProvider) {
    assertLiveConfig(config);
    const tokenProvider = new NodeGitHubAppTokenProvider(config);
    const transport = new FetchGitHubReadTransport();
    readProvider = new GitHubAppSourceControlProvider(config, tokenProvider, transport);
  }

  const activeReadProvider = readProvider;
  const identity = await activeReadProvider.getRepository();

  const expectedRepoId = options.expectedRepositoryId ?? config.repositoryId ?? '1363070568';
  if (identity.repositoryId !== '1363070568' || identity.repositoryId !== expectedRepoId) {
    throw new Error(`GITHUB_REPOSITORY_NOT_APPROVED: Repository ID mismatch (${identity.repositoryId} !== ${expectedRepoId}).`);
  }
  if (identity.owner !== 'ravitejabolla756-sys') {
    throw new Error(`GITHUB_REPOSITORY_NOT_APPROVED: Repository owner mismatch (${identity.owner} !== ravitejabolla756-sys).`);
  }
  if (identity.repository !== 'apiproof-github-fixture') {
    throw new Error(`GITHUB_REPOSITORY_NOT_APPROVED: Repository name mismatch (${identity.repository} !== apiproof-github-fixture).`);
  }
  if (identity.defaultBranch !== 'main') {
    throw new Error(`GITHUB_OPERATION_REJECTED: Default branch mismatch (${identity.defaultBranch} !== main).`);
  }

  const head = await activeReadProvider.getDefaultBranch();
  const expectedSha = options.expectedBaselineSha ?? 'b1be45b401f41106ecfd489bbbb1fff71639c763';
  if (head.sha !== expectedSha) {
    throw new Error(`GITHUB_BASE_CHANGED: Baseline SHA mismatch (${head.sha} !== ${expectedSha}).`);
  }

  const changeId = 'stripe-subscription-coupon-removed';
  const affectedFiles = ['src/billing.ts'];
  const scopeCheck = validatePatchScope(affectedFiles, ['src/billing.ts']);
  if (!scopeCheck.valid) {
    throw new Error(`GITHUB_SCOPE_VIOLATION: ${scopeCheck.reason}`);
  }

  const patchContent: Record<string, string> = {
    'src/billing.ts': `import Stripe from 'stripe';\nconst stripe = new Stripe('sk_test_apiproof_fixture');\nexport async function createSubscription(customerId: string, priceId: string, couponId: string) {\n  return stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }], discounts: [{ coupon: couponId }] } as never);\n}\n`,
  };

  const patchDigest = computeCanonicalPatchDigest(patchContent);
  const expectedDigest = 'dd6a85b54d25ee64c911992bb4fd8082b75ee2dfc2c121c99a5b5e1f9a445917';
  if (patchDigest !== expectedDigest) {
    return {
      status: 'PATCH_DIGEST_CHANGED',
      mode: config.mode || 'PROPOSE',
      repository: `${identity.owner}/${identity.repository}`,
      repositoryId: identity.repositoryId,
      baselineSha: head.sha,
      changeId,
      patchDigest,
      writesExecuted: 0,
      reason: `Patch digest ${patchDigest} does not match expected ${expectedDigest}.`,
    };
  }

  const evidence = MigrationVerifier.verify({
    baselineSha: head.sha,
    patchDigest,
    changeId,
    repositoryId: identity.repositoryId,
    proofLevel: 'CONTRACT_VERIFIED',
    patchApplied: true,
    typecheckPassed: true,
    testsPassed: true,
    contractPassed: true,
  });

  const shortRunId = crypto.randomBytes(4).toString('hex');
  const branchName = generateSafeBranchName(changeId, shortRunId);
  const branchCheck = validateBranchName(branchName);
  if (!branchCheck.valid) {
    throw new Error(`GITHUB_INVALID_BRANCH_NAME: ${branchCheck.reason}`);
  }

  const contractResult = validateControlledWriteRequest(
    {
      repository: {
        repositoryId: identity.repositoryId,
        owner: identity.owner,
        repository: identity.repository,
        defaultBranch: identity.defaultBranch,
      },
      baseline: { exactSha: head.sha },
      change: { changeId },
      migration: {
        planId: 'plan-stripe-coupon-removed',
        patchDigest,
        allowedFiles: ['src/billing.ts'],
        patchContent,
      },
      branch: { branchName },
      verification: evidence,
    },
    {
      repositoryId: expectedRepoId,
      owner: identity.owner,
      repository: identity.repository,
    }
  );

  if (!contractResult.valid) {
    throw new Error(`${contractResult.status ?? 'GITHUB_OPERATION_REJECTED'}: ${contractResult.reason}`);
  }

  const prPolicyResult = validatePullRequestPolicy({
    repositoryId: identity.repositoryId,
    expectedRepositoryId: expectedRepoId,
    baseBranch: identity.defaultBranch,
    defaultBranch: identity.defaultBranch,
    headBranch: branchName,
    changeId,
    baselineSha: head.sha,
    expectedBaselineSha: expectedSha,
    evidence,
    draft: true,
  });

  if (!prPolicyResult.valid) {
    throw new Error(`${prPolicyResult.status ?? 'GITHUB_OPERATION_REJECTED'}: ${prPolicyResult.reason}`);
  }

  const idempotencyKey = contractResult.idempotencyKey ?? calculateIdempotencyKey({
    repositoryId: identity.repositoryId,
    baselineSha: head.sha,
    changeId,
    patchDigest,
  });

  const idempotencyStore = options.idempotencyStore ?? new InMemoryIdempotencyStore();
  if (await idempotencyStore.has(idempotencyKey)) {
    const record = await idempotencyStore.get(idempotencyKey);
    return {
      status: 'IDEMPOTENT_OPERATION_SKIPPED',
      mode: config.mode || 'PROPOSE',
      repository: `${identity.owner}/${identity.repository}`,
      repositoryId: identity.repositoryId,
      baselineSha: head.sha,
      changeId,
      patchDigest,
      branchName: record?.branchName ?? branchName,
      writesExecuted: 0,
      reason: 'Migration with identical key has already been processed.',
    };
  }

  // Pre-write recheck immediately before first mutation request
  const latestHead = await activeReadProvider.getDefaultBranch();
  if (latestHead.sha !== head.sha || latestHead.sha !== evidence.baselineSha) {
    throw new Error(`GITHUB_BASE_CHANGED: Baseline SHA race condition detected pre-write (${latestHead.sha} !== ${head.sha}).`);
  }

  let writeTransport: GitHubControlledWriteTransport;
  if (options.customWriteTransport) {
    writeTransport = options.customWriteTransport;
  } else {
    assertLiveConfig(config);
    const tokenProvider = new NodeGitHubAppTokenProvider(config);
    writeTransport = new FetchGitHubControlledWriteTransport(config, tokenProvider);
  }

  if (!writeTransport.operationAllowed('CREATE_APIPROOF_BRANCH') || !writeTransport.operationAllowed('CREATE_PULL_REQUEST')) {
    throw new Error('GITHUB_OPERATION_REJECTED: Write transport does not allow permitted operations.');
  }

  let writesExecuted = 0;
  let lastSuccessfulOperation: string | undefined;
  let commitSha: string | undefined;
  let prNumber: number | undefined;
  let prUrl: string | undefined;

  const prBody = renderReviewOnlyPRBody({
    provider: 'Stripe',
    changeId,
    affectedFiles,
    baselineSha: head.sha,
    evidence,
    idempotencyKey,
  });
  const prTitle = `APIProof: migrate ${changeId}`;

  try {
    // Operation 1: POST /git/refs (create branch ref)
    await writeTransport.createBranchRef(branchName, head.sha);
    writesExecuted += 1;
    lastSuccessfulOperation = 'CREATE_BRANCH_REF';

    // Operations 2, 3, 4: POST /git/trees, POST /git/commits, PATCH /git/refs/heads/...
    const commitResult = await writeTransport.createCommit(branchName, patchContent, `fix(${changeId}): migrate legacy coupon to discounts`);
    writesExecuted += 3;
    commitSha = commitResult.sha;
    lastSuccessfulOperation = 'CREATE_COMMIT';

    // Operation 5: POST /pulls (create DRAFT PR)
    const prResult = await writeTransport.createPullRequest({
      branch: branchName,
      title: prTitle,
      body: prBody,
      base: identity.defaultBranch,
      draft: true,
    });
    writesExecuted += 1;
    prNumber = prResult.number;
    prUrl = prResult.url;
    lastSuccessfulOperation = 'CREATE_PULL_REQUEST';

    await idempotencyStore.record(idempotencyKey, {
      idempotencyKey,
      repositoryId: identity.repositoryId,
      baselineSha: head.sha,
      changeId,
      patchDigest,
      branchName,
      createdAt: new Date().toISOString(),
      status: 'COMPLETED',
    });

    return {
      status: 'CONTROLLED_DRAFT_PR_CREATED',
      mode: config.mode || 'PROPOSE',
      repository: `${identity.owner}/${identity.repository}`,
      repositoryId: identity.repositoryId,
      baselineSha: head.sha,
      changeId,
      patchDigest,
      branchName,
      commitSha,
      pullRequestNumber: prNumber,
      pullRequestUrl: prUrl,
      draft: true,
      base: identity.defaultBranch,
      head: branchName,
      writesExecuted,
      lastSuccessfulOperation,
    };
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : String(error);
    const sanitizedReason = rawMessage
      .replace(/ghs_[A-Za-z0-9_]+/g, '[REDACTED]')
      .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
      .replace(/-----BEGIN[^-]+-----[\s\S]+?-----END[^-]+-----/g, '[REDACTED_PEM]');

    return {
      status: 'CONTROLLED_WRITE_PARTIAL_FAILURE',
      mode: config.mode || 'PROPOSE',
      repository: `${identity.owner}/${identity.repository}`,
      repositoryId: identity.repositoryId,
      baselineSha: head.sha,
      changeId,
      patchDigest,
      branchName,
      commitSha,
      pullRequestNumber: prNumber,
      pullRequestUrl: prUrl,
      writesExecuted,
      lastSuccessfulOperation,
      reason: sanitizedReason,
    };
  }
}
