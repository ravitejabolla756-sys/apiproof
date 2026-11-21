import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import {
  FakeGitHubWriteTransport,
  FetchGitHubControlledWriteTransport,
  GitHubAppSourceControlProvider,
  type GitHubAppConfig,
  type InstallationTokenProvider,
  type GitHubReadTransport,
} from '@apiproof/core';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUser, createSession } from '../apps/web/src/lib/server/auth.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';
import * as proposalService from '../apps/web/src/lib/server/proposal-service.js';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';
import { POST as proposeRoutePost } from '../apps/web/src/app/api/migrations/propose/route.js';
import { runRepositoryScan } from '../apps/web/src/lib/server/scan-service.js';
import { getProposalWorkspaceForUser } from './helpers.js';

const TEST_DB_PATH = path.resolve('.tmp/test-proposal-baseline.db');

describe('Proposal Baseline SHA & Consistency Safety Suite', () => {
  let db: DatabaseSync;

  beforeEach(async () => {
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
      VALUES (?, ?, ?, 'u1', 'stripe-subscription-coupon-removed', 'stripe', 'Coupon removed', 'desc', 'critical', 0.95, 'src/billing.ts', 10, 'subscriptions.create', 'open', 'reason', '["CALLSITE"]', '[]', 'coupon: couponId', ?)
    `).run(params.findingId, params.scanId, params.repoId, now);
  }

  // =========================================================================
  // Requirement 10a: Migration for Repo A never uses Repo B's SHA
  // =========================================================================
  it('10a: Migration for repository A never uses repository B SHA (fails closed)', async () => {
    const user = createUser('isolation@example.com', 'Pass12345!', 'Isolation Tester');
    const ws = await getProposalWorkspaceForUser(user.id);

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
    const ws = await getProposalWorkspaceForUser(user.id);

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
    const ws = await getProposalWorkspaceForUser(user.id);

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
    const ws = await getProposalWorkspaceForUser(user.id);

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
    const ws = await getProposalWorkspaceForUser(user.id);

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

  // =========================================================================
  // Requirement 8A: HTTP 409 empty GitHub repository -> GITHUB_REPOSITORY_EMPTY
  // =========================================================================
  it('8A: HTTP 409 empty GitHub repository throws GITHUB_REPOSITORY_EMPTY', async () => {
    const config: GitHubAppConfig = {
      appId: '12345',
      installationId: '165848879',
      repositoryId: '1118854755',
      owner: 'pavanvarma-creator',
      repository: 'student-tools',
      mode: 'OBSERVE',
      enabled: true,
    };
    const tokens: InstallationTokenProvider = {
      getToken: async () => 'test-token',
    };

    // Custom fetch returning HTTP 409 Conflict with GitHub's empty repository message
    const customFetch: typeof fetch = async (url) => {
      if (String(url).includes('/git/ref/heads/main')) {
        return new Response(JSON.stringify({
          message: 'Git Repository is empty.',
          documentation_url: 'https://docs.github.com/rest/git/refs#get-a-reference',
          status: '409',
        }), { status: 409 });
      }
      return new Response('Not Found', { status: 404 });
    };

    const transport = new FetchGitHubControlledWriteTransport(config, tokens, customFetch, undefined, { workspaceAuthorized: true });

    await expect(transport.getDefaultBranchSha('main')).rejects.toThrow(
      /GITHUB_REPOSITORY_EMPTY: Remote repository 'pavanvarma-creator\/student-tools' has no commits on default branch 'main'/
    );

    // Also verify getBranchRef returns null for empty repository rather than throwing
    const branchRef = await transport.getBranchRef('apiproof/test-branch');
    expect(branchRef).toBeNull();

    // Verify GitHubAppSourceControlProvider.getDefaultBranch also throws GITHUB_REPOSITORY_EMPTY
    const readTransport: GitHubReadTransport = {
      request: async (p) => {
        if (p.includes('/git/ref/heads/')) {
          return { status: 409, body: { message: 'Git Repository is empty.' } };
        }
        return {
          status: 200,
          body: {
            id: '1118854755',
            name: 'student-tools',
            owner: { login: 'pavanvarma-creator' },
            default_branch: 'main',
          },
        };
      },
    };
    const provider = new GitHubAppSourceControlProvider(config, tokens, readTransport);
    await expect(provider.getDefaultBranch()).rejects.toThrow(/GITHUB_REPOSITORY_EMPTY/);
  });

  // =========================================================================
  // Requirement 8B: Proposal route maps GITHUB_REPOSITORY_EMPTY to HTTP 422
  // =========================================================================
  it('8B: proposal route maps GITHUB_REPOSITORY_EMPTY to HTTP 422 with sanitized actionable message', async () => {
    const user = createUser('empty_route@example.com', 'Pass12345!', 'Empty Route Tester');
    await getDatabase().execute('UPDATE users SET email_verified_at = ? WHERE id = ?', [new Date().toISOString(), user.id]);
    const ws = await getProposalWorkspaceForUser(user.id);
    const session = createSession(user.id);

    setupRepoWithScanAndFinding({
      userId: user.id,
      workspaceId: ws.id,
      repoId: 'repo_empty_route',
      owner: 'pavanvarma-creator',
      name: 'student-tools',
      githubRepoId: '1118854755',
      scanId: 'scn_empty_route',
      scanSha: '9999999999999999999999999999999999999999',
      findingId: 'fnd_empty_route',
    });

    const migration = await generateMigrationForFinding('fnd_empty_route', user.id);

    // Write transport with emptyRepository = true throws GITHUB_REPOSITORY_EMPTY
    const emptyTransport = new FakeGitHubWriteTransport('pavanvarma-creator', 'student-tools', 'main', '9999999999999999999999999999999999999999');
    emptyTransport.emptyRepository = true;

    await expect(createGitHubProposal(migration.id, user.id, emptyTransport)).rejects.toThrow(/GITHUB_REPOSITORY_EMPTY/);

    // Call proposal route handler with empty repository failure via spy
    const spy = vi.spyOn(proposalService, 'createGitHubProposal').mockRejectedValueOnce(
      new Error("GITHUB_REPOSITORY_EMPTY: Remote repository 'pavanvarma-creator/student-tools' has no commits on default branch 'main'.")
    );

    const req = new Request('http://localhost:3000/api/migrations/propose', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `apiproof_session=${session.id}`,
      },
      body: JSON.stringify({ migrationId: migration.id }),
    });

    const res = await proposeRoutePost(req);
    expect(res.status).toBe(422);
    const data = (await res.json()) as { code?: string; error?: string };
    expect(data.code).toBe('REPOSITORY_EMPTY');
    expect(data.error).toBe(
      'Target repository is empty or has no commits on the default branch. Add an initial commit and run a fresh scan before proposing a migration.'
    );
    spy.mockRestore();

    // Verify bad request validation still protects the route
    const badReq = new Request('http://localhost:3000/api/migrations/propose', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `apiproof_session=${session.id}`,
      },
      body: JSON.stringify({ migrationId: 'non_existent_id' }),
    });
    const badRes = await proposeRoutePost(badReq);
    expect(badRes.status).toBe(404);
  });

  // =========================================================================
  // Requirement 8C: Empty live GitHub repository scan MUST NOT fall back to fixture
  // =========================================================================
  it('8C: empty live GitHub repository scan fails closed and NEVER falls back to developer fixture', async () => {
    const user = createUser('empty_scan@example.com', 'Pass12345!', 'Empty Scan Tester');
    const ws = await getProposalWorkspaceForUser(user.id);
    const now = new Date().toISOString();

    const repoId = 'repo_live_empty';
    db.prepare(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'pavanvarma-creator', 'student-tools', 'pavanvarma-creator/student-tools', '1118854755', 'main', 'connected', ?)
    `).run(repoId, ws.id, user.id, now);

    // Mock live GitHub provider that throws GITHUB_REPOSITORY_EMPTY
    const config: GitHubAppConfig = {
      appId: '12345',
      installationId: '165848879',
      repositoryId: '1118854755',
      owner: 'pavanvarma-creator',
      repository: 'student-tools',
      mode: 'OBSERVE',
      enabled: true,
    };
    const tokens: InstallationTokenProvider = {
      getToken: async () => 'test-token',
    };
    const readTransport: GitHubReadTransport = {
      request: async (p) => {
        if (p.includes('/git/ref/heads/')) {
          return { status: 409, body: { message: 'Git Repository is empty.' } };
        }
        return { status: 200, body: { id: 1118854755, name: 'student-tools', owner: { login: 'pavanvarma-creator' }, default_branch: 'main' } };
      },
    };
    const mockLiveProvider = new GitHubAppSourceControlProvider(config, tokens, readTransport);

    // Scan execution must fail closed with GITHUB_REPOSITORY_EMPTY
    await expect(runRepositoryScan(repoId, user.id, mockLiveProvider)).rejects.toThrow(
      /GITHUB_REPOSITORY_EMPTY: Remote repository 'pavanvarma-creator\/student-tools' has no commits on default branch 'main'/
    );

    // Assert: scan record marked as failed
    const scan = db.prepare('SELECT status, error_message, sha FROM scans WHERE repository_id = ? ORDER BY started_at DESC LIMIT 1').get(repoId) as { status: string; error_message: string; sha: string };
    expect(scan.status).toBe('failed');
    expect(scan.error_message).toContain('GITHUB_REPOSITORY_EMPTY');

    // Assert: NEVER used b1be45...
    expect(scan.sha).not.toBe('b1be45b401f41106ecfd489bbbb1fff71639c763');

    // Assert: ZERO findings created (no src/billing.ts, no coupon findings!)
    const findings = db.prepare('SELECT * FROM findings WHERE repository_id = ?').all(repoId);
    expect(findings.length).toBe(0);
  });

  // =========================================================================
  // Requirement 8D: Live GitHub fetch failure MUST NOT fall back to fixture
  // =========================================================================
  it('8D: live GitHub fetch failure fails closed and does NOT fall back to developer fixture', async () => {
    const user = createUser('fetch_fail@example.com', 'Pass12345!', 'Fetch Fail Tester');
    const ws = await getProposalWorkspaceForUser(user.id);
    const now = new Date().toISOString();

    const repoId = 'repo_fetch_fail';
    db.prepare(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'my-org', 'my-repo', 'my-org/my-repo', '222333444', 'main', 'connected', ?)
    `).run(repoId, ws.id, user.id, now);

    const config: GitHubAppConfig = {
      appId: '12345',
      installationId: '165848879',
      repositoryId: '222333444',
      owner: 'my-org',
      repository: 'my-repo',
      mode: 'OBSERVE',
      enabled: true,
    };
    const tokens: InstallationTokenProvider = { getToken: async () => 'test-token' };
    const failingTransport: GitHubReadTransport = {
      request: async () => {
        return { status: 500, body: { message: 'Internal Server Error' } };
      },
    };
    const mockProvider = new GitHubAppSourceControlProvider(config, tokens, failingTransport);

    await expect(runRepositoryScan(repoId, user.id, mockProvider)).rejects.toThrow();

    // Verify scan failed and 0 findings created
    const scan = db.prepare('SELECT status, error_message FROM scans WHERE repository_id = ?').get(repoId) as { status: string; error_message: string };
    expect(scan.status).toBe('failed');

    const findings = db.prepare('SELECT * FROM findings WHERE repository_id = ?').all(repoId);
    expect(findings.length).toBe(0);
  });

  // =========================================================================
  // Requirement 8E & 8F: Successful real GitHub repository scan & baseline integrity
  // =========================================================================
  it('8E & 8F: Successful real GitHub repository scan produces real findings and preserves baseline integrity', async () => {
    const user = createUser('real_scan@example.com', 'Pass12345!', 'Real Scan Tester');
    const ws = await getProposalWorkspaceForUser(user.id);
    const now = new Date().toISOString();

    const repoId = 'repo_real_scan';
    const realSha = '8888888888888888888888888888888888888888';

    db.prepare(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'acme-corp', 'billing-service', 'acme-corp/billing-service', '333444555', 'main', 'connected', ?)
    `).run(repoId, ws.id, user.id, now);

    const pkgJson = JSON.stringify({ name: 'billing-service', dependencies: { stripe: '^16.0.0' } });
    const paymentsTs = `import Stripe from 'stripe';
const stripe = new Stripe('sk_test_123');
export async function createSub(cust: string, price: string, c: string) {
  return stripe.subscriptions.create({ customer: cust, items: [{ price }], coupon: c } as never);
}
`;

    const config: GitHubAppConfig = {
      appId: '12345',
      installationId: '165848879',
      repositoryId: '333444555',
      owner: 'acme-corp',
      repository: 'billing-service',
      mode: 'OBSERVE',
      enabled: true,
    };
    const tokens: InstallationTokenProvider = { getToken: async () => 'test-token' };
    const successTransport: GitHubReadTransport = {
      request: async (p) => {
        if (p.includes('/git/ref/heads/')) {
          return { status: 200, body: { object: { sha: realSha } } };
        }
        if (p.includes('/git/trees/')) {
          return {
            status: 200,
            body: {
              tree: [
                { type: 'blob', path: 'package.json' },
                { type: 'blob', path: 'src/payments.ts' },
              ],
            },
          };
        }
        if (p.includes('/contents/package.json')) {
          return { status: 200, body: { content: Buffer.from(pkgJson).toString('base64') } };
        }
        if (p.includes('/contents/src/payments.ts')) {
          return { status: 200, body: { content: Buffer.from(paymentsTs).toString('base64') } };
        }
        return { status: 200, body: { id: 333444555, name: 'billing-service', owner: { login: 'acme-corp' }, default_branch: 'main' } };
      },
    };

    const realProvider = new GitHubAppSourceControlProvider(config, tokens, successTransport);

    const result = await runRepositoryScan(repoId, user.id, realProvider);
    expect(result.status).toBe('completed');
    expect(result.sha).toBe(realSha);
    expect(result.filesAnalyzed).toBe(1);
    expect(result.findingsCount).toBe(1);

    // Finding must be on src/payments.ts (NOT the developer fixture src/billing.ts)
    const finding = db.prepare('SELECT * FROM findings WHERE repository_id = ?').get(repoId) as { id: string; file_path: string; change_id: string };
    expect(finding).toBeDefined();
    expect(finding.file_path).toBe('src/payments.ts');

    // Requirement 8F: Migration plan uses exact scan SHA
    const plan = await generateMigrationForFinding(finding.id, user.id);
    expect(plan.baselineSha).toBe(realSha);

    const migRow = db.prepare('SELECT baseline_sha FROM migrations WHERE id = ?').get(plan.id) as { baseline_sha: string };
    expect(migRow.baseline_sha).toBe(realSha);
  });

  // =========================================================================
  // Requirement 8G: Repository isolation (SHA from another repo rejected)
  // =========================================================================
  it('8G: repository isolation prevents migration proposal using a SHA from another repository', async () => {
    const user = createUser('isolation_g@example.com', 'Pass12345!', 'Isolation G Tester');
    const ws = await getProposalWorkspaceForUser(user.id);

    const shaRepo1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const shaRepo2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

    setupRepoWithScanAndFinding({
      userId: user.id,
      workspaceId: ws.id,
      repoId: 'repo_g1',
      owner: 'org-g',
      name: 'service-1',
      githubRepoId: '500001',
      scanId: 'scn_g1',
      scanSha: shaRepo1,
      findingId: 'fnd_g1',
    });

    setupRepoWithScanAndFinding({
      userId: user.id,
      workspaceId: ws.id,
      repoId: 'repo_g2',
      owner: 'org-g',
      name: 'service-2',
      githubRepoId: '500002',
      scanId: 'scn_g2',
      scanSha: shaRepo2,
      findingId: 'fnd_g2',
    });

    const mig = await generateMigrationForFinding('fnd_g1', user.id);
    expect(mig.baselineSha).toBe(shaRepo1);

    // Attempt to hijack migration to use service-2's SHA
    db.prepare('UPDATE migrations SET baseline_sha = ? WHERE id = ?').run(shaRepo2, mig.id);

    await expect(createGitHubProposal(mig.id, user.id)).rejects.toThrow(
      /BASELINE_SHA_REPOSITORY_MISMATCH/
    );
  });
});
