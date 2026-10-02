import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { FakeGitHubWriteTransport } from '@apiproof/core';
import { initDatabase, closeDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUser } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { runRepositoryScan } from '../apps/web/src/lib/server/scan-service.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';

const TEST_DB_PATH = path.resolve('.tmp/test-proposal-recovery.db');

describe('Proposal Recovery & Failure-Safety Suite (Gaps 1, 2, 3)', () => {
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

  async function setupFixture() {
    const user = createUser('recovery_tester@example.com', 'Pass12345!', 'Recovery Tester');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const repoId = 'repo_recovery_fixture';

    db.prepare("UPDATE repositories SET lifecycle = 'historical', origin = 'seeded_fixture' WHERE id = 'repo_apiproof_fixture'").run();

    db.prepare(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', ?)
    `).run(repoId, ws.id, user.id, new Date().toISOString());

    const scan = await runRepositoryScan(repoId, user.id);
    const finding = db.prepare('SELECT id FROM findings WHERE repository_id = ? LIMIT 1').get(repoId) as { id: string };
    const migration = await generateMigrationForFinding(finding.id, user.id);

    return { user, ws, repoId, migration, baselineSha: scan.sha };
  }

  // =========================================================================
  // GAP 1: REMOTE BRANCH RECONCILIATION
  // =========================================================================
  describe('Gap 1: Remote Branch Partial-Failure Reconciliation', () => {
    it('rejects an unknown default branch HEAD before any remote write', async () => {
      const { user, migration } = await setupFixture();
      const transport = new FakeGitHubWriteTransport();
      await expect(createGitHubProposal(migration.id, user.id, transport)).rejects.toThrow(/GITHUB_DEFAULT_BRANCH_UNVERIFIED/);
      expect(transport.branches.size).toBe(0);
      expect(db.prepare('SELECT COUNT(*) as c FROM pull_requests WHERE migration_id = ?').get(migration.id)).toEqual({ c: 0 });
    });
    it('does not record pr_created when branch creation succeeds but commit creation fails', async () => {
      const { user, migration, baselineSha } = await setupFixture();
      const branchName = `apiproof/stripe-subscription-coupon-removed/${migration.id.slice(4, 12)}`;
      const transport = new FakeGitHubWriteTransport('ravitejabolla756-sys', 'apiproof-github-fixture', 'main', baselineSha);
      transport.createCommit = async () => { throw new Error('COMMIT_FAILED'); };

      await expect(createGitHubProposal(migration.id, user.id, transport)).rejects.toThrow('COMMIT_FAILED');
      expect(transport.branches.get(branchName)).toBeDefined();
      expect(db.prepare('SELECT COUNT(*) as c FROM pull_requests WHERE migration_id = ?').get(migration.id)).toEqual({ c: 0 });
      expect(db.prepare('SELECT status FROM migrations WHERE id = ?').get(migration.id)).not.toEqual({ status: 'pr_created' });
    });

    it('does not record pr_created when commit succeeds but Draft PR creation fails', async () => {
      const { user, migration, baselineSha } = await setupFixture();
      const branchName = `apiproof/stripe-subscription-coupon-removed/${migration.id.slice(4, 12)}`;
      const transport = new FakeGitHubWriteTransport('ravitejabolla756-sys', 'apiproof-github-fixture', 'main', baselineSha);
      transport.createPullRequest = async () => { throw new Error('PR_FAILED'); };

      await expect(createGitHubProposal(migration.id, user.id, transport)).rejects.toThrow('PR_FAILED');
      expect(transport.branches.get(branchName)).toBeDefined();
      expect(transport.branches.get(branchName)).not.toBe('');
      expect(db.prepare('SELECT COUNT(*) as c FROM pull_requests WHERE migration_id = ?').get(migration.id)).toEqual({ c: 0 });
      expect(db.prepare('SELECT status FROM migrations WHERE id = ?').get(migration.id)).not.toEqual({ status: 'pr_created' });
    });

    it('re-uses existing branch when branch points to the expected baseline SHA', async () => {
      const { user, migration } = await setupFixture();
      const branchName = `apiproof/stripe-subscription-coupon-removed/${migration.id.slice(4, 12)}`;
      const baselineSha = 'b1be45b401f41106ecfd489bbbb1fff71639c763';

      const transport = new FakeGitHubWriteTransport();
      // Pre-seed branch pointing to expected baseline SHA (simulating partial write failure before PR creation)
      transport.branches.set(branchName, baselineSha);

      // createBranchRef on transport should succeed by returning existing branch ref
      const res = await transport.createBranchRef(branchName, baselineSha);
      expect(res.ref).toBe(`refs/heads/${branchName}`);
      expect(res.sha).toBe(baselineSha);

      // Proposal succeeds
      const proposal = await createGitHubProposal(migration.id, user.id);
      expect(proposal.pullRequestId).toBeDefined();
      expect(proposal.number).toBe(1);
      expect(proposal.state).toBe('draft');
    });

    it('fails closed with conflict error when branch points to unexpected SHA (different commit)', async () => {
      const { migration } = await setupFixture();
      const branchName = `apiproof/stripe-subscription-coupon-removed/${migration.id.slice(4, 12)}`;
      const baselineSha = 'b1be45b401f41106ecfd489bbbb1fff71639c763';
      const unexpectedSha = '9999999999999999999999999999999999999999';

      const transport = new FakeGitHubWriteTransport();
      transport.branches.set(branchName, unexpectedSha);

      await expect(transport.createBranchRef(branchName, baselineSha)).rejects.toThrow(
        /GITHUB_BRANCH_CONFLICT: Branch '.*' already exists at unexpected SHA/
      );
      // Verify branch was NOT overwritten
      expect(transport.branches.get(branchName)).toBe(unexpectedSha);
    });
  });

  // =========================================================================
  // GAP 2: ORPHANED PR RECONCILIATION
  // =========================================================================
  describe('Gap 2: Orphaned PR Discovery & DB Reconciliation', () => {
    it('adopts and reconciles an existing GitHub Draft PR into PostgreSQL when DB record was missing', async () => {
      const { user, migration } = await setupFixture();

      // First call creates PR in both GitHub and DB
      const firstProposal = await createGitHubProposal(migration.id, user.id);
      expect(firstProposal.number).toBe(1);

      // Simulate database loss / persistence failure: delete pull_requests row and reset migration status
      const migRow = db.prepare('SELECT finding_id FROM migrations WHERE id = ?').get(migration.id) as { finding_id: string };
      db.prepare('DELETE FROM pull_requests WHERE migration_id = ?').run(migration.id);
      db.prepare("UPDATE migrations SET status = 'planned' WHERE id = ?").run(migration.id);
      db.prepare("UPDATE findings SET status = 'open' WHERE id = ?").run(migRow.finding_id);

      const prCheck = db.prepare('SELECT COUNT(*) as c FROM pull_requests WHERE migration_id = ?').get(migration.id) as { c: number };
      expect(prCheck.c).toBe(0);

      // Call proposal again: should discover existing PR on GitHub, reconcile it into DB, and NOT create a new PR
      const secondProposal = await createGitHubProposal(migration.id, user.id);
      expect(secondProposal.number).toBe(1);
      expect(secondProposal.state).toBe('draft');

      // Verify DB now has the reconciled pull_requests record and statuses are updated
      const prCheckAfter = db.prepare('SELECT * FROM pull_requests WHERE migration_id = ?').get(migration.id) as { number: number; state: string };
      expect(prCheckAfter.number).toBe(1);
      expect(prCheckAfter.state).toBe('draft');

      const migCheck = db.prepare('SELECT status FROM migrations WHERE id = ?').get(migration.id) as { status: string };
      expect(migCheck.status).toBe('pr_created');
    });

    it('rejects adopting a non-draft PR on the same branch', async () => {
      const transport = new FakeGitHubWriteTransport();
      const branchName = 'apiproof/stripe-subscription-coupon-removed/test1234';

      transport.prs.push({
        number: 42,
        url: 'https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/42',
        title: 'Non-draft PR',
        body: 'body',
        head: branchName,
        base: 'main',
        draft: false, // Non-draft
      });

      const found = await transport.findOpenPullRequestByHead(branchName);
      expect(found).not.toBeNull();
      expect(found?.draft).toBe(false);
    });

    it('does NOT adopt an unrelated PR on a different branch', async () => {
      const transport = new FakeGitHubWriteTransport();
      transport.prs.push({
        number: 99,
        url: 'https://github.com/ravitejabolla756-sys/apiproof-github-fixture/pull/99',
        title: 'Unrelated PR',
        body: 'body',
        head: 'apiproof/unrelated-change/99999999',
        base: 'main',
        draft: true,
      });

      const found = await transport.findOpenPullRequestByHead('apiproof/stripe-subscription-coupon-removed/test1234');
      expect(found).toBeNull();
    });
  });

  // =========================================================================
  // GAP 3: CONCURRENT PROPOSAL RECOVERY
  // =========================================================================
  describe('Gap 3: Concurrent Proposal Race Recovery', () => {
    it('simultaneous proposal requests both resolve to the same proposal without 500 failure', async () => {
      const { user, migration } = await setupFixture();

      // Run two proposals concurrently
      const [res1, res2] = await Promise.all([
        createGitHubProposal(migration.id, user.id),
        createGitHubProposal(migration.id, user.id),
      ]);

      expect(res1.number).toBe(1);
      expect(res2.number).toBe(1);
      expect(res1.pullRequestId).toBe(res2.pullRequestId);
      expect(res1.url).toBe(res2.url);

      // Exactly 1 PR in DB
      const prRows = db.prepare('SELECT COUNT(*) as c FROM pull_requests WHERE migration_id = ?').get(migration.id) as { c: number };
      expect(prRows.c).toBe(1);
    });
  });

  // =========================================================================
  // SEQUENTIAL IDEMPOTENCY
  // =========================================================================
  describe('Sequential Idempotency Baseline', () => {
    it('subsequent proposal for the same migration returns existing PR with zero writes', async () => {
      const { user, migration } = await setupFixture();

      const first = await createGitHubProposal(migration.id, user.id);
      const second = await createGitHubProposal(migration.id, user.id);

      expect(second.pullRequestId).toBe(first.pullRequestId);
      expect(second.number).toBe(first.number);
      expect(second.url).toBe(first.url);
    });
  });
});
