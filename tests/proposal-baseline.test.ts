import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { FakeGitHubWriteTransport } from '@apiproof/core';
import { initDatabase, closeDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUser } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';

const TEST_DB_PATH = path.resolve('.tmp/test-proposal-baseline.db');

describe('Proposal Baseline SHA & Consistency Safety Suite', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'test-secret-32-bytes-long-for-evidence';
    delete process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE;

    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    db = initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    delete process.env.APIPROOF_DB_PATH;
    delete process.env.APIPROOF_SECRET;
    delete process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE;
  });

  // Helper to setup repository, scan, finding, and migration
  function setupRepoWithScanAndFinding(params: {
    userId: string;
    workspaceId: string;
    repoId: string;
    owner: string;
    name: string;
    githubRepoId: string;
    scanId: string;
    scanSha: string;
    findingId: string;
  }) {
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'main', 'connected', ?)
    `).run(params.repoId, params.workspaceId, params.userId, params.owner, params.name, `${params.owner}/${params.name}`, params.githubRepoId, now);

    db.prepare(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at, completed_at)
      VALUES (?, ?, ?, 'completed', 'stripe', ?, ?)
    `).run(params.scanId, params.repoId, params.scanSha, now, now);

    db.prepare(`
      INSERT INTO findings (
        id, scan_id, repository_id, usage_id, change_id, provider, title, description,
        severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, source_snippet, created_at
      )
      VALUES (?, ?, ?, 'u1', 'stripe-subscription-coupon-removed', 'stripe', 'Coupon removed', 'desc', 'critical', 0.95, 'src/billing.ts', 10, 'stripe.subscriptions.create', 'open', 'reason', '[]', '[]', 'coupon: couponId', ?)
    `).run(params.findingId, params.scanId, params.repoId, now);
  }

  // =========================================================================
  // Requirement 10a: Migration for Repo A never uses Repo B's SHA
  // =========================================================================
  it('10a: Migration for repository A never uses repository B SHA (fails closed)', async () => {
    const user = createUser('isolation@example.com', 'Pass12345!', 'Isolation Tester');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const shaA = '1111111111111111111111111111111111111111';
    const shaB = '2222222222222222222222222222222222222222';

    setupRepoWithScanAndFinding({
      userId: user.id,
      workspaceId: ws.id,
      repoId: 'repo_alpha',
      owner: 'org-a',
      name: 'service-alpha',
      githubRepoId: '100001',
      scanId: 'scn_alpha',
      scanSha: shaA,
      findingId: 'fnd_alpha',
    });

    setupRepoWithScanAndFinding({
      userId: user.id,
      workspaceId: ws.id,
      repoId: 'repo_beta',
      owner: 'org-b',
      name: 'service-beta',
      githubRepoId: '100002',
      scanId: 'scn_beta',
      scanSha: shaB,
      findingId: 'fnd_beta',
    });

    // Generate valid migration for Repo A
    const migrationA = await generateMigrationForFinding('fnd_alpha', user.id);
    expect(migrationA.baselineSha).toBe(shaA);

    // Tamper with migration A to maliciously or mistakenly point to Repo B's SHA
    db.prepare('UPDATE migrations SET baseline_sha = ? WHERE id = ?').run(shaB, migrationA.id);

    // Attempt proposal for Repo A: must be rejected with BASELINE_SHA_REPOSITORY_MISMATCH
    await expect(createGitHubProposal(migrationA.id, user.id)).rejects.toThrow(
      /BASELINE_SHA_REPOSITORY_MISMATCH: Baseline SHA 2222222222222222222222222222222222222222 does not belong to repository org-a\/service-alpha/
    );

    // Ensure zero PR rows created
    const prCount = db.prepare('SELECT COUNT(*) as c FROM pull_requests WHERE migration_id = ?').get(migrationA.id) as { c: number };
    expect(prCount.c).toBe(0);
  });

  // =========================================================================
  // Requirement 10b: Proposal uses the exact scan baseline SHA
  // =========================================================================
  it('10b: Proposal uses the exact scan baseline SHA throughout evidence and branch creation', async () => {
    const user = createUser('exact_sha@example.com', 'Pass12345!', 'Exact SHA Tester');
    const ws = await getDefaultWorkspaceForUser(user.id);

    // Specific custom SHA distinct from fixture
    const exactScanSha = 'a3f8901234567890abcdef1234567890abcdef12';

    setupRepoWithScanAndFinding({
      userId: user.id,
      workspaceId: ws.id,
      repoId: 'repo_exact',
      owner: 'pavanvarma-creator',
      name: 'student-tools',
      githubRepoId: '987654321',
      scanId: 'scn_exact',
      scanSha: exactScanSha,
      findingId: 'fnd_exact',
    });

    const migration = await generateMigrationForFinding('fnd_exact', user.id);
    expect(migration.baselineSha).toBe(exactScanSha);

    // Verify persisted in migrations table
    const storedMig = db.prepare('SELECT baseline_sha FROM migrations WHERE id = ?').get(migration.id) as { baseline_sha: string };
    expect(storedMig.baseline_sha).toBe(exactScanSha);

    // Create transport tracking branch creation
    const transport = new FakeGitHubWriteTransport(
      'pavanvarma-creator',
      'student-tools',
      'main',
      exactScanSha
    );

    const proposal = await createGitHubProposal(migration.id, user.id, transport);
    expect(proposal.pullRequestId).toBeDefined();

    // Verify transport received the EXACT baseline SHA for branch ref creation
    const branchCall = transport.recordedCalls.find((c) => c.method === 'POST' && c.path.endsWith('/git/refs'));
    expect(branchCall).toBeDefined();
    expect((branchCall?.body as { sha?: string })?.sha).toBe(exactScanSha);

    // Verify transport created branch pointing to exactScanSha
    expect(transport.branches.get(proposal.branchName)).toBeDefined();
  });

  // =========================================================================
  // Requirement 10c: Fails closed when analyzed SHA is no longer default-branch HEAD
  // =========================================================================
  it('10c: Proposal fails closed when analyzed SHA is no longer default-branch HEAD (REPOSITORY_HEAD_DIVERGED)', async () => {
    const user = createUser('diverged@example.com', 'Pass12345!', 'Diverged Tester');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const scanSha = '4444444444444444444444444444444444444444';
    const movedHeadSha = '5555555555555555555555555555555555555555';

    setupRepoWithScanAndFinding({
      userId: user.id,
      workspaceId: ws.id,
      repoId: 'repo_diverged',
      owner: 'org-c',
      name: 'repo-c',
      githubRepoId: '100003',
      scanId: 'scn_diverged',
      scanSha: scanSha,
      findingId: 'fnd_diverged',
    });

    const migration = await generateMigrationForFinding('fnd_diverged', user.id);

    // Transport simulates that remote default branch 'main' has moved to movedHeadSha
    const divergedTransport = new FakeGitHubWriteTransport(
      'org-c',
      'repo-c',
      'main',
      movedHeadSha
    );

    // Must fail closed with clear, user-facing, sanitized error
    await expect(createGitHubProposal(migration.id, user.id, divergedTransport)).rejects.toThrow(
      /REPOSITORY_HEAD_DIVERGED: Target repository default branch HEAD \(5555555\) has moved since scan was performed \(4444444\)\. A fresh scan is required before proposing a migration\./
    );

    // Verify NO branch, commit, or PR was created
    expect(divergedTransport.branches.size).toBe(0);
    expect(divergedTransport.prs.length).toBe(0);
    expect(divergedTransport.recordedCalls.length).toBe(0);

    // Verify DB remains clean (migration still 'planned')
    const migCheck = db.prepare('SELECT status FROM migrations WHERE id = ?').get(migration.id) as { status: string };
    expect(migCheck.status).toBe('planned');
  });

  // =========================================================================
  // Requirement 10d: Valid repository-specific SHA creates branch successfully
  // =========================================================================
  it('10d: Valid repository-specific SHA creates branch and draft PR through fake transport', async () => {
    const user = createUser('valid_branch@example.com', 'Pass12345!', 'Valid Branch Tester');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const repoSha = '6666666666666666666666666666666666666666';

    setupRepoWithScanAndFinding({
      userId: user.id,
      workspaceId: ws.id,
      repoId: 'repo_success',
      owner: 'test-org',
      name: 'success-repo',
      githubRepoId: '100004',
      scanId: 'scn_success',
      scanSha: repoSha,
      findingId: 'fnd_success',
    });

    const migration = await generateMigrationForFinding('fnd_success', user.id);

    const proposal = await createGitHubProposal(migration.id, user.id);
    expect(proposal.pullRequestId).toBeDefined();
    expect(proposal.state).toBe('draft');
    expect(proposal.number).toBe(1);

    // Migration and finding updated
    const migCheck = db.prepare('SELECT status FROM migrations WHERE id = ?').get(migration.id) as { status: string };
    expect(migCheck.status).toBe('pr_created');
  });

  // =========================================================================
  // Requirement 10e: Existing proposal recovery & idempotency pass
  // =========================================================================
  it('10e: Proposal idempotency returns existing PR without additional writes', async () => {
    const user = createUser('idempotent@example.com', 'Pass12345!', 'Idempotent Tester');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const repoSha = '7777777777777777777777777777777777777777';

    setupRepoWithScanAndFinding({
      userId: user.id,
      workspaceId: ws.id,
      repoId: 'repo_idempotent',
      owner: 'test-org',
      name: 'idempotent-repo',
      githubRepoId: '100005',
      scanId: 'scn_idempotent',
      scanSha: repoSha,
      findingId: 'fnd_idempotent',
    });

    const migration = await generateMigrationForFinding('fnd_idempotent', user.id);

    const first = await createGitHubProposal(migration.id, user.id);
    const second = await createGitHubProposal(migration.id, user.id);

    expect(second.pullRequestId).toBe(first.pullRequestId);
    expect(second.number).toBe(first.number);
    expect(second.url).toBe(first.url);

    const prCount = db.prepare('SELECT COUNT(*) as c FROM pull_requests WHERE migration_id = ?').get(migration.id) as { c: number };
    expect(prCount.c).toBe(1);
  });

  // =========================================================================
  // Requirement 10f: Hardcoded fixture SHA is absent from production proposal code
  // =========================================================================
  it('10f: Hardcoded developer fixture SHA b1be45... is completely absent from proposal-service.ts', () => {
    const proposalServicePath = path.resolve('apps/web/src/lib/server/proposal-service.ts');
    const content = fs.readFileSync(proposalServicePath, 'utf8');

    const fixtureSha = 'b1be45b401f41106ecfd489bbbb1fff71639c763';
    expect(content.includes(fixtureSha)).toBe(false);
  });
});
