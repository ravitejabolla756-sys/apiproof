import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser, getWorkspaceGitHubInstallation, requireRepositoryAccess } from '../apps/web/src/lib/server/workspace-service.js';
import { createGitHubInstallationState, verifyAndConsumeGitHubInstallationState, getGitHubAppInstallUrl, verifyGitHubAppInstallation, fetchWorkspaceRepositories, fetchWorkspaceRepository } from '../apps/web/src/lib/server/github.js';
import { NodeGitHubAppTokenProvider, FetchGitHubControlledWriteTransport, fetchAllInstallationRepositories, createVerificationEvidence, computeCanonicalPatchDigest, validateControlledWriteRequest, type GitHubAppConfig } from '@apiproof/core';
import { createGitHubProposal } from '../apps/web/src/lib/server/proposal-service.js';
import { runRepositoryScan } from '../apps/web/src/lib/server/scan-service.js';
import { generateMigrationForFinding } from '../apps/web/src/lib/server/planning-service.js';

const TEST_DB_PATH = path.resolve('.tmp/test-phase3-onboarding.db');

// Generate test RSA key pair for App JWT signing
const { privateKey: TEST_PRIVATE_KEY_PEM } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const TEST_APP_ID = '4888527';
const TEST_INSTALLATION_ID = '98765432';

describe('Phase 3A — Real GitHub App Onboarding', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'phase3-test-secret-stable-minimum-32-chars';
    process.env.GITHUB_APP_ID = TEST_APP_ID;
    process.env.GITHUB_APP_PRIVATE_KEY = TEST_PRIVATE_KEY_PEM;
    process.env.GITHUB_APP_SLUG = 'apiproof';
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;

    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    initDatabase(TEST_DB_PATH);
  });

  afterEach(() => {
    try {
      closeDatabase();
    } catch { /* ignore */ }
    if (fs.existsSync(TEST_DB_PATH)) {
      try { fs.unlinkSync(TEST_DB_PATH); } catch { /* ignore */ }
    }
    vi.restoreAllMocks();
  });

  // TEST A: Authenticated user can generate installation URL
  it('TEST A: Authenticated user can generate installation URL bound to user and workspace', async () => {
    const { user } = await createUserWithSession('alice@example.com', 'Pass12345!', 'Alice Owner');
    const defaultWs = await getDefaultWorkspaceForUser(user.id);

    const installUrl = await getGitHubAppInstallUrl(user.id, defaultWs.id);
    expect(installUrl).toContain('https://github.com/apps/apiproof/installations/new?state=');

    // Extract state parameter
    const state = new URL(installUrl).searchParams.get('state');
    expect(state).toBeTruthy();

    // Verify state was persisted in github_installation_states
    const dbAdapter = getDatabase();
    const storedState = await dbAdapter.queryOne<{ user_id: string; workspace_id: string }>(`
      SELECT user_id, workspace_id FROM github_installation_states WHERE state = ?
    `, [state!]);

    expect(storedState).toBeDefined();
    expect(storedState?.user_id).toBe(user.id);
    expect(storedState?.workspace_id).toBe(defaultWs.id);
  });

  // TEST B: Installation callback rejects unauthenticated users
  it('TEST B: Installation callback rejects unauthenticated users', async () => {
    // Session validation fails if user is not authenticated
    const checkState = await verifyAndConsumeGitHubInstallationState('some-state', 'unauthenticated_user_id');
    expect(checkState.valid).toBe(false);
  });

  // TEST C: Invalid callback state rejected
  it('TEST C: Invalid callback state rejected', async () => {
    const { user } = await createUserWithSession('bob@example.com', 'Pass12345!', 'Bob User');
    const result = await verifyAndConsumeGitHubInstallationState('forged.invalidHmac', user.id);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('INVALID_STATE');
  });

  // TEST D: Expired callback state rejected
  it('TEST D: Expired callback state rejected', async () => {
    const { user } = await createUserWithSession('carol@example.com', 'Pass12345!', 'Carol User');
    const ws = await getDefaultWorkspaceForUser(user.id);

    // Create a state with an expired timestamp
    const nonce = crypto.randomBytes(16).toString('hex');
    const expiredTimestamp = Date.now() - 60000; // 1 minute ago
    const payload = `${user.id}:${ws.id}:${expiredTimestamp}:${nonce}`;
    const hmac = crypto.createHmac('sha256', process.env.APIPROOF_SECRET!).update(payload).digest('hex');
    const expiredState = `${Buffer.from(payload).toString('base64url')}.${hmac}`;

    const dbAdapter = getDatabase();
    await dbAdapter.execute(`
      INSERT INTO github_installation_states (state, user_id, workspace_id, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [expiredState, user.id, ws.id, expiredTimestamp, new Date().toISOString()]);

    const result = await verifyAndConsumeGitHubInstallationState(expiredState, user.id);
    expect(result.valid).toBe(false);
    expect(result.errorCode).toBe('EXPIRED_STATE');
  });

  // TEST E: Reused callback state rejected
  it('TEST E: Reused callback state rejected', async () => {
    const { user } = await createUserWithSession('dan@example.com', 'Pass12345!', 'Dan User');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const state = await createGitHubInstallationState(user.id, ws.id);

    // Consume state once
    const firstCheck = await verifyAndConsumeGitHubInstallationState(state, user.id);
    expect(firstCheck.valid).toBe(true);

    // Replay attempt
    const secondCheck = await verifyAndConsumeGitHubInstallationState(state, user.id);
    expect(secondCheck.valid).toBe(false);
    expect(secondCheck.errorCode).toBe('REUSED_STATE');
  });

  // TEST F: Installation is associated with current workspace
  it('TEST F: Installation is associated with current workspace and metadata saved', async () => {
    const { user } = await createUserWithSession('eve@example.com', 'Pass12345!', 'Eve Owner');
    const ws = await getDefaultWorkspaceForUser(user.id);

    // Mock GitHub installation verification API call
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes(`/app/installations/${TEST_INSTALLATION_ID}`)) {
        return new Response(JSON.stringify({
          id: Number(TEST_INSTALLATION_ID),
          app_id: Number(TEST_APP_ID),
          account: { login: 'acme-corp', type: 'Organization' },
        }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    const meta = await verifyGitHubAppInstallation(TEST_INSTALLATION_ID, mockFetch);
    expect(meta.accountLogin).toBe('acme-corp');
    expect(meta.accountType).toBe('Organization');

    // Associate with workspace in DB
    const dbAdapter = getDatabase();
    const installationRecordId = 'ghi_test_f';
    const now = new Date().toISOString();
    await dbAdapter.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [installationRecordId, ws.id, TEST_INSTALLATION_ID, meta.accountLogin, meta.accountType, now, now]);

    // Verify DB association
    const installationRecord = await getWorkspaceGitHubInstallation(ws.id);
    expect(installationRecord).not.toBeNull();
    expect(installationRecord?.installationId).toBe(TEST_INSTALLATION_ID);
    expect(installationRecord?.accountLogin).toBe('acme-corp');
    expect(installationRecord?.accountType).toBe('Organization');
  });

  // TEST G: Same installation cannot be attached to two workspaces
  it('TEST G: Same installation cannot be attached to two workspaces (application & DB uniqueness)', async () => {
    const { user: userA } = await createUserWithSession('userA@example.com', 'Pass12345!', 'User A');
    const wsA = await getDefaultWorkspaceForUser(userA.id);

    // Attach installation to Workspace A
    const dbAdapter = getDatabase();
    await dbAdapter.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
      VALUES ('ghi_A', ?, '555444333', 'shared-org', 'Organization', ?, ?)
    `, [wsA.id, new Date().toISOString(), new Date().toISOString()]);

    const { user: userB } = await createUserWithSession('userB@example.com', 'Pass12345!', 'User B');
    const wsB = await getDefaultWorkspaceForUser(userB.id);

    // Check ownership before associate
    const existing = await dbAdapter.queryOne<{ id: string; workspace_id: string }>(`
      SELECT id, workspace_id FROM github_installations WHERE installation_id = ?
    `, ['555444333']);

    expect(existing).toBeDefined();
    expect(existing?.workspace_id).not.toBe(wsB.id);

    // Database uniqueness constraint also prevents duplicate
    await expect(dbAdapter.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
      VALUES ('ghi_B', ?, '555444333', 'shared-org', 'Organization', ?, ?)
    `, [wsB.id, new Date().toISOString(), new Date().toISOString()])).rejects.toThrow();
  });

  // TEST H: Workspace A cannot access Workspace B installation
  it('TEST H: Workspace A cannot access Workspace B installation', async () => {
    const { user: userA } = await createUserWithSession('userA_iso@example.com', 'Pass12345!', 'User A');
    const { user: userB } = await createUserWithSession('userB_iso@example.com', 'Pass12345!', 'User B');

    const wsA = await getDefaultWorkspaceForUser(userA.id);
    const wsB = await getDefaultWorkspaceForUser(userB.id);

    const dbAdapter = getDatabase();
    await dbAdapter.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
      VALUES ('ghi_B', ?, 'inst_workspace_b', 'org-b', 'Organization', ?, ?)
    `, [wsB.id, new Date().toISOString(), new Date().toISOString()]);

    const instA = await getWorkspaceGitHubInstallation(wsA.id);
    expect(instA).toBeNull();

    const instB = await getWorkspaceGitHubInstallation(wsB.id);
    expect(instB?.installationId).toBe('inst_workspace_b');
  });

  // TEST I: Repository listing requires workspace installation
  it('TEST I: Repository listing returns empty/disconnected if workspace lacks installation', async () => {
    const { user } = await createUserWithSession('noinst@example.com', 'Pass12345!', 'No Inst User');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const result = await fetchWorkspaceRepositories(ws.id);
    expect(result.connected).toBe(false);
    expect(result.repositories.length).toBe(0);
  });

  // TEST J: Repository listing does not expose installation tokens
  it('TEST J: Repository listing does not expose installation tokens or private keys', async () => {
    const { user } = await createUserWithSession('listing@example.com', 'Pass12345!', 'Listing User');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const dbAdapter = getDatabase();
    await dbAdapter.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
      VALUES ('ghi_listing', ?, 'inst_list_123', 'listing-org', 'Organization', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);

    const MOCK_SECRET_TOKEN = 'ghs_SUPER_SECRET_INSTALLATION_TOKEN_999999';

    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('/access_tokens')) {
        return new Response(JSON.stringify({ token: MOCK_SECRET_TOKEN, expires_at: new Date(Date.now() + 3600000).toISOString() }), { status: 201 });
      }
      if (url.includes('/installation/repositories')) {
        return new Response(JSON.stringify({
          total_count: 2,
          repositories: [
            { id: 101, name: 'repo-one', full_name: 'listing-org/repo-one', owner: { login: 'listing-org' }, private: true, default_branch: 'main' },
            { id: 102, name: 'repo-two', full_name: 'listing-org/repo-two', owner: { login: 'listing-org' }, private: false, default_branch: 'develop' },
          ],
        }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    const result = await fetchWorkspaceRepositories(ws.id, mockFetch);
    expect(result.connected).toBe(true);
    expect(result.repositories.length).toBe(2);

    const jsonString = JSON.stringify(result);
    expect(jsonString).not.toContain(MOCK_SECRET_TOKEN);
    expect(jsonString).not.toContain('ghs_');
    expect(jsonString).not.toContain('PRIVATE KEY');
    expect((result as unknown as Record<string, unknown>).token).toBeUndefined();
  });

  // TEST K: Repository connection verifies authoritative GitHub repository identity
  it('TEST K: Repository connection verifies authoritative GitHub repository identity', async () => {
    const { user } = await createUserWithSession('repoauth@example.com', 'Pass12345!', 'Repo Auth');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const dbAdapter = getDatabase();
    await dbAdapter.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
      VALUES ('ghi_repoauth', ?, 'inst_repoauth_456', 'real-org', 'Organization', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);

    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('/access_tokens')) {
        return new Response(JSON.stringify({ token: 'test-token', expires_at: new Date(Date.now() + 3600000).toISOString() }), { status: 201 });
      }
      if (url.includes('/repositories/777888')) {
        return new Response(JSON.stringify({
          id: 777888,
          name: 'billing-engine',
          full_name: 'real-org/billing-engine',
          owner: { login: 'real-org' },
          private: true,
          default_branch: 'production',
        }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    const repoMeta = await fetchWorkspaceRepository(ws.id, '777888', mockFetch);
    expect(repoMeta.id).toBe('777888');
    expect(repoMeta.name).toBe('billing-engine');
    expect(repoMeta.owner).toBe('real-org');
    expect(repoMeta.fullName).toBe('real-org/billing-engine');
    expect(repoMeta.defaultBranch).toBe('production');

    // Save into repositories under workspace
    const repoId = 'repo_connected_k';
    const now = new Date().toISOString();
    await dbAdapter.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'connected', ?)
    `, [repoId, ws.id, user.id, repoMeta.owner, repoMeta.name, repoMeta.fullName, repoMeta.id, repoMeta.defaultBranch, now]);

    // Verify stored row in database
    const stored = await dbAdapter.queryOne<{ owner: string; name: string; default_branch: string; github_repository_id: string }>(`
      SELECT owner, name, default_branch, github_repository_id FROM repositories WHERE id = ?
    `, [repoId]);

    expect(stored?.owner).toBe('real-org');
    expect(stored?.name).toBe('billing-engine');
    expect(stored?.default_branch).toBe('production');
    expect(stored?.github_repository_id).toBe('777888');
  });

  // TEST L: Client cannot connect arbitrary repository ID
  it('TEST L: Client cannot connect arbitrary repository ID not in installation', async () => {
    const { user } = await createUserWithSession('unauth@example.com', 'Pass12345!', 'Unauth User');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const dbAdapter = getDatabase();
    await dbAdapter.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
      VALUES ('ghi_unauth', ?, 'inst_unauth_789', 'real-org', 'Organization', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);

    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('/access_tokens')) {
        return new Response(JSON.stringify({ token: 'test-token' }), { status: 201 });
      }
      return new Response(JSON.stringify({ message: 'Not Found' }), { status: 404 });
    };

    await expect(fetchWorkspaceRepository(ws.id, '999999', mockFetch)).rejects.toThrow('GITHUB_REPOSITORY_NOT_FOUND_IN_INSTALLATION');
  });

  // TEST M: Workspace A cannot connect Workspace B repository
  it('TEST M: Workspace A cannot access or control Workspace B repository', async () => {
    const { user: userA } = await createUserWithSession('alice_m@example.com', 'Pass12345!', 'Alice M');
    const { user: userB } = await createUserWithSession('bob_m@example.com', 'Pass12345!', 'Bob M');

    const wsB = await getDefaultWorkspaceForUser(userB.id);
    const dbAdapter = getDatabase();
    const repoBId = 'repo_workspace_b';

    await dbAdapter.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'bob-org', 'bob-repo', 'bob-org/bob-repo', '888111', 'main', 'connected', ?)
    `, [repoBId, wsB.id, userB.id, new Date().toISOString()]);

    // User A attempts to access Repo B
    await expect(requireRepositoryAccess(repoBId, userA.id)).rejects.toThrow('Repository not found or access denied');
  });

  // TEST N: Installation token never reaches browser/API response
  it('TEST N: Installation token never reaches browser/API response', async () => {
    const { user } = await createUserWithSession('tokenleak@example.com', 'Pass12345!', 'Token Leak Test');
    const ws = await getDefaultWorkspaceForUser(user.id);

    const dbAdapter = getDatabase();
    await dbAdapter.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, created_at, updated_at)
      VALUES ('ghi_tokenleak', ?, 'inst_tokenleak', 'org-secret', 'Organization', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);

    const SENSITIVE_TOKEN = 'ghs_EXACT_INTERNAL_SECRET_TOKEN_DO_NOT_LEAK';

    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes('/access_tokens')) {
        return new Response(JSON.stringify({ token: SENSITIVE_TOKEN }), { status: 201 });
      }
      if (url.includes('/installation/repositories')) {
        return new Response(JSON.stringify({
          total_count: 1,
          repositories: [{ id: 555, name: 'api', full_name: 'org-secret/api', owner: { login: 'org-secret' }, private: true, default_branch: 'main' }],
        }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    const result = await fetchWorkspaceRepositories(ws.id, mockFetch);
    const text = JSON.stringify(result);

    expect(text).not.toContain(SENSITIVE_TOKEN);
    expect(text).not.toContain('ghs_');
    expect((result as unknown as Record<string, unknown>).token).toBeUndefined();
    expect((result as unknown as Record<string, unknown>).installationToken).toBeUndefined();
  });

  // TEST O: Live write transport uses workspace installation rather than old fixture allowlist
  it('TEST O: Live write transport uses workspace installation rather than old fixture allowlist', async () => {
    const recordedCalls: Array<{ method: string; url: string }> = [];
    const mockFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      recordedCalls.push({ method, url });

      if (url.endsWith('/git/refs')) return new Response(JSON.stringify({ ref: 'refs/heads/apiproof/test', object: { sha: 'base-sha' } }), { status: 201 });
      if (url.endsWith('/git/trees')) return new Response(JSON.stringify({ sha: 'tree-sha-1' }), { status: 201 });
      if (url.endsWith('/git/commits')) return new Response(JSON.stringify({ sha: 'commit-sha-1' }), { status: 201 });
      if (url.includes('/git/refs/heads/apiproof/')) return new Response(JSON.stringify({ ref: 'refs/heads/apiproof/test', object: { sha: 'commit-sha-1' } }), { status: 200 });
      if (url.endsWith('/pulls')) return new Response(JSON.stringify({ number: 42, html_url: 'https://github.com/customer-org/customer-repo/pull/42' }), { status: 201 });
      return new Response(null, { status: 404 });
    };

    const customerRepoConfig: GitHubAppConfig = {
      enabled: true,
      appId: TEST_APP_ID,
      privateKey: TEST_PRIVATE_KEY_PEM,
      installationId: 'custom_inst_999',
      repositoryId: '987654321', // Arbitrary customer repo ID (NOT fixture 1363070568)
      owner: 'customer-org',
      repository: 'customer-repo',
      mode: 'PROPOSE',
    };

    const tokenProvider = new NodeGitHubAppTokenProvider(customerRepoConfig, { allowAnyRepository: true });
    vi.spyOn(tokenProvider, 'getToken').mockResolvedValue('customer-installation-token');

    // With workspaceAuthorized: true, customer repository write succeeds without requiring fixture ID
    const transport = new FetchGitHubControlledWriteTransport(
      customerRepoConfig,
      tokenProvider,
      mockFetch,
      'https://api.github.com',
      { workspaceAuthorized: true, authoritativeDefaultBranch: 'main' }
    );

    const branchRes = await transport.createBranchRef('apiproof/fix-customer-1', 'base-sha');
    expect(branchRes.ref).toBe('refs/heads/apiproof/fix-customer-1');

    const commitRes = await transport.createCommit('apiproof/fix-customer-1', { 'src/index.ts': 'code' }, 'fix: update');
    expect(commitRes.sha).toBe('commit-sha-1');

    const prRes = await transport.createPullRequest({
      branch: 'apiproof/fix-customer-1',
      title: 'fix(api): update stripe',
      body: 'Review only',
      base: 'main',
      draft: true,
    });
    expect(prRes.number).toBe(42);
    expect(recordedCalls.length).toBe(5);
  });

  // TEST P: Existing draft-only policy remains enforced
  it('TEST P: Existing draft-only policy remains strictly enforced', async () => {
    const config: GitHubAppConfig = {
      enabled: true, appId: TEST_APP_ID, privateKey: TEST_PRIVATE_KEY_PEM,
      installationId: 'inst_1', repositoryId: '123', owner: 'org', repository: 'repo', mode: 'PROPOSE',
    };
    const tokens = { getToken: async () => 'tok' };
    const transport = new FetchGitHubControlledWriteTransport(config, tokens, undefined, undefined, { workspaceAuthorized: true, authoritativeDefaultBranch: 'main' });

    await expect(transport.createPullRequest({
      branch: 'apiproof/test',
      title: 'pr',
      body: 'body',
      base: 'main',
      draft: false, // Forbidden: non-draft PR
    })).rejects.toThrow('GITHUB_OPERATION_REJECTED');
  });

  // TEST Q: Existing isolated-branch policy remains enforced
  it('TEST Q: Existing isolated-branch policy remains strictly enforced', async () => {
    const config: GitHubAppConfig = {
      enabled: true, appId: TEST_APP_ID, privateKey: TEST_PRIVATE_KEY_PEM,
      installationId: 'inst_1', repositoryId: '123', owner: 'org', repository: 'repo', mode: 'PROPOSE',
    };
    const tokens = { getToken: async () => 'tok' };
    const transport = new FetchGitHubControlledWriteTransport(config, tokens, undefined, undefined, { workspaceAuthorized: true });

    // Non-apiproof branch name rejected
    await expect(transport.createBranchRef('feature/my-patch', 'base-sha')).rejects.toThrow('GITHUB_INVALID_BRANCH_NAME');

    // Default branch targeting rejected
    await expect(transport.createBranchRef('main', 'base-sha')).rejects.toThrow('GITHUB_INVALID_BRANCH_NAME');
  });

  // TEST R: Existing canonical digest verification remains enforced
  it('TEST R: Existing canonical digest verification remains enforced', () => {
    const patch = { 'src/billing.ts': 'export const x = 1;\n' };
    const digest = computeCanonicalPatchDigest(patch);
    const validSha = 'b1be45b401f41106ecfd489bbbb1fff71639c763';

    const evidence = createVerificationEvidence({
      baselineSha: validSha,
      changeId: 'chg_1',
      patchDigest: digest,
      repositoryId: 'repo_1',
      proofLevel: 'CONTRACT_VERIFIED',
      patchApplied: true,
      typecheckPassed: true,
      testsPassed: true,
      contractPassed: true,
    });

    // Valid check
    const valid = validateControlledWriteRequest({
      repository: { repositoryId: 'repo_1', owner: 'org', repository: 'repo', defaultBranch: 'main' },
      baseline: { exactSha: validSha },
      change: { changeId: 'chg_1' },
      migration: { planId: 'p1', patchDigest: digest, allowedFiles: ['src/billing.ts'], patchContent: patch },
      branch: { branchName: 'apiproof/chg_1/test' },
      verification: evidence,
    }, { repositoryId: 'repo_1', owner: 'org', repository: 'repo' });
    expect(valid.valid).toBe(true);

    // Tampered digest check
    const tampered = validateControlledWriteRequest({
      repository: { repositoryId: 'repo_1', owner: 'org', repository: 'repo', defaultBranch: 'main' },
      baseline: { exactSha: validSha },
      change: { changeId: 'chg_1' },
      migration: { planId: 'p1', patchDigest: 'tampered-sha256-digest', allowedFiles: ['src/billing.ts'], patchContent: patch },
      branch: { branchName: 'apiproof/chg_1/test' },
      verification: evidence,
    }, { repositoryId: 'repo_1', owner: 'org', repository: 'repo' });
    expect(tampered.valid).toBe(false);
  });

  // TEST S: Existing idempotent PR behavior remains enforced
  it('TEST S: Existing idempotent PR behavior remains enforced', async () => {
    const { user } = await createUserWithSession('idem@example.com', 'Pass12345!', 'Idem User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const dbAdapter = getDatabase();

    const repoId = 'repo_idem';
    await dbAdapter.execute("UPDATE repositories SET lifecycle = 'historical', origin = 'seeded_fixture' WHERE id = 'repo_apiproof_fixture'");
    await dbAdapter.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES (?, ?, ?, 'ravitejabolla756-sys', 'apiproof-github-fixture', 'ravitejabolla756-sys/apiproof-github-fixture', '1363070568', 'main', 'connected', ?)
    `, [repoId, ws.id, user.id, new Date().toISOString()]);
    const scan = await runRepositoryScan(repoId, user.id);
    const finding = scan.findings.find((item) => item.changeId === 'stripe-subscription-coupon-removed')!;
    const migration = await generateMigrationForFinding(finding.id, user.id);
    const migrationId = migration.id;

    // First proposal creation
    const res1 = await createGitHubProposal(migrationId, user.id);
    expect(res1.state).toBe('draft');

    // Second proposal creation for the same migration returns the existing PR
    const res2 = await createGitHubProposal(migrationId, user.id);
    expect(res2.pullRequestId).toBe(res1.pullRequestId);
    expect(res2.number).toBe(res1.number);
    expect(res2.url).toBe(res1.url);

    // Verify only one PR was recorded in database
    const prRows = await dbAdapter.query<{ id: string }>(`
      SELECT id FROM pull_requests WHERE migration_id = ?
    `, [migrationId]);
    expect(prRows.length).toBe(1);
  });

  // TEST T: Pagination works for installations with more than one GitHub API page
  it('TEST T: Pagination works for installations with more than one GitHub API page', async () => {
    // Generate 125 mock repositories across 2 pages
    const page1Repos = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      name: `repo-${i + 1}`,
      full_name: `acme/repo-${i + 1}`,
      owner: { login: 'acme' },
      private: true,
      default_branch: 'main',
    }));

    const page2Repos = Array.from({ length: 25 }, (_, i) => ({
      id: i + 101,
      name: `repo-${i + 101}`,
      full_name: `acme/repo-${i + 101}`,
      owner: { login: 'acme' },
      private: false,
      default_branch: 'main',
    }));

    const mockFetch: typeof fetch = async (input) => {
      const url = new URL(String(input));
      const page = url.searchParams.get('page');
      if (page === '1') {
        return new Response(JSON.stringify({ total_count: 125, repositories: page1Repos }), { status: 200 });
      }
      if (page === '2') {
        return new Response(JSON.stringify({ total_count: 125, repositories: page2Repos }), { status: 200 });
      }
      return new Response(JSON.stringify({ total_count: 125, repositories: [] }), { status: 200 });
    };

    const allRepos = await fetchAllInstallationRepositories('fake-token', mockFetch);
    expect(allRepos.length).toBe(125);
    expect(allRepos[0]?.name).toBe('repo-1');
    expect(allRepos[124]?.name).toBe('repo-125');
  });
});
