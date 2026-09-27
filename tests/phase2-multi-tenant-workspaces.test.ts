import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { initDatabase, getDatabase, closeDatabase } from '../apps/web/src/lib/server/db/index.js';
import {
  createUser,
  createUserWithSession,
} from '../apps/web/src/lib/server/auth.js';
import {
  getUserWorkspaces,
  getDefaultWorkspaceForUser,
  requireWorkspaceMember,
  requireRepositoryAccess,
  requireFindingAccess,
  requireMigrationAccess,
  requirePullRequestAccess,
  getWorkspaceGitHubInstallation,
} from '../apps/web/src/lib/server/workspace-service.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';
import { runMigrations } from '../apps/web/src/lib/server/db/migrator.js';

const TEST_DB_PATH = path.resolve('.tmp/test-phase2-workspaces.db');

describe('Phase 2 — Multi-Tenant SaaS Workspace Foundation', () => {
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
      closeDatabase();
    } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
  });

  // =========================================================================
  // MULTI-TENANT AUTHORIZATION TESTS (TESTS A - Q)
  // =========================================================================
  describe('Workspace Multi-Tenancy Core Invariants (Tests A - Q)', () => {
    it('TEST A: User A can access Workspace A', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const wsA = await getDefaultWorkspaceForUser(userA.id);

      const resolved = await requireWorkspaceMember(userA.id, wsA.id);
      expect(resolved.id).toBe(wsA.id);
      expect(resolved.role).toBe('owner');
    });

    it('TEST B: User B cannot access Workspace A', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsA = await getDefaultWorkspaceForUser(userA.id);

      await expect(requireWorkspaceMember(userB.id, wsA.id)).rejects.toThrow(
        /Workspace not found or access denied/
      );
    });

    it('TEST C: User A can access repositories belonging to Workspace A', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const wsA = await getDefaultWorkspaceForUser(userA.id);

      const repoId = `repo_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-a', 'repo-alpha', 'org-a/repo-alpha', '1001', 'main', 'connected', ?)
      `).run(repoId, wsA.id, userA.id, now);

      const { repository, workspace } = await requireRepositoryAccess(repoId, userA.id);
      expect(repository.id).toBe(repoId);
      expect(workspace.id).toBe(wsA.id);
    });

    it('TEST D: User A cannot access a repository belonging to Workspace B', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsB = await getDefaultWorkspaceForUser(userB.id);

      const repoIdB = `repo_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-b', 'repo-beta', 'org-b/repo-beta', '1002', 'main', 'connected', ?)
      `).run(repoIdB, wsB.id, userB.id, now);

      // User A attempts to access Repo B
      await expect(requireRepositoryAccess(repoIdB, userA.id)).rejects.toThrow(
        /Repository not found or access denied/
      );
    });

    it('TEST E: User A cannot access findings belonging to Workspace B', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsB = await getDefaultWorkspaceForUser(userB.id);

      const repoIdB = `repo_${crypto.randomBytes(8).toString('hex')}`;
      const findingIdB = `fnd_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-b', 'repo-beta', 'org-b/repo-beta', '1002', 'main', 'connected', ?)
      `).run(repoIdB, wsB.id, userB.id, now);

      db.prepare(`
        INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
        VALUES ('scn_b', ?, 'head_sha', 'completed', 'stripe', ?)
      `).run(repoIdB, now);

      db.prepare(`
        INSERT INTO findings (
          id, scan_id, repository_id, usage_id, change_id, provider, title, description,
          severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at
        ) VALUES (
          ?, 'scn_b', ?, 'usg_b', 'stripe-subscription-coupon-removed', 'stripe', 'Coupon removed', 'Coupon desc',
          'high', 0.95, 'src/billing.ts', 10, 'subscriptions.create', 'open', 'deprecated', '[]', '[]', ?
        )
      `).run(findingIdB, repoIdB, now);

      // User B can access finding B
      const accessB = await requireFindingAccess(findingIdB, userB.id);
      expect(accessB.finding.id).toBe(findingIdB);

      // User A MUST NOT be able to access finding B (safe IDOR protection)
      await expect(requireFindingAccess(findingIdB, userA.id)).rejects.toThrow(
        /Repository not found or access denied/
      );
    });

    it('TEST F: User A cannot create a migration for Workspace B', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsB = await getDefaultWorkspaceForUser(userB.id);

      const repoIdB = `repo_${crypto.randomBytes(8).toString('hex')}`;
      const findingIdB = `fnd_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-b', 'repo-beta', 'org-b/repo-beta', '1002', 'main', 'connected', ?)
      `).run(repoIdB, wsB.id, userB.id, now);

      db.prepare(`
        INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
        VALUES ('scn_b', ?, 'head_sha', 'completed', 'stripe', ?)
      `).run(repoIdB, now);

      db.prepare(`
        INSERT INTO findings (
          id, scan_id, repository_id, usage_id, change_id, provider, title, description,
          severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at
        ) VALUES (
          ?, 'scn_b', ?, 'usg_b', 'stripe-subscription-coupon-removed', 'stripe', 'Coupon removed', 'Coupon desc',
          'high', 0.95, 'src/billing.ts', 10, 'subscriptions.create', 'open', 'deprecated', '["REASON"]', '[{"detail":"evidence"}]', ?
        )
      `).run(findingIdB, repoIdB, now);

      // User A attempts to generate a migration for finding in Workspace B
      await expect(generateMigrationForFinding(findingIdB, userA.id)).rejects.toThrow(
        /Repository not found or access denied/
      );
    });

    it('TEST G: User A cannot propose a PR for Workspace B', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsB = await getDefaultWorkspaceForUser(userB.id);

      const repoIdB = `repo_${crypto.randomBytes(8).toString('hex')}`;
      const findingIdB = `fnd_${crypto.randomBytes(8).toString('hex')}`;
      const migrationIdB = `mig_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-b', 'repo-beta', 'org-b/repo-beta', '1002', 'main', 'connected', ?)
      `).run(repoIdB, wsB.id, userB.id, now);

      db.prepare(`
        INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
        VALUES ('scn_b', ?, 'head_sha', 'completed', 'stripe', ?)
      `).run(repoIdB, now);

      db.prepare(`
        INSERT INTO findings (
          id, scan_id, repository_id, usage_id, change_id, provider, title, description,
          severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at
        ) VALUES (
          ?, 'scn_b', ?, 'usg_b', 'stripe-subscription-coupon-removed', 'stripe', 'Coupon removed', 'Coupon desc',
          'high', 0.95, 'src/billing.ts', 10, 'subscriptions.create', 'open', 'deprecated', '["REASON"]', '[{"detail":"evidence"}]', ?
        )
      `).run(findingIdB, repoIdB, now);

      db.prepare(`
        INSERT INTO migrations (
          id, finding_id, repository_id, plan_id, status, plan_json, patch_diff, patch_digest, created_at
        ) VALUES (
          ?, ?, ?, 'plan_123', 'planned', '{}', 'diff', 'patch_digest_val', ?
        )
      `).run(migrationIdB, findingIdB, repoIdB, now);

      // User A attempts to propose PR for migration belonging to Workspace B
      await expect(createGitHubProposal(migrationIdB, userA.id)).rejects.toThrow(
        /Repository not found or access denied/
      );
    });

    it('TEST H: User A cannot access Workspace B activity', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsA = await getDefaultWorkspaceForUser(userA.id);
      const wsB = await getDefaultWorkspaceForUser(userB.id);

      const repoA = `repo_a_${crypto.randomBytes(4).toString('hex')}`;
      const repoB = `repo_b_${crypto.randomBytes(4).toString('hex')}`;
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-a', 'repo-a', 'org-a/repo-a', '101', 'main', 'connected', ?)
      `).run(repoA, wsA.id, userA.id, now);

      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-b', 'repo-b', 'org-b/repo-b', '102', 'main', 'connected', ?)
      `).run(repoB, wsB.id, userB.id, now);

      db.prepare(`
        INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES ('act_a', ?, ?, 'scan_started', 'User A Event', 'Activity A', ?)
      `).run(userA.id, repoA, now);

      db.prepare(`
        INSERT INTO activity_events (id, user_id, repository_id, type, title, description, created_at)
        VALUES ('act_b', ?, ?, 'scan_started', 'User B Event', 'Activity B', ?)
      `).run(userB.id, repoB, now);

      // Activity query scoped by workspace membership
      const appDb = getDatabase();
      const userAActivities = await appDb.query<{ id: string; title: string }>(`
        SELECT a.id, a.title
        FROM activity_events a
        JOIN repositories r ON r.id = a.repository_id
        JOIN workspace_members wm ON wm.workspace_id = r.workspace_id
        WHERE wm.user_id = ?
      `, [userA.id]);

      expect(userAActivities).toHaveLength(1);
      expect(userAActivities[0]?.id).toBe('act_a');
      expect(userAActivities.some((act) => act.id === 'act_b')).toBe(false);
    });

    it('TEST I: New signup creates user, workspace, and owner membership transactionally', async () => {
      const email = 'newfounder@startup.com';
      const { user, session } = await createUserWithSession(email, 'SecurePass987!', 'Founder Jane');

      expect(user.id).toBeDefined();
      expect(session.id).toBeDefined();

      const appDb = getDatabase();
      const workspaces = await getUserWorkspaces(user.id);
      expect(workspaces).toHaveLength(1);

      const ws = workspaces[0]!;
      expect(ws.name).toBe("Founder Jane's Workspace");
      expect(ws.slug).toContain('newfounder');
      expect(ws.role).toBe('owner');

      // Verify DB records
      const membership = await appDb.queryOne<{ role: string; workspace_id: string }>(`
        SELECT role, workspace_id FROM workspace_members WHERE user_id = ? AND workspace_id = ?
      `, [user.id, ws.id]);
      expect(membership?.role).toBe('owner');
      expect(membership?.workspace_id).toBe(ws.id);
    });

    it('TEST J: Existing users are migrated without repository loss', async () => {
      // Simulate existing v0.7 database with unassigned repositories
      const userId = 'usr_legacy_dev';
      const repoId = 'repo_legacy_core';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO users (id, email, password_hash, name, created_at)
        VALUES (?, 'legacy@corp.internal', 'hash', 'Legacy Dev', ?)
      `).run(userId, now);

      db.prepare(`
        INSERT INTO repositories (id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, 'corp', 'legacy-core', 'corp/legacy-core', '888', 'main', 'connected', ?)
      `).run(repoId, userId, now);

      // Run migration 003
      const appDb = getDatabase();
      await runMigrations(appDb);

      // Verify user has default workspace and repo has workspace_id populated
      const workspaces = await getUserWorkspaces(userId);
      expect(workspaces.length).toBeGreaterThan(0);
      const ws = workspaces[0]!;

      const repo = await appDb.queryOne<{ id: string; workspace_id: string }>(`
        SELECT id, workspace_id FROM repositories WHERE id = ?
      `, [repoId]);
      expect(repo?.workspace_id).toBe(ws.id);

      // Verify User can access repository via workspace
      const { repository } = await requireRepositoryAccess(repoId, userId);
      expect(repository.id).toBe(repoId);
      expect(repository.workspace_id).toBe(ws.id);
    });

    it('TEST K: Running the migration twice does not create duplicates', async () => {
      const appDb = getDatabase();

      // First run (already run by initDatabase or runMigrations)
      await runMigrations(appDb);
      const wsCount1 = (await appDb.query<{ id: string }>('SELECT id FROM workspaces')).length;
      const memCount1 = (await appDb.query<{ id: string }>('SELECT id FROM workspace_members')).length;

      // Second run: must be fully idempotent
      const run2 = await runMigrations(appDb);
      expect(run2).toHaveLength(0);

      const wsCount2 = (await appDb.query<{ id: string }>('SELECT id FROM workspaces')).length;
      const memCount2 = (await appDb.query<{ id: string }>('SELECT id FROM workspace_members')).length;

      expect(wsCount2).toBe(wsCount1);
      expect(memCount2).toBe(memCount1);
    });

    it('TEST L: Workspace member can access workspace resources', async () => {
      const owner = createUser('teamlead@corp.com', 'Pass12345!', 'Team Lead');
      const member = createUser('engineer@corp.com', 'Pass12345!', 'Engineer Bob');
      const ownerWs = await getDefaultWorkspaceForUser(owner.id);

      // Add member to owner's workspace with 'member' role
      const memberId = `wsm_${crypto.randomBytes(8).toString('hex')}`;
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO workspace_members (id, workspace_id, user_id, role, created_at)
        VALUES (?, ?, ?, 'member', ?)
      `).run(memberId, ownerWs.id, member.id, now);

      // Create repository in the workspace
      const repoId = `repo_${crypto.randomBytes(8).toString('hex')}`;
      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'corp', 'team-repo', 'corp/team-repo', '2001', 'main', 'connected', ?)
      `).run(repoId, ownerWs.id, owner.id, now);

      // Member should be authorized to access repository
      const access = await requireRepositoryAccess(repoId, member.id);
      expect(access.repository.id).toBe(repoId);
      expect(access.workspace.role).toBe('member');
    });

    it('TEST M: Non-member receives safe authorization failure', async () => {
      const owner = createUser('teamlead@corp.com', 'Pass12345!', 'Team Lead');
      const outsider = createUser('outsider@other.com', 'Pass12345!', 'Outsider');
      const ownerWs = await getDefaultWorkspaceForUser(owner.id);

      // Outsider is not a member -> fail safely
      await expect(requireWorkspaceMember(outsider.id, ownerWs.id)).rejects.toThrow(
        /Workspace not found or access denied/
      );
    });

    it('TEST N: Repository IDs cannot be used for IDOR', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsB = await getDefaultWorkspaceForUser(userB.id);

      const privateRepoB = 'repo_private_b_secret';
      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-b', 'private-b', 'org-b/private-b', '999', 'main', 'connected', ?)
      `).run(privateRepoB, wsB.id, userB.id, new Date().toISOString());

      // Attempting to supply User B's repository ID as User A fails cleanly
      await expect(requireRepositoryAccess(privateRepoB, userA.id)).rejects.toThrow(
        /Repository not found or access denied/
      );
    });

    it('TEST O: Migration IDs cannot be used for IDOR', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsB = await getDefaultWorkspaceForUser(userB.id);

      const repoB = `repo_${crypto.randomBytes(6).toString('hex')}`;
      const findingB = `fnd_${crypto.randomBytes(6).toString('hex')}`;
      const migrationB = 'mig_secret_target_b';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-b', 'repo-b', 'org-b/repo-b', '901', 'main', 'connected', ?)
      `).run(repoB, wsB.id, userB.id, now);

      db.prepare(`
        INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
        VALUES ('scn_b', ?, 'head_sha', 'completed', 'stripe', ?)
      `).run(repoB, now);

      db.prepare(`
        INSERT INTO findings (
          id, scan_id, repository_id, usage_id, change_id, provider, title, description,
          severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at
        ) VALUES (?, 'scn_b', ?, 'u1', 'ch1', 'stripe', 't', 'd', 'high', 1, 'f', 1, 's', 'open', 'r', '[]', '[]', ?)
      `).run(findingB, repoB, now);

      db.prepare(`
        INSERT INTO migrations (
          id, finding_id, repository_id, plan_id, status, plan_json, patch_diff, patch_digest, created_at
        ) VALUES (?, ?, ?, 'p1', 'planned', '{}', 'diff', 'digest', ?)
      `).run(migrationB, findingB, repoB, now);

      // User A attempting to inspect or propose Migration B receives safe rejection
      await expect(requireMigrationAccess(migrationB, userA.id)).rejects.toThrow(
        /Repository not found or access denied/
      );
    });

    it('TEST P: Pull request IDs cannot be used for IDOR', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsB = await getDefaultWorkspaceForUser(userB.id);

      const repoB = `repo_${crypto.randomBytes(6).toString('hex')}`;
      const findingB = `fnd_${crypto.randomBytes(6).toString('hex')}`;
      const migrationB = `mig_${crypto.randomBytes(6).toString('hex')}`;
      const prB = 'pr_secret_target_b';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, 'org-b', 'repo-b', 'org-b/repo-b', '902', 'main', 'connected', ?)
      `).run(repoB, wsB.id, userB.id, now);

      db.prepare(`
        INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
        VALUES ('scn_b', ?, 'head_sha', 'completed', 'stripe', ?)
      `).run(repoB, now);

      db.prepare(`
        INSERT INTO findings (
          id, scan_id, repository_id, usage_id, change_id, provider, title, description,
          severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at
        ) VALUES (?, 'scn_b', ?, 'u1', 'ch1', 'stripe', 't', 'd', 'high', 1, 'f', 1, 's', 'open', 'r', '[]', '[]', ?)
      `).run(findingB, repoB, now);

      db.prepare(`
        INSERT INTO migrations (
          id, finding_id, repository_id, plan_id, status, plan_json, patch_diff, patch_digest, created_at
        ) VALUES (?, ?, ?, 'p1', 'planned', '{}', 'diff', 'digest', ?)
      `).run(migrationB, findingB, repoB, now);

      db.prepare(`
        INSERT INTO pull_requests (
          id, migration_id, repository_id, number, title, branch_name, base_branch, url, state, created_at
        ) VALUES (?, ?, ?, 42, 'Secret PR', 'apiproof/patch', 'main', 'https://github.com/org-b/repo-b/pull/42', 'draft', ?)
      `).run(prB, migrationB, repoB, now);

      // User A attempting to access PR B receives safe rejection
      await expect(requirePullRequestAccess(prB, userA.id)).rejects.toThrow(
        /Repository not found or access denied/
      );
    });

    it('TEST Q: GitHub installation belongs to exactly one workspace', async () => {
      const userA = createUser('user_a@example.com', 'Pass12345!', 'User A');
      const wsA = await getDefaultWorkspaceForUser(userA.id);

      const installationRecordId = `ghi_${crypto.randomBytes(8).toString('hex')}`;
      const uniqueInstallId = 'gh_install_12345678';
      const now = new Date().toISOString();

      db.prepare(`
        INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
        VALUES (?, ?, ?, 'my-corp-org', 'Organization', ?, ?)
      `).run(installationRecordId, wsA.id, uniqueInstallId, now, now);

      // Lookup via helper
      const installation = await getWorkspaceGitHubInstallation(wsA.id);
      expect(installation).not.toBeNull();
      expect(installation?.workspaceId).toBe(wsA.id);
      expect(installation?.installationId).toBe(uniqueInstallId);
      expect(installation?.accountLogin).toBe('my-corp-org');
      expect(installation?.accountType).toBe('Organization');

      // Uniqueness constraint check: inserting same installation_id for another workspace must fail
      const userB = createUser('user_b@example.com', 'Pass12345!', 'User B');
      const wsB = await getDefaultWorkspaceForUser(userB.id);

      expect(() => {
        db.prepare(`
          INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
          VALUES ('ghi_conflict', ?, ?, 'my-corp-org', 'Organization', ?, ?)
        `).run(wsB.id, uniqueInstallId, now, now);
      }).toThrow(/UNIQUE constraint failed/);
    });
  });
});

