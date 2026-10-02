import crypto from 'node:crypto';
import {
  FakeGitHubWriteTransport,
  FetchGitHubControlledWriteTransport,
  NodeGitHubAppTokenProvider,
  loadGitHubAppConfig,
  assertLiveWriteConfig,
  validateControlledWriteRequest,
  validatePatchScope,
  formatCanonicalMigrationBranch,
  type ControlledWriteRequest,
  type GitHubControlledWriteTransport,
} from '@apiproof/core';
import { getDatabase } from './db/index.js';
import { requireMigrationAccess, getWorkspaceGitHubInstallation } from './workspace-service.js';
import { checkWorkspaceLimit, recordWorkspaceUsage } from './billing/service.js';
import { validatePersistedMigrationEvidence, verifyMigrationForProposal } from './migration-verification.js';

export interface ProposalResult {
  pullRequestId: string;
  number: number;
  title: string;
  url: string;
  branchName: string;
  baseBranch: string;
  state: 'draft';
  humanReviewRequired: boolean;
  autoMergeEnabled: boolean;
  patchDigest: string;
  createdAt: string;
}

export async function createGitHubProposal(
  migrationId: string,
  userId: string,
  customTransport?: GitHubControlledWriteTransport
): Promise<ProposalResult> {
  const db = getDatabase();

  // 1. Fetch migration and verify workspace access (central authorization / IDOR protection)
  const { migration: rawMigration, repository: repo, workspace } = await requireMigrationAccess(migrationId, userId);

  // 1a. Billing limit check (runs after workspace authorization)
  const limitCheck = await checkWorkspaceLimit(workspace.id, 'draft_prs');
  if (!limitCheck.allowed) {
    throw new Error(limitCheck.reason);
  }

  const finding = await db.queryOne<{ change_id: string; file_path: string; symbol: string; id: string; repository_id: string; usage_id: string; provider: string; confidence: number; line_number: number; reason: string; reason_codes: string; evidence: string; source_snippet: string | null; source_digest: string | null }>(`
    SELECT id, change_id, file_path, symbol, repository_id, usage_id, provider, confidence, line_number, reason, reason_codes, evidence, source_snippet, source_digest FROM findings WHERE id = ?
  `, [rawMigration.finding_id]);

  if (!finding) {
    throw new Error('Finding for migration not found.');
  }

  const migration = {
    ...rawMigration,
    change_id: finding.change_id,
    file_path: finding.file_path,
    symbol: finding.symbol,
    repo_id: repo.id,
    repo_owner: repo.owner,
    repo_name: repo.name,
    repo_full_name: repo.full_name,
    github_repository_id: repo.github_repository_id,
    default_branch: repo.default_branch,
  };

  // 1b. Resolve and validate the exact scan baseline SHA
  let baselineSha = (rawMigration.baseline_sha as string | undefined)?.trim();
  if (!baselineSha) {
    const scanRow = await db.queryOne<{ sha: string }>(`
      SELECT s.sha
      FROM findings f
      JOIN scans s ON f.scan_id = s.id
      WHERE f.id = ? AND s.repository_id = ?
    `, [rawMigration.finding_id, repo.id]);
    baselineSha = scanRow?.sha?.trim();
  }
  if (!baselineSha || !/^[a-f0-9]{40}$/i.test(baselineSha)) throw new Error('BASELINE_SHA_INVALID: Valid 40-character commit SHA required for migration proposal.');
  const repoScan = await db.queryOne<{ id: string }>('SELECT s.id FROM scans s WHERE s.repository_id = ? AND s.sha = ? AND s.status = \'completed\'', [repo.id, baselineSha]);
  if (!repoScan) throw new Error(`BASELINE_SHA_REPOSITORY_MISMATCH: Baseline SHA ${baselineSha} does not belong to repository ${repo.full_name}.`);

  // 1c. Check if a PR already exists for this migration (idempotent proposal creation).
  // Existing PRs are only returned when their persisted evidence is still bound.
  const existingPr = await db.queryOne<{
    id: string;
    number: number;
    title: string;
    branch_name: string;
    base_branch: string;
    url: string;
    state: string;
    created_at: string;
  }>(`
    SELECT id, number, title, branch_name, base_branch, url, state, created_at
    FROM pull_requests
    WHERE migration_id = ?
  `, [migration.id]);

  if (existingPr) {
    validatePersistedMigrationEvidence(rawMigration.verification_report, { repositoryId: migration.github_repository_id, baselineSha, changeId: migration.change_id, patchDigest: migration.patch_digest ?? '' });
    return {
      pullRequestId: existingPr.id,
      number: existingPr.number,
      title: existingPr.title,
      url: existingPr.url,
      branchName: existingPr.branch_name,
      baseBranch: existingPr.base_branch,
      state: 'draft',
      humanReviewRequired: true,
      autoMergeEnabled: false,
      patchDigest: migration.patch_digest,
      createdAt: existingPr.created_at,
    };
  }

  // 2. Apply the deterministic patch to the exact source snapshot and run execution verification.
  const verified = await verifyMigrationForProposal({ migration: { ...rawMigration, baseline_sha: baselineSha }, finding: { ...finding, source_digest: finding.source_digest }, repo });
  migration.patch_digest = verified.patchDigest;
  migration.patch_content = JSON.stringify(verified.patchContent);

  // 3. Validate Patch Scope (no .env, .github, etc.)
  const patchScopeCheck = validatePatchScope(Object.keys(verified.patchContent), Object.keys(verified.patchContent));
  if (!patchScopeCheck.valid) {
    throw new Error(`Controlled write rejected by patch scope policy: ${patchScopeCheck.reason}`);
  }

  // 4. Construct the controlled write request from complete resulting files.
  const branchName = formatCanonicalMigrationBranch(migration.change_id, migration.id);

  const writeRequest: ControlledWriteRequest = {
    repository: {
      repositoryId: migration.github_repository_id,
      owner: migration.repo_owner,
      repository: migration.repo_name,
      defaultBranch: migration.default_branch,
    },
    baseline: {
      exactSha: baselineSha,
    },
    change: {
      changeId: migration.change_id,
    },
    migration: {
      planId: migration.plan_id,
      patchDigest: verified.patchDigest,
      allowedFiles: Object.keys(verified.patchContent),
      patchContent: verified.patchContent,
    },
    branch: {
      branchName,
    },
    verification: verified.evidence,
  };

  // 4. Validate through Core write contract
  const validation = validateControlledWriteRequest(writeRequest, {
    repositoryId: migration.github_repository_id,
    owner: migration.repo_owner,
    repository: migration.repo_name,
  }, { requireExecutionEvidence: true });

  if (!validation.valid) {
    throw new Error(`Controlled write rejected by safety contract: ${validation.reason}`);
  }

  // 5. Select transport: custom transport only for local/test execution, or the live controlled GitHub transport.
  const isProduction = process.env.NODE_ENV === 'production';
  const isLiveWrite = process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE === 'true';
  let transport: GitHubControlledWriteTransport;

  if (customTransport) {
    if (isProduction) {
      throw new Error('GITHUB_WRITE_CONFIGURATION_INVALID: Custom GitHub write transports are forbidden in production.');
    }
    transport = customTransport;
  } else if (isLiveWrite || isProduction) {
    const config = loadGitHubAppConfig();
    assertLiveWriteConfig(config, isProduction);
    const tokenProvider = new NodeGitHubAppTokenProvider(config, { allowAnyRepository: true });

    const installation = await getWorkspaceGitHubInstallation(repo.workspace_id);
    if (!installation) {
      throw new Error('WORKSPACE_GITHUB_NOT_CONNECTED: Cannot create live pull request without connected workspace GitHub installation.');
    }

    const writeConfig = {
      ...config,
      installationId: installation.installationId,
      repositoryId: repo.github_repository_id,
      owner: repo.owner,
      repository: repo.name,
    };

    transport = new FetchGitHubControlledWriteTransport(writeConfig, tokenProvider, undefined, undefined, {
      workspaceAuthorized: true,
    });
  } else {
    transport = new FakeGitHubWriteTransport(
      migration.repo_owner,
      migration.repo_name,
      migration.default_branch,
      baselineSha
    );
  }

  // Invariant 8: Check if repository default branch HEAD has moved since scan was performed
  if (transport.getDefaultBranchSha) {
    const remoteHeadSha = await transport.getDefaultBranchSha(migration.default_branch);
    if (remoteHeadSha && remoteHeadSha !== baselineSha) {
      await db.execute('UPDATE migrations SET status = ?, patch_digest = NULL, patch_content = NULL, verification_report = NULL WHERE id = ?', ['planned', migration.id]);
      throw new Error(`REPOSITORY_HEAD_DIVERGED: Target repository default branch HEAD (${remoteHeadSha.slice(0, 7)}) has moved since scan was performed (${baselineSha.slice(0, 7)}). A fresh scan is required before proposing a migration.`);
    }
  }

  const title = `fix(api): deterministic migration for ${migration.change_id}`;
  const prBody = `## MY OWL Deterministic Migration Proposal

### Summary
* **Change ID**: \`${migration.change_id}\`
* **Affected Call Site**: \`${migration.symbol}\` in \`${migration.file_path}\`
* **Patch Digest**: \`${migration.patch_digest}\`
* **Verification Proof**: \`CONTRACT_VERIFIED\` (4/4 gates passed)

### Safety Guarantees
* **Draft PR**: Opened in review-only mode.
* **No Auto-Merge**: Automated merge is strictly forbidden by policy.
* **No Default Branch Modification**: Targeted isolated branch \`${branchName}\`.
* **Human Review**: Maintainer review is mandatory prior to integration.`;

  // GAP 2: Check if an existing open PR on GitHub is already attributable to this deterministic branch
  if (transport.findOpenPullRequestByHead) {
    const remotePr = await transport.findOpenPullRequestByHead(branchName);
    if (remotePr) {
      if (remotePr.base !== migration.default_branch) {
        throw new Error(`GITHUB_PR_CONFLICT: Existing PR #${remotePr.number} targets base '${remotePr.base}' instead of default branch '${migration.default_branch}'.`);
      }
      if (remotePr.head !== branchName) {
        throw new Error(`GITHUB_PR_CONFLICT: Existing PR #${remotePr.number} head branch '${remotePr.head}' does not match expected branch '${branchName}'.`);
      }
      if (remotePr.draft !== true) {
        throw new Error(`GITHUB_PR_CONFLICT: Existing PR #${remotePr.number} on branch '${branchName}' is not a draft PR.`);
      }

      // Reconcile / adopt existing GitHub Draft PR into PostgreSQL
      return await persistPullRequestRecord(db, {
        migrationId: migration.id,
        repositoryId: migration.repository_id,
        findingId: migration.finding_id,
        workspaceId: workspace.id,
        userId,
        changeId: migration.change_id,
        prNumber: remotePr.number,
        title: remotePr.title || title,
        branchName,
        baseBranch: migration.default_branch,
        url: remotePr.url,
        patchDigest: migration.patch_digest,
      });
    }
  }

  let prResult: { number: number; url: string };
  try {
    await transport.createBranchRef(branchName, writeRequest.baseline.exactSha);
    await transport.createCommit(branchName, writeRequest.migration.patchContent, title, writeRequest.baseline.exactSha);
    prResult = await transport.createPullRequest({
      branch: branchName,
      title,
      body: prBody,
      base: migration.default_branch,
      draft: true,
    });
  } catch (err: unknown) {
    // GAP 3: Check if a concurrent proposal created the PR in DB or on GitHub
    const concurrentDbPr = await db.queryOne<{
      id: string;
      number: number;
      title: string;
      branch_name: string;
      base_branch: string;
      url: string;
      state: string;
      created_at: string;
    }>(`
      SELECT id, number, title, branch_name, base_branch, url, state, created_at
      FROM pull_requests
      WHERE migration_id = ?
    `, [migration.id]);

    if (concurrentDbPr) {
      return {
        pullRequestId: concurrentDbPr.id,
        number: concurrentDbPr.number,
        title: concurrentDbPr.title,
        url: concurrentDbPr.url,
        branchName: concurrentDbPr.branch_name,
        baseBranch: concurrentDbPr.base_branch,
        state: 'draft',
        humanReviewRequired: true,
        autoMergeEnabled: false,
        patchDigest: migration.patch_digest,
        createdAt: concurrentDbPr.created_at,
      };
    }

    if (transport.findOpenPullRequestByHead) {
      const remotePr = await transport.findOpenPullRequestByHead(branchName);
      if (remotePr && remotePr.draft === true && remotePr.base === migration.default_branch && remotePr.head === branchName) {
        return await persistPullRequestRecord(db, {
          migrationId: migration.id,
          repositoryId: migration.repository_id,
          findingId: migration.finding_id,
          workspaceId: workspace.id,
          userId,
          changeId: migration.change_id,
          prNumber: remotePr.number,
          title: remotePr.title || title,
          branchName,
          baseBranch: migration.default_branch,
          url: remotePr.url,
          patchDigest: migration.patch_digest,
        });
      }
    }

    throw err;
  }

  return await persistPullRequestRecord(db, {
    migrationId: migration.id,
    repositoryId: migration.repository_id,
    findingId: migration.finding_id,
    workspaceId: workspace.id,
    userId,
    changeId: migration.change_id,
    prNumber: prResult.number,
    title,
    branchName,
    baseBranch: migration.default_branch,
    url: prResult.url,
    patchDigest: migration.patch_digest,
  });
}

async function persistPullRequestRecord(
  db: ReturnType<typeof getDatabase>,
  params: {
    migrationId: string;
    repositoryId: string;
    findingId: string;
    workspaceId: string;
    userId: string;
    changeId: string;
    prNumber: number;
    title: string;
    branchName: string;
    baseBranch: string;
    url: string;
    patchDigest: string;
  }
): Promise<ProposalResult> {
  const pullRequestId = `pr_${crypto.randomBytes(12).toString('hex')}`;
  const now = new Date().toISOString();

  try {
    await db.transaction(async (tx) => {
      await tx.execute(`
        INSERT INTO pull_requests (
          id, migration_id, repository_id, number, title, branch_name, base_branch, url, state, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?)
      `, [
        pullRequestId,
        params.migrationId,
        params.repositoryId,
        params.prNumber,
        params.title,
        params.branchName,
        params.baseBranch,
        params.url,
        now,
      ]);

      await tx.execute('UPDATE migrations SET status = ? WHERE id = ?', ['pr_created', params.migrationId]);
      await tx.execute('UPDATE findings SET status = ? WHERE id = ?', ['pr_created', params.findingId]);
      await tx.execute('UPDATE repositories SET status = ? WHERE id = ?', ['migration_ready', params.repositoryId]);

      await tx.execute(`
        INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        `act_${crypto.randomBytes(10).toString('hex')}`,
        params.userId,
        params.repositoryId,
        'pr_created',
        'Draft PR Generated',
        `Opened review-only Draft PR #${params.prNumber} for ${params.changeId}.`,
        now,
      ]);
    });

    await recordWorkspaceUsage(params.workspaceId, 'draft_prs');

    return {
      pullRequestId,
      number: params.prNumber,
      title: params.title,
      url: params.url,
      branchName: params.branchName,
      baseBranch: params.baseBranch,
      state: 'draft',
      humanReviewRequired: true,
      autoMergeEnabled: false,
      patchDigest: params.patchDigest,
      createdAt: now,
    };
  } catch (err: unknown) {
    const existingPr = await db.queryOne<{
      id: string;
      number: number;
      title: string;
      branch_name: string;
      base_branch: string;
      url: string;
      state: string;
      created_at: string;
    }>(`
      SELECT id, number, title, branch_name, base_branch, url, state, created_at
      FROM pull_requests
      WHERE migration_id = ?
    `, [params.migrationId]);

    if (existingPr) {
      return {
        pullRequestId: existingPr.id,
        number: existingPr.number,
        title: existingPr.title,
        url: existingPr.url,
        branchName: existingPr.branch_name,
        baseBranch: existingPr.base_branch,
        state: 'draft',
        humanReviewRequired: true,
        autoMergeEnabled: false,
        patchDigest: params.patchDigest,
        createdAt: existingPr.created_at,
      };
    }

    throw err;
  }
}
