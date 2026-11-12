import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { initDatabase } from '../apps/web/src/lib/server/db.js';
import {
  hashPassword,
  verifyPassword,
  createUser,
  authenticateUser,
  createSession,
  validateSession,
} from '../apps/web/src/lib/server/auth.js';
import { runRepositoryScan } from '../apps/web/src/lib/server/scan-service.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { grantTestProposalEntitlement } from './helpers.js';

const TEST_DB_PATH = path.resolve('.tmp/test-apiproof.db');

describe('APIProof Web Application Backend & Engine Integration', () => {
  let db: DatabaseSync;

  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    db = initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try {
      db.close();
    } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
  });

  describe('1. Authentication & Security Unit Tests', () => {
    it('hashes passwords securely using scrypt with unique salts', () => {
      const p1 = hashPassword('supersecret123');
      const p2 = hashPassword('supersecret123');
      expect(p1).not.toBe(p2);
      expect(verifyPassword('supersecret123', p1)).toBe(true);
      expect(verifyPassword('wrongpassword', p1)).toBe(false);
    });

    it('creates, authenticates, and validates sessions', () => {
      const user = createUser('alice@example.com', 'Pass12345!', 'Alice Engineer');
      expect(user.email).toBe('alice@example.com');

      const authenticated = authenticateUser('alice@example.com', 'Pass12345!');
      expect(authenticated).not.toBeNull();
      expect(authenticated?.id).toBe(user.id);

      const failed = authenticateUser('alice@example.com', 'WrongPass!');
      expect(failed).toBeNull();

      const session = createSession(user.id);
      const validated = validateSession(session.id);
      expect(validated).not.toBeNull();
      expect(validated?.user.id).toBe(user.id);
    });
  });

  describe('2. Multi-tenant Authorization & IDOR Protection', () => {
    it('prevents User A from scanning or accessing User B repositories', async () => {
      const userA = createUser('user_a@example.com', 'passA123!', 'User A');
      const userB = createUser('user_b@example.com', 'passB123!', 'User B');

      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES ('repo_a', ?, 'org-a', 'repo-a', 'org-a/repo-a', '101', 'main', 'connected', ?)
      `).run(userA.id, new Date().toISOString());

      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES ('repo_b', ?, 'org-b', 'repo-b', 'org-b/repo-b', '102', 'main', 'connected', ?)
      `).run(userB.id, new Date().toISOString());

      // User A attempts to scan User B's repository -> must be rejected
      await expect(runRepositoryScan('repo_b', userA.id)).rejects.toThrow(
        /Repository not found or access denied/
      );

      // User B attempts to scan User A's repository -> must be rejected
      await expect(runRepositoryScan('repo_a', userB.id)).rejects.toThrow(
        /Repository not found or access denied/
      );
    });
  });

  describe('3. Real Scan Pipeline & AST Finding Persistence', () => {
    it('executes real AST analysis and persists findings for apiproof-github-fixture', async () => {
      const user = createUser('scanner@example.com', 'pass1234!', 'Scan Tester');
      const repoId = 'repo_fixture_test';

      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', ?)
      `).run(repoId, user.id, new Date().toISOString());

      const result = await runRepositoryScan(repoId, user.id);

      expect(result.status).toBe('completed');
      expect(result.filesAnalyzed).toBeGreaterThanOrEqual(1);
      expect(result.findingsCount).toBeGreaterThan(0);

      interface TestFindingRow {
        change_id: string;
        symbol: string;
        file_path: string;
        line_number: number;
        severity: string;
        source_snippet: string | null;
      }

      // Verify findings persisted in the real database
      const rows = db.prepare('SELECT * FROM findings WHERE repository_id = ?').all(repoId) as unknown as TestFindingRow[];
      expect(rows.length).toBe(result.findingsCount);

      const couponFinding = rows.find((f) => f.change_id === 'stripe-subscription-coupon-removed');
      expect(couponFinding).toBeDefined();
      expect(couponFinding?.symbol).toBe('subscriptions.create');
      expect(couponFinding?.file_path).toBe('src/billing.ts');
      expect(couponFinding?.line_number).toBe(4);
      expect(couponFinding?.severity).toBe('high');
      expect(couponFinding?.source_snippet).toContain('coupon');

      // Verify repository updated to affected
      const repo = db.prepare('SELECT status, last_scan_at FROM repositories WHERE id = ?').get(repoId) as { status: string; last_scan_at: string | null } | undefined;
      expect(repo?.status).toBe('affected');
      expect(repo?.last_scan_at).not.toBeNull();
    });
  });

  describe('4. Deterministic Migration Planning Service', () => {
    it('generates and persists deterministic migration plan from an existing finding', async () => {
      const user = createUser('planner@example.com', 'pass1234!', 'Plan Tester');
      await grantTestProposalEntitlement((await getDefaultWorkspaceForUser(user.id)).id);
      const repoId = 'repo_plan_test';

      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', ?)
      `).run(repoId, user.id, new Date().toISOString());

      const scanResult = await runRepositoryScan(repoId, user.id);
      const finding = scanResult.findings.find((f) => f.changeId === 'stripe-subscription-coupon-removed')!;

      const migration = await generateMigrationForFinding(finding.id, user.id);

      expect(migration.id).toMatch(/^mig_/);
      expect(migration.findingId).toBe(finding.id);
      expect(migration.status).toBe('planned');
      expect(migration.patchDiff).toBeNull();

      // Verify persisted in migrations table
      const stored = db.prepare('SELECT * FROM migrations WHERE id = ?').get(migration.id) as { plan_json: string } | undefined;
      expect(stored).toBeDefined();
      expect(stored?.plan_json).toContain('stripe-subscription-coupon-removed');

      // Verify finding updated to migration_planned
      const updatedFinding = db.prepare('SELECT status FROM findings WHERE id = ?').get(finding.id) as { status: string } | undefined;
      expect(updatedFinding?.status).toBe('migration_planned');

      const activity = db.prepare(
        "SELECT type FROM activity_events WHERE title = 'Migration Plan Generated' AND repository_id = ? ORDER BY created_at DESC LIMIT 1",
      ).get(repoId) as { type: string } | undefined;
      expect(activity?.type).toBe('migration_planned');
    });
  });

  describe('5. Safe GitHub Proposal Creation Service', () => {
    it('creates draft PR proposal through safety boundary and records PR in database', async () => {
      const user = createUser('proposer@example.com', 'pass1234!', 'Propose Tester');
      await grantTestProposalEntitlement((await getDefaultWorkspaceForUser(user.id)).id);
      const repoId = 'repo_prop_test';

      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', ?)
      `).run(repoId, user.id, new Date().toISOString());

      const scanResult = await runRepositoryScan(repoId, user.id);
      const finding = scanResult.findings.find((f) => f.changeId === 'stripe-subscription-coupon-removed')!;
      const migration = await generateMigrationForFinding(finding.id, user.id);

      const proposal = await createGitHubProposal(migration.id, user.id);

      expect(proposal.pullRequestId).toMatch(/^pr_/);
      expect(proposal.state).toBe('draft');
      expect(proposal.humanReviewRequired).toBe(true);
      expect(proposal.autoMergeEnabled).toBe(false);
      expect(proposal.branchName).toMatch(/^apiproof\/stripe-subscription-coupon-removed\//);
      expect(proposal.baseBranch).toBe('main');

      // Verify persisted in pull_requests table
      const storedPR = db.prepare('SELECT * FROM pull_requests WHERE id = ?').get(proposal.pullRequestId) as { number: number } | undefined;
      expect(storedPR).toBeDefined();
      expect(storedPR?.number).toBe(proposal.number);

      // Verify statuses updated
      const updatedMigration = db.prepare('SELECT status FROM migrations WHERE id = ?').get(migration.id) as { status: string } | undefined;
      expect(updatedMigration?.status).toBe('pr_created');

      const updatedFinding = db.prepare('SELECT status FROM findings WHERE id = ?').get(finding.id) as { status: string } | undefined;
      expect(updatedFinding?.status).toBe('pr_created');

      const verifiedMigration = db.prepare('SELECT patch_content, patch_diff, patch_digest, verification_report FROM migrations WHERE id = ?').get(migration.id) as { patch_content: string; patch_diff: string; patch_digest: string; verification_report: string };
      const resultingFiles = JSON.parse(verifiedMigration.patch_content) as Record<string, string>;
      expect(resultingFiles['src/billing.ts']).toContain('discounts: [{ coupon: couponId }]');
      expect(resultingFiles['src/billing.ts']).toContain('import Stripe');
      expect(resultingFiles['src/billing.ts']).not.toContain('--- a/');
      expect(verifiedMigration.patch_diff).toContain('--- a/src/billing.ts');
      const evidence = JSON.parse(verifiedMigration.verification_report) as { baselineSha: string; patchDigest: string; report: { status: string }; evidence: { patchApplied: boolean; typecheckPassed: boolean; testsPassed: boolean; contractPassed: boolean; targetFiles: string[] } };
      expect(evidence.baselineSha).toBe((db.prepare('SELECT sha FROM scans WHERE id = (SELECT scan_id FROM findings WHERE id = ?)').get(finding.id) as { sha: string }).sha);
      expect(evidence.patchDigest).toBe(verifiedMigration.patch_digest);
      expect(evidence.report.status).toBe('VERIFICATION_PASSED');
      expect(evidence.evidence).toMatchObject({ patchApplied: true, typecheckPassed: true, testsPassed: true, contractPassed: true });
      expect(evidence.evidence.targetFiles).toEqual(['src/billing.ts']);
    });
  });
});
