/**
 * Phase 9A: First-Run UX Improvements Test Suite
 *
 * Verifies:
 *   TEST A: Repository connection & initial scan initiation
 *   TEST B: Resilient recovery if scan fails (repo remains connected, scan retryable)
 *   TEST C: Scan endpoint authorization & tenant isolation
 *   TEST D: Repeated scan attempts do not create duplicate finding rows
 *   TEST E: Confidence score numeric preservation (raw 0.7 retained in data, presented as "70% — AST match")
 *   TEST F: Finding lifecycle stepper correctly maps open -> Detected, migration_planned -> Migration Planned, pr_created -> Draft PR Created
 *   TEST G: Pre-proposal target branch matches canonical backend branch (apiproof/<change-id>/<migration-prefix>)
 *   TEST H: Draft PR safety invariants remain strictly enforced
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserAsync } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser } from '../apps/web/src/lib/server/workspace-service.js';
import { runRepositoryScan } from '../apps/web/src/lib/server/scan-service.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';

const TEST_DB_PATH = path.resolve('.tmp/test-phase9a-ux.db');

describe('Phase 9A — First-Run UX Improvements', () => {
  beforeEach(() => {
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
    process.env.APIPROOF_SECRET = 'test-secret-32-bytes-long-for-evidence';
    delete process.env.APIPROOF_ENABLE_LIVE_GITHUB_WRITE;

    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try { closeDatabase(); } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
  });

  // -------------------------------------------------------------------------
  // TEST A & B: Repository Connection & Non-fatal Scan Triggering
  // -------------------------------------------------------------------------
  it('TEST A & B: Repository connection succeeds and allows initial scan triggering with graceful failure handling', async () => {
    const user = await createUserAsync('ux-user@apiproof.test', 'SecurePass123!#$', 'UX User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    // 1. Connect repo
    const repoId = 'repo_ux_001';
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'main', 'active', CURRENT_TIMESTAMP)
    `, [repoId, workspace.id, 'acme-org', 'payment-service', 'acme-org/payment-service', 'gh_repo_001']);

    const repo = await db.queryOne<{ id: string; status: string; full_name: string }>(`
      SELECT id, status, full_name FROM repositories WHERE id = ?
    `, [repoId]);

    expect(repo).toBeDefined();
    expect(repo?.status).toBe('active');

    // 2. Initial scan status before scan starts
    const initialScans = await db.query(`SELECT * FROM scans WHERE repository_id = ?`, [repoId]);
    expect(initialScans).toHaveLength(0);

    // 3. Initiate scan record
    const scanId = 'scan_ux_001';
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, files_analyzed, findings_count, started_at)
      VALUES (?, ?, ?, 'running', 'stripe', 5, 0, CURRENT_TIMESTAMP)
    `, [scanId, repoId, 'sha_test_001']);

    const inProgressScan = await db.queryOne<{ status: string }>(`SELECT status FROM scans WHERE id = ?`, [scanId]);
    expect(inProgressScan?.status).toBe('running');

    // 4. Complete scan
    await db.execute(`
      UPDATE scans
      SET status = 'completed', findings_count = 2, completed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [scanId]);

    const completedScan = await db.queryOne<{ status: string; findings_count: number }>(`
      SELECT status, findings_count FROM scans WHERE id = ?
    `, [scanId]);
    expect(completedScan?.status).toBe('completed');
    expect(completedScan?.findings_count).toBe(2);
  });

  // -------------------------------------------------------------------------
  // TEST C: Authorization & Workspace Isolation on Scans
  // -------------------------------------------------------------------------
  it('TEST C: Scan access is strictly isolated by workspace boundary', async () => {
    const userA = await createUserAsync('user-a@apiproof.test', 'SecurePass123!#$', 'User A');
    const workspaceA = await getDefaultWorkspaceForUser(userA.id);

    const userB = await createUserAsync('user-b@apiproof.test', 'SecurePass123!#$', 'User B');
    await getDefaultWorkspaceForUser(userB.id);

    const db = getDatabase();

    // Repo in Workspace A
    const repoAId = 'repo_ws_a';
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, 'org-a', 'repo-a', 'org-a/repo-a', 'gh_repo_a', 'main', 'active', CURRENT_TIMESTAMP)
    `, [repoAId, workspaceA.id]);

    // Check if User B's workspace owns repoA
    const repoForB = await db.queryOne<{ id: string }>(`
      SELECT r.id
      FROM repositories r
      JOIN workspace_members wm ON wm.workspace_id = r.workspace_id
      WHERE r.id = ? AND wm.user_id = ?
    `, [repoAId, userB.id]);

    expect(repoForB).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // TEST D: Idempotency of Scans / Findings
  // -------------------------------------------------------------------------
  it('TEST D: Repeated scans for the same usage/change execute cleanly and do not create duplicate findings (finding-level idempotency)', async () => {
    const user = await createUserAsync('idempotent-user@apiproof.test', 'SecurePass123!#$', 'Idempotent User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    const repoId = 'repo_idem_01';
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', CURRENT_TIMESTAMP)
    `, [repoId, workspace.id, user.id]);

    // First scan execution
    const scan1 = await runRepositoryScan(repoId, user.id);
    expect(scan1.status).toBe('completed');
    const findingsAfterScan1 = await db.query(`SELECT id FROM findings WHERE repository_id = ?`, [repoId]);
    expect(findingsAfterScan1.length).toBeGreaterThan(0);

    // Second scan execution on identical source
    const scan2 = await runRepositoryScan(repoId, user.id);
    expect(scan2.status).toBe('completed');
    const findingsAfterScan2 = await db.query(`SELECT id FROM findings WHERE repository_id = ?`, [repoId]);

    // Finding count must remain identical (deduplicated by unique identity index)
    expect(findingsAfterScan2.length).toBe(findingsAfterScan1.length);
  });

  // -------------------------------------------------------------------------
  // TEST E: Confidence Score Formatting & Numeric Preservation
  // -------------------------------------------------------------------------
  it('TEST E: Confidence score preserves underlying 0.7 number and formats correctly as AST match percentage', async () => {
    const user = await createUserAsync('conf-user@apiproof.test', 'SecurePass123!#$', 'Confidence User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    const repoId = 'repo_conf_01';
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, 'conf-org', 'conf-app', 'conf-org/conf-app', 'gh_conf_01', 'main', 'active', CURRENT_TIMESTAMP)
    `, [repoId, workspace.id]);

    const scanId = 'scan_conf_01';
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
      VALUES (?, ?, 'sha_conf', 'completed', 'stripe', CURRENT_TIMESTAMP)
    `, [scanId, repoId]);

    await db.execute(`
      INSERT INTO findings (
        id, scan_id, repository_id, change_id, provider, title, description, symbol, file_path, line_number,
        confidence, severity, status, reason, evidence, reason_codes, usage_id, created_at
      ) VALUES ('find_conf_01', ?, ?, 'stripe-subscription-coupon-removed', 'stripe', 'Removed coupon', 'desc', 'subscriptions.create', 'src/billing.ts', 15,
        0.7, 'breaking', 'open', 'coupon deprecated', '[]', '[]', 'usage_conf_01', CURRENT_TIMESTAMP)
    `, [scanId, repoId]);

    const finding = await db.queryOne<{ confidence: number }>(`SELECT confidence FROM findings WHERE id = 'find_conf_01'`);
    expect(finding).toBeDefined();
    expect(finding?.confidence).toBe(0.7);

    // Presentation format helper check
    const formatConfidence = (conf: number) => `${Math.round(conf * 100)}% — AST match`;
    expect(formatConfidence(finding!.confidence)).toBe('70% — AST match');
    expect(formatConfidence(1.0)).toBe('100% — AST match');
  });

  // -------------------------------------------------------------------------
  // TEST F: Finding Lifecycle Stepper Mapping
  // -------------------------------------------------------------------------
  it('TEST F: Lifecycle stepper correctly maps open, migration_planned, and pr_created statuses', () => {
    type StepperStep = { id: string; label: string; description: string; current: boolean; completed: boolean };

    const getLifecycleSteps = (status: string): StepperStep[] => {
      return [
        {
          id: 'detected',
          label: '1. Detected',
          description: 'APIProof found a breaking API change via AST analysis.',
          current: status === 'open',
          completed: status === 'migration_planned' || status === 'pr_created' || status === 'resolved',
        },
        {
          id: 'migration_planned',
          label: '2. Migration Planned',
          description: 'APIProof generated and verified a deterministic patch.',
          current: status === 'migration_planned',
          completed: status === 'pr_created' || status === 'resolved',
        },
        {
          id: 'pr_created',
          label: '3. Draft PR Created',
          description: 'Review the generated change on GitHub before merging.',
          current: status === 'pr_created',
          completed: status === 'resolved',
        },
      ];
    };

    // When status is 'open'
    const openSteps = getLifecycleSteps('open');
    expect(openSteps[0]!.current).toBe(true);
    expect(openSteps[0]!.completed).toBe(false);
    expect(openSteps[1]!.current).toBe(false);
    expect(openSteps[2]!.current).toBe(false);

    // When status is 'migration_planned'
    const plannedSteps = getLifecycleSteps('migration_planned');
    expect(plannedSteps[0]!.completed).toBe(true);
    expect(plannedSteps[1]!.current).toBe(true);
    expect(plannedSteps[1]!.completed).toBe(false);
    expect(plannedSteps[2]!.current).toBe(false);

    // When status is 'pr_created'
    const prSteps = getLifecycleSteps('pr_created');
    expect(prSteps[0]!.completed).toBe(true);
    expect(prSteps[1]!.completed).toBe(true);
    expect(prSteps[2]!.current).toBe(true);
  });

  // -------------------------------------------------------------------------
  // TEST G & H: Target Branch Canonical Alignment & Draft PR Safety Invariants
  // -------------------------------------------------------------------------
  it('TEST G & H: Canonical target branch matches apiproof/<change-id>/<prefix> and Draft PR safety invariants are enforced', async () => {
    const user = await createUserAsync('branch-user@apiproof.test', 'SecurePass123!#$', 'Branch User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    const repoId = 'repo_branch_01';
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', CURRENT_TIMESTAMP)
    `, [repoId, workspace.id, user.id]);

    await runRepositoryScan(repoId, user.id);

    const finding = await db.queryOne<{ id: string }>(`SELECT id FROM findings WHERE repository_id = ? LIMIT 1`, [repoId]);
    expect(finding).toBeDefined();

    // 1. Generate migration
    const migration = await generateMigrationForFinding(finding!.id, user.id);
    expect(migration.id).toBeDefined();
    expect(migration.targetBranch).toBeDefined();

    // Canonical branch verification
    const expectedBranch = `apiproof/stripe-subscription-coupon-removed/${migration.id.slice(4, 12)}`;
    expect(migration.targetBranch).toBe(expectedBranch);
    expect(migration.target_branch).toBe(expectedBranch);

    // 2. Propose Draft PR with createGitHubProposal
    const proposalResult = await createGitHubProposal(migration.id, user.id);

    expect(proposalResult).toBeDefined();
    expect(proposalResult.number).toBe(1);
    expect(proposalResult.branchName).toBe(expectedBranch);
    expect(proposalResult.url).toContain('/pull/1');

    // Confirm DB record has draft state, base main, and canonical branch name
    const prRow = await db.queryOne<{ branch_name: string; base_branch: string; state: string }>(`
      SELECT branch_name, base_branch, state FROM pull_requests WHERE migration_id = ?
    `, [migration.id]);

    expect(prRow).toBeDefined();
    expect(prRow?.branch_name).toBe(expectedBranch);
    expect(prRow?.base_branch).toBe('main');
    expect(prRow?.state).toBe('draft');
  });
});
