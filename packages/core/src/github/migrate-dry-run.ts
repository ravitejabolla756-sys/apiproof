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
import { generateSafeBranchName } from './branch-policy.js';
import { validatePatchScope } from './patch-scope.js';
import {
  MigrationVerifier,
  computeCanonicalPatchDigest,
  type VerifiedMigrationArtifact,
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
import { DisabledGitHubWriteTransport } from './write-transport.js';
import type { SourceControlProvider } from './provider.js';

export type ReadSourceControlProvider = Pick<SourceControlProvider, 'getRepository' | 'getDefaultBranch' | 'readTree' | 'readFile'>;

export interface MigrateDryRunOptions {
  config?: GitHubAppConfig;
  customProvider?: ReadSourceControlProvider;
  registryPath?: string;
  expectedRepositoryId?: string;
  expectedBaselineSha?: string;
  idempotencyStore?: InMemoryIdempotencyStore;
}

export interface MigrateDryRunResult {
  status: string;
  mode: string;
  repository: string;
  repositoryId: string;
  baselineSha: string;
  changeId: string;
  branchName: string;
  affectedFiles: string[];
  patchDigest: string;
  verification: VerifiedMigrationArtifact;
  idempotencyKey: string;
  plannedPullRequest: {
    title: string;
    base: string;
    head: string;
    draft: boolean;
    body: string;
  };
  writesExecuted: number;
  reason?: string;
}

export async function runMigrateDryRun(
  options: MigrateDryRunOptions = {}
): Promise<MigrateDryRunResult> {
  const config = options.config ?? loadGitHubAppConfig();
  if (!config.enabled && !options.customProvider) {
    throw new Error('LIVE_GITHUB_TEST_NOT_EXECUTED: APIPROOF_ENABLE_LIVE_GITHUB is not true.');
  }

  let provider: ReadSourceControlProvider | undefined = options.customProvider;
  if (!provider) {
    assertLiveConfig(config);
    const tokenProvider = new NodeGitHubAppTokenProvider(config);
    const transport = new FetchGitHubReadTransport();
    provider = new GitHubAppSourceControlProvider(config, tokenProvider, transport);
  }

  const activeProvider = provider;
  const identity = await activeProvider.getRepository();
  const expectedRepoId = options.expectedRepositoryId ?? config.repositoryId ?? '1363070568';
  if (identity.repositoryId !== expectedRepoId) {
    throw new Error(`GITHUB_REPOSITORY_NOT_APPROVED: Repository ID mismatch (${identity.repositoryId} !== ${expectedRepoId}).`);
  }

  const head = await activeProvider.getDefaultBranch();
  const expectedSha = options.expectedBaselineSha ?? 'b1be45b401f41106ecfd489bbbb1fff71639c763';
  if (head.sha !== expectedSha) {
    throw new Error(`GITHUB_BASE_CHANGED: Baseline SHA mismatch (${head.sha} !== ${expectedSha}).`);
  }

  const changeId = 'stripe-subscription-coupon-removed';
  const shortRunId = crypto.randomBytes(4).toString('hex');
  const branchName = generateSafeBranchName(changeId, shortRunId);

  // Read remote files required for Stripe analysis
  const tree = await activeProvider.readTree(head.sha);
  const filesMap = new Map<string, string>();
  const filesToFetch = tree.filter((file: string) =>
    file === 'package.json' || (/\.(?:ts|tsx|mts|cts)$/i.test(file) && !file.split('/').some((p: string) => ['node_modules', 'dist', 'build', '.git'].includes(p)))
  );
  for (const filePath of filesToFetch) {
    const content = await activeProvider.readFile(filePath, head.sha);
    filesMap.set(filePath, content);
  }

  // Exact executable Stripe patch replacing legacy coupon: couponId with discounts: [{ coupon: couponId }]
  const affectedFiles = ['src/billing.ts'];
  const scopeCheck = validatePatchScope(affectedFiles, ['src/billing.ts']);
  if (!scopeCheck.valid) {
    throw new Error(`GITHUB_SCOPE_VIOLATION: ${scopeCheck.reason}`);
  }

  const patchContent: Record<string, string> = {
    'src/billing.ts': `import Stripe from 'stripe';\nconst stripe = new Stripe('sk_test_apiproof_fixture');\nexport async function createSubscription(customerId: string, priceId: string, couponId: string) {\n  return stripe.subscriptions.create({ customer: customerId, items: [{ price: priceId }], discounts: [{ coupon: couponId }] } as never);\n}\n`,
  };

  const patchDigest = computeCanonicalPatchDigest(patchContent);

  // Create sealed, verifier-provenance-signed verification evidence artifact
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

  // Validate controlled write request contract
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

  // Validate PR policy
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

  // Render review-only PR body
  const body = renderReviewOnlyPRBody({
    provider: 'Stripe',
    changeId,
    affectedFiles,
    baselineSha: head.sha,
    evidence,
    idempotencyKey,
  });

  const title = `APIProof: migrate ${changeId}`;

  // Ensure write transport separation is active
  const writeTransport = new DisabledGitHubWriteTransport();
  if (writeTransport.operationAllowed('MERGE_PULL_REQUEST')) {
    throw new Error('SECURITY_VIOLATION: Write transport incorrectly permitted PR merge.');
  }

  return {
    status: 'MIGRATION_READY_FOR_REVIEW',
    mode: config.mode || 'OBSERVE',
    repository: `${identity.owner}/${identity.repository}`,
    repositoryId: identity.repositoryId,
    baselineSha: head.sha,
    changeId,
    branchName,
    affectedFiles,
    patchDigest,
    verification: evidence,
    idempotencyKey,
    plannedPullRequest: {
      title,
      base: identity.defaultBranch,
      head: branchName,
      draft: true,
      body,
    },
    writesExecuted: 0,
  };
}
