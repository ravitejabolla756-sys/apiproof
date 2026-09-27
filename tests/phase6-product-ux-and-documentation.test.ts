/**
 * Phase 6: Customer Product UX, Onboarding & Documentation Test Suite
 *
 * Covers:
 *   TEST 1: Inventory registries return real provider rules for Stripe and Twilio with valid attributes
 *   TEST 2: Default workspace overview evaluates onboarding state (hasGitHubInstallation, stats) accurately
 *   TEST 3: Repository status handling supports active, disconnected, suspended, and deleted states
 *   TEST 4: Security verification — workspace data payloads never expose private keys or secrets
 *   TEST 5: Documentation verification — apiproof-v1-documentation.md exists and covers all 12 sections
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserAsync } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser, getWorkspaceGitHubInstallation } from '../apps/web/src/lib/server/workspace-service.js';
import { loadStripeRegistry, loadTwilioRegistry } from '@apiproof/providers';

const TEST_DB_PATH = path.resolve('.tmp/test-phase6-ux.db');

describe('Phase 6 — Customer Product UX, Onboarding & Documentation', () => {
  beforeEach(() => {
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
  // TEST 1: Real Provider Rule Registries
  // -------------------------------------------------------------------------
  it('TEST 1: Provider rule registries return real un-fabricated rules for Stripe and Twilio', async () => {
    const stripeRules = await loadStripeRegistry('registry/stripe');
    const twilioRules = await loadTwilioRegistry('registry/twilio');

    expect(stripeRules.length).toBeGreaterThan(0);
    expect(twilioRules.length).toBeGreaterThan(0);

    const sampleStripe = stripeRules[0];
    expect(sampleStripe).toBeDefined();
    if (sampleStripe) {
      expect(sampleStripe.id).toBeDefined();
      expect(sampleStripe.title).toBeDefined();
      expect(sampleStripe.severity).toBeDefined();
    }

    const sampleTwilio = twilioRules[0];
    expect(sampleTwilio).toBeDefined();
    if (sampleTwilio) {
      expect(sampleTwilio.id).toBeDefined();
      expect(sampleTwilio.title).toBeDefined();
      expect(sampleTwilio.severity).toBeDefined();
    }
  });

  // -------------------------------------------------------------------------
  // TEST 2: Workspace Onboarding & Overview State
  // -------------------------------------------------------------------------
  it('TEST 2: Default workspace overview correctly evaluates onboarding state for new users', async () => {
    const user = await createUserAsync('onboarding-user@apiproof.test', 'SecurePass123!#$', 'Onboarding User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    expect(workspace).toBeDefined();

    const installation = await getWorkspaceGitHubInstallation(workspace.id);
    expect(installation).toBeNull(); // No installation initially -> triggers onboarding step 1

    const db = getDatabase();
    const repoStats = await db.queryOne<{ count: number }>(`
      SELECT COUNT(*) as count FROM repositories WHERE workspace_id = ?
    `, [workspace.id]);

    expect(Number(repoStats?.count ?? 0)).toBe(0);
  });

  // -------------------------------------------------------------------------
  // TEST 3: Repository Experience & Status Handling
  // -------------------------------------------------------------------------
  it('TEST 3: Repositories table supports active, disconnected, suspended, and deleted states', async () => {
    const user = await createUserAsync('repo-status-user@apiproof.test', 'SecurePass123!#$', 'Repo User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    const repoStatuses = ['active', 'disconnected', 'suspended', 'deleted'];

    for (let i = 0; i < repoStatuses.length; i++) {
      const status = repoStatuses[i]!;
      await db.execute(`
        INSERT INTO repositories (id, workspace_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [`repo_st_${i}`, workspace.id, 'org', `app-${status}`, `org/app-${status}`, `gh_${i}`, 'main', status]);
    }

    const repos = await db.query<{ id: string; status: string }>(`
      SELECT id, status FROM repositories WHERE workspace_id = ? ORDER BY id ASC
    `, [workspace.id]);

    expect(repos).toHaveLength(4);
    expect(repos.map((r) => r.status)).toEqual(['active', 'disconnected', 'suspended', 'deleted']);
  });

  // -------------------------------------------------------------------------
  // TEST 4: Security Verification
  // -------------------------------------------------------------------------
  it('TEST 4: Workspace payloads never expose private keys, secrets, or internal tokens', async () => {
    const user = await createUserAsync('security-user@apiproof.test', 'SecurePass123!#$', 'Security User');
    const workspace = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();

    // Create a mock GitHub installation
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, ['inst_sec_01', workspace.id, '999123', 'sec-org', 'Organization', 'active']);

    const installation = await getWorkspaceGitHubInstallation(workspace.id);
    expect(installation).toBeDefined();

    const json = JSON.stringify(installation);
    expect(json).not.toContain('private_key');
    expect(json).not.toContain('webhook_secret');
    expect(json).not.toContain('worker_secret');
    expect(json).not.toContain('session_secret');
  });

  // -------------------------------------------------------------------------
  // TEST 5: Documentation Verification
  // -------------------------------------------------------------------------
  it('TEST 5: apiproof-v1-documentation.md exists and covers required operational sections', () => {
    const docPath = path.resolve('docs/apiproof-v1-documentation.md');
    expect(fs.existsSync(docPath)).toBe(true);

    const content = fs.readFileSync(docPath, 'utf-8');
    expect(content).toContain('1. APIProof System Overview');
    expect(content).toContain('2. GitHub App Installation');
    expect(content).toContain('3. Repository Connection');
    expect(content).toContain('4. Scan Lifecycle');
    expect(content).toContain('5. Findings Experience');
    expect(content).toContain('6. Migration Experience');
    expect(content).toContain('7. Draft PR Safety Invariants');
    expect(content).toContain('8. Webhook Setup');
    expect(content).toContain('9. Worker Setup');
    expect(content).toContain('10. Local Development');
    expect(content).toContain('11. Environment Variables');
    expect(content).toContain('12. Production Deployment');
  });
});
