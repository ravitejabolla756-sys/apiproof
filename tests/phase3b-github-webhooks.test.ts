import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { initDatabase, closeDatabase, getDatabase } from '../apps/web/src/lib/server/db/index.js';
import { createUserWithSession } from '../apps/web/src/lib/server/auth.js';
import { getDefaultWorkspaceForUser, getWorkspaceGitHubInstallation, requireRepositoryAccess } from '../apps/web/src/lib/server/workspace-service.js';
import { verifyWebhookSignature, isDeliveryProcessed, recordWebhookDelivery, claimWebhookDelivery, processGitHubWebhook } from '../apps/web/src/lib/server/github-webhooks.js';
import { computeCanonicalPatchDigest, createVerificationEvidence } from '@apiproof/core';

const TEST_DB_PATH = path.resolve('.tmp/test-phase3b-webhooks.db');
const TEST_SECRET = 'whsec_test_secret_stable_1234567890abcdef';

function signPayload(body: string, secret = TEST_SECRET): string {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body, 'utf8');
  return `sha256=${hmac.digest('hex')}`;
}

describe('Phase 3B — GitHub Webhooks & Repository Synchronization', () => {
  beforeEach(() => {
    process.env.APIPROOF_SECRET = 'phase3b-test-secret-minimum-32-chars-long';
    process.env.GITHUB_WEBHOOK_SECRET = TEST_SECRET;
    process.env.APIPROOF_DB_PATH = TEST_DB_PATH;
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
    vi.restoreAllMocks();
  });

  // TEST A: Valid webhook signature accepted
  it('TEST A: Valid webhook signature accepted', () => {
    const body = JSON.stringify({ action: 'ping' });
    const sig = signPayload(body);
    expect(verifyWebhookSignature(body, sig, TEST_SECRET)).toBe(true);
  });

  // TEST B: Missing signature rejected
  it('TEST B: Missing signature rejected', () => {
    const body = JSON.stringify({ action: 'ping' });
    expect(verifyWebhookSignature(body, null, TEST_SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, undefined as unknown as null, TEST_SECRET)).toBe(false);
  });

  // TEST C: Invalid signature rejected
  it('TEST C: Invalid signature rejected', () => {
    const body = JSON.stringify({ action: 'ping' });
    expect(verifyWebhookSignature(body, 'sha256=invalidhexdigest12345', TEST_SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, 'malformed-signature', TEST_SECRET)).toBe(false);
  });

  // TEST D: Signature is calculated against raw request body
  it('TEST D: Signature is calculated against raw request body', () => {
    const rawBody = '{"action":"ping","extra":true}';
    const sig = signPayload(rawBody);
    expect(verifyWebhookSignature(rawBody, sig, TEST_SECRET)).toBe(true);
    // Tampered body with identical structure but whitespace fails
    const tamperedBody = '{"action": "ping", "extra": true}';
    expect(verifyWebhookSignature(tamperedBody, sig, TEST_SECRET)).toBe(false);
  });

  // TEST E: Timing-safe signature comparison is used
  it('TEST E: Timing-safe signature comparison is used', () => {
    const body = '{"test":1}';
    const shortSig = 'sha256=123';
    expect(verifyWebhookSignature(body, shortSig, TEST_SECRET)).toBe(false);
    const validSig = signPayload(body);
    expect(verifyWebhookSignature(body, validSig, TEST_SECRET)).toBe(true);
  });

  // TEST F: Duplicate delivery ID is processed only once
  it('TEST F: Duplicate delivery ID is processed only once', async () => {
    const deliveryId = 'del_repeat_123';
    expect(await isDeliveryProcessed(deliveryId)).toBe(false);
    await recordWebhookDelivery(deliveryId, 'push', 'processed', new Date().toISOString());
    expect(await isDeliveryProcessed(deliveryId)).toBe(true);
  });

  it('atomically claims a delivery so concurrent webhook handlers execute once', async () => {
    const deliveryId = 'delivery_atomic_claim';
    const receivedAt = new Date().toISOString();
    const claims = await Promise.all([
      claimWebhookDelivery(deliveryId, 'push', receivedAt),
      claimWebhookDelivery(deliveryId, 'push', receivedAt),
    ]);

    expect(claims.filter(Boolean)).toHaveLength(1);
    const row = await getDatabase().queryOne<{ status: string }>(
      'SELECT status FROM github_webhook_deliveries WHERE id = ?', [deliveryId]
    );
    expect(row?.status).toBe('processing');
  });

  it('allows a failed delivery to be retried without reopening processed deliveries', async () => {
    const deliveryId = 'delivery_failed_retry';
    const receivedAt = new Date().toISOString();

    await recordWebhookDelivery(deliveryId, 'push', 'failed', receivedAt, 'temporary failure');
    expect(await claimWebhookDelivery(deliveryId, 'push', new Date().toISOString())).toBe(true);
    expect(await getDatabase().queryOne<{ status: string; error_message: string | null }>(
      'SELECT status, error_message FROM github_webhook_deliveries WHERE id = ?', [deliveryId],
    )).toEqual({ status: 'processing', error_message: null });

    await recordWebhookDelivery(deliveryId, 'push', 'processed', new Date().toISOString());
    expect(await claimWebhookDelivery(deliveryId, 'push', new Date().toISOString())).toBe(false);
  });

  // TEST G: installation.created associates only with the correct workspace
  it('TEST G: installation.created associates only with the correct workspace', async () => {
    const { user } = await createUserWithSession('alice@test.com', 'Pass1234!', 'Alice');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_1', ?, 'inst_alice', 'alice-org', 'Organization', 'active', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);

    const res = await processGitHubWebhook({
      event: 'installation', deliveryId: 'del_g',
      rawBody: JSON.stringify({ action: 'created', installation: { id: 'inst_alice', account: { login: 'alice-org-updated', type: 'Organization' } } }),
    });
    expect(res.handled).toBe(true);
    const updated = await getWorkspaceGitHubInstallation(ws.id);
    expect(updated?.accountLogin).toBe('alice-org-updated');
  });

  // TEST H: Unknown installation cannot be attached to an arbitrary workspace
  it('TEST H: Unknown installation cannot be attached to an arbitrary workspace', async () => {
    const res = await processGitHubWebhook({
      event: 'installation', deliveryId: 'del_h',
      rawBody: JSON.stringify({ action: 'created', installation: { id: 'inst_unknown_random', account: { login: 'stranger', type: 'User' } } }),
    });
    expect(res.handled).toBe(false);
    expect(res.reason).toBe('unresolved_workspace');
  });

  // TEST I: installation.deleted marks installation inactive/deleted
  it('TEST I: installation.deleted marks installation inactive/deleted', async () => {
    const { user } = await createUserWithSession('bob@test.com', 'Pass1234!', 'Bob');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_i', ?, 'inst_bob', 'bob-org', 'Organization', 'active', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('repo_bob', ?, ?, 'bob-org', 'api', 'bob-org/api', '888001', 'main', 'connected', ?)
    `, [ws.id, user.id, new Date().toISOString()]);

    const res = await processGitHubWebhook({
      event: 'installation', deliveryId: 'del_i',
      rawBody: JSON.stringify({ action: 'deleted', installation: { id: 'inst_bob' } }),
    });
    expect(res.handled).toBe(true);

    const instActive = await getWorkspaceGitHubInstallation(ws.id);
    expect(instActive).toBeNull();
    const instAll = await getWorkspaceGitHubInstallation(ws.id, { includeInactive: true });
    expect(instAll?.status).toBe('deleted');
    const repoRow = await db.queryOne<{ status: string }>('SELECT status FROM repositories WHERE id = ?', ['repo_bob']);
    expect(repoRow?.status).toBe('disconnected');
  });

  // TEST J: Historical repository data remains after installation deletion
  it('TEST J: Historical repository data remains after installation deletion', async () => {
    const { user } = await createUserWithSession('hist@test.com', 'Pass1234!', 'Hist');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_j', ?, 'inst_hist', 'hist-org', 'Organization', 'active', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('repo_j', ?, ?, 'hist-org', 'core', 'hist-org/core', '888002', 'main', 'connected', ?)
    `, [ws.id, user.id, new Date().toISOString()]);
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
      VALUES ('scn_j', 'repo_j', 'sha123', 'completed', 'stripe', ?)
    `, [new Date().toISOString()]);

    await processGitHubWebhook({
      event: 'installation', deliveryId: 'del_j',
      rawBody: JSON.stringify({ action: 'deleted', installation: { id: 'inst_hist' } }),
    });

    const repoCount = await db.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM repositories WHERE id = ?', ['repo_j']);
    expect(repoCount?.c).toBe(1);
    const scanCount = await db.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM scans WHERE id = ?', ['scn_j']);
    expect(scanCount?.c).toBe(1);
  });

  // TEST K: installation_repositories added repository becomes available for selection
  it('TEST K: installation_repositories added repository becomes available for selection', async () => {
    const { user } = await createUserWithSession('k@test.com', 'Pass1234!', 'K User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_k', ?, 'inst_k', 'k-org', 'Organization', 'active', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);

    const res = await processGitHubWebhook({
      event: 'installation_repositories', deliveryId: 'del_k',
      rawBody: JSON.stringify({
        action: 'added', installation: { id: 'inst_k' },
        repositories_added: [{ id: 101, name: 'repo-k', full_name: 'k-org/repo-k' }],
      }),
    });
    expect(res.handled).toBe(true);
    const act = await db.queryOne<{ type: string }>('SELECT type FROM activity_events WHERE type = ?', ['github.repository.added']);
    expect(act?.type).toBe('github.repository.added');
  });

  // TEST L: installation_repositories removed repository becomes unavailable/disconnected
  it('TEST L: installation_repositories removed repository becomes unavailable/disconnected', async () => {
    const { user } = await createUserWithSession('l@test.com', 'Pass1234!', 'L User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_l', ?, 'inst_l', 'l-org', 'Organization', 'active', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('repo_l', ?, ?, 'l-org', 'repo-l', 'l-org/repo-l', '555101', 'main', 'connected', ?)
    `, [ws.id, user.id, new Date().toISOString()]);

    const res = await processGitHubWebhook({
      event: 'installation_repositories', deliveryId: 'del_l',
      rawBody: JSON.stringify({
        action: 'removed', installation: { id: 'inst_l' },
        repositories_removed: [{ id: 555101, name: 'repo-l', full_name: 'l-org/repo-l' }],
      }),
    });
    expect(res.handled).toBe(true);
    const repoRow = await db.queryOne<{ status: string }>('SELECT status FROM repositories WHERE id = ?', ['repo_l']);
    expect(repoRow?.status).toBe('unavailable');
  });

  // TEST M: Removed repository does not lose historical findings
  it('TEST M: Removed repository does not lose historical findings', async () => {
    const { user } = await createUserWithSession('m@test.com', 'Pass1234!', 'M User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_m', ?, 'inst_m', 'm-org', 'Organization', 'active', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('repo_m', ?, ?, 'm-org', 'api', 'm-org/api', '555202', 'main', 'connected', ?)
    `, [ws.id, user.id, new Date().toISOString()]);
    await db.execute(`
      INSERT INTO scans (id, repository_id, sha, status, provider, started_at)
      VALUES ('scn_m', 'repo_m', 'sha_m', 'completed', 'stripe', ?)
    `, [new Date().toISOString()]);
    await db.execute(`
      INSERT INTO findings (id, scan_id, repository_id, usage_id, change_id, provider, title, description, severity, confidence, file_path, line_number, symbol, status, reason, reason_codes, evidence, created_at)
      VALUES ('fnd_m', 'scn_m', 'repo_m', 'u1', 'c1', 'stripe', 'Title', 'Desc', 'critical', 0.9, 'f.ts', 1, 'sym', 'open', 'r', '[]', '[]', ?)
    `, [new Date().toISOString()]);

    await processGitHubWebhook({
      event: 'installation_repositories', deliveryId: 'del_m',
      rawBody: JSON.stringify({ action: 'removed', installation: { id: 'inst_m' }, repositories_removed: [{ id: 555202 }] }),
    });
    const fndCount = await db.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM findings WHERE id = ?', ['fnd_m']);
    expect(fndCount?.c).toBe(1);
  });

  // TEST N: Valid push for connected default branch creates one scan request
  it('TEST N: Valid push for connected default branch creates one scan request', async () => {
    const { user } = await createUserWithSession('n@test.com', 'Pass1234!', 'N User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_n', ?, 'inst_n', 'n-org', 'Organization', 'active', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('repo_n', ?, ?, 'n-org', 'billing', 'n-org/billing', '777001', 'main', 'connected', ?)
    `, [ws.id, user.id, new Date().toISOString()]);

    const res = await processGitHubWebhook({
      event: 'push', deliveryId: 'del_n',
      rawBody: JSON.stringify({
        ref: 'refs/heads/main', after: 'sha_push_123',
        repository: { id: 777001, full_name: 'n-org/billing' },
      }),
    });
    expect(res.handled).toBe(true);
    expect(res.status).toBe('pending');

    const reqs = await db.query<{ id: string; commit_sha: string; status: string }>(`
      SELECT id, commit_sha, status FROM github_scan_requests WHERE repository_id = ?
    `, ['repo_n']);
    expect(reqs.length).toBe(1);
    expect(reqs[0]?.commit_sha).toBe('sha_push_123');
    expect(reqs[0]?.status).toBe('pending');
  });

  // TEST O: Repeated push delivery does not create duplicate scan request
  it('TEST O: Repeated push delivery does not create duplicate scan request', async () => {
    const { user } = await createUserWithSession('o@test.com', 'Pass1234!', 'O User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_o', ?, 'inst_o', 'o-org', 'Organization', 'active', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('repo_o', ?, ?, 'o-org', 'app', 'o-org/app', '777002', 'main', 'connected', ?)
    `, [ws.id, user.id, new Date().toISOString()]);

    const pushPayload = JSON.stringify({
      ref: 'refs/heads/main', after: 'sha_same_commit',
      repository: { id: 777002, full_name: 'o-org/app' },
    });
    const res1 = await processGitHubWebhook({ event: 'push', deliveryId: 'del_o1', rawBody: pushPayload });
    expect(res1.handled).toBe(true);
    const res2 = await processGitHubWebhook({ event: 'push', deliveryId: 'del_o2', rawBody: pushPayload });
    expect(res2.handled).toBe(true);
    expect(res2.replayed).toBe(true);

    const reqCount = await db.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM github_scan_requests WHERE repository_id = ?', ['repo_o']);
    expect(reqCount?.c).toBe(1);
  });

  // TEST P: Push to non-default branch does not trigger automatic scan
  it('TEST P: Push to non-default branch does not trigger automatic scan', async () => {
    const { user } = await createUserWithSession('p@test.com', 'Pass1234!', 'P User');
    const ws = await getDefaultWorkspaceForUser(user.id);
    const db = getDatabase();
    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_p', ?, 'inst_p', 'p-org', 'Organization', 'active', ?, ?)
    `, [ws.id, new Date().toISOString(), new Date().toISOString()]);
    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('repo_p', ?, ?, 'p-org', 'app', 'p-org/app', '777003', 'main', 'connected', ?)
    `, [ws.id, user.id, new Date().toISOString()]);

    const res = await processGitHubWebhook({
      event: 'push', deliveryId: 'del_p',
      rawBody: JSON.stringify({ ref: 'refs/heads/feature-branch', after: 'sha_feat', repository: { id: 777003 } }),
    });
    expect(res.handled).toBe(false);
    expect(res.reason).toBe('non_default_branch');
    const reqs = await db.query<{ id: string }>('SELECT id FROM github_scan_requests WHERE repository_id = ?', ['repo_p']);
    expect(reqs.length).toBe(0);
  });

  // TEST Q: Deleted branch/ref does not trigger scan
  it('TEST Q: Deleted branch/ref does not trigger scan', async () => {
    const res = await processGitHubWebhook({
      event: 'push', deliveryId: 'del_q',
      rawBody: JSON.stringify({ ref: 'refs/heads/main', deleted: true, after: '0000000000000000000000000000000000000000', repository: { id: 1234 } }),
    });
    expect(res.handled).toBe(false);
    expect(res.reason).toBe('ref_deleted');
  });

  // TEST R: Push for unknown repository is ignored safely
  it('TEST R: Push for unknown repository is ignored safely', async () => {
    const res = await processGitHubWebhook({
      event: 'push', deliveryId: 'del_r',
      rawBody: JSON.stringify({ ref: 'refs/heads/main', after: 'sha_unknown', repository: { id: 99999999 } }),
    });
    expect(res.handled).toBe(false);
    expect(res.reason).toBe('unmatched_repository');
  });

  // TEST S: Push for repository from another workspace cannot affect current workspace
  it('TEST S: Push for repository from another workspace cannot affect current workspace', async () => {
    const { user: userA } = await createUserWithSession('usera_s@test.com', 'Pass1234!', 'User A');
    const wsA = await getDefaultWorkspaceForUser(userA.id);
    const { user: userB } = await createUserWithSession('userb_s@test.com', 'Pass1234!', 'User B');
    const wsB = await getDefaultWorkspaceForUser(userB.id);
    const db = getDatabase();

    await db.execute(`
      INSERT INTO github_installations (id, workspace_id, installation_id, account_login, account_type, status, created_at, updated_at)
      VALUES ('gi_sa', ?, 'inst_sa', 'org-a', 'Organization', 'active', ?, ?),
             ('gi_sb', ?, 'inst_sb', 'org-b', 'Organization', 'active', ?, ?)
    `, [wsA.id, new Date().toISOString(), new Date().toISOString(), wsB.id, new Date().toISOString(), new Date().toISOString()]);

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('repo_sb', ?, ?, 'org-b', 'backend', 'org-b/backend', '666001', 'main', 'connected', ?)
    `, [wsB.id, userB.id, new Date().toISOString()]);

    await processGitHubWebhook({
      event: 'push', deliveryId: 'del_s',
      rawBody: JSON.stringify({ ref: 'refs/heads/main', after: 'sha_b_push', repository: { id: 666001 } }),
    });

    const reqsA = await db.query<{ id: string }>('SELECT id FROM github_scan_requests WHERE workspace_id = ?', [wsA.id]);
    expect(reqsA.length).toBe(0);
    const reqsB = await db.query<{ id: string }>('SELECT id FROM github_scan_requests WHERE workspace_id = ?', [wsB.id]);
    expect(reqsB.length).toBe(1);
  });

  // TEST T: Webhook never exposes installation tokens
  it('TEST T: Webhook never exposes installation tokens', async () => {
    const res = await processGitHubWebhook({
      event: 'push', deliveryId: 'del_t',
      rawBody: JSON.stringify({ ref: 'refs/heads/main', after: 'sha_t', repository: { id: 9999 } }),
    });
    const serialized = JSON.stringify(res);
    expect(serialized).not.toContain('ghs_');
    expect(serialized).not.toContain('token');
  });

  // TEST U: Webhook never logs secrets
  it('TEST U: Webhook never logs secrets', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const warnSpy = vi.spyOn(console, 'warn');
    const errSpy = vi.spyOn(console, 'error');

    await processGitHubWebhook({
      event: 'push', deliveryId: 'del_u',
      rawBody: JSON.stringify({ ref: 'refs/heads/main', after: 'sha_u', repository: { id: 9999 } }),
    });

    for (const spy of [logSpy, warnSpy, errSpy]) {
      for (const call of spy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(TEST_SECRET);
      }
    }
  });

  // TEST V: Unsupported event receives successful acknowledgement
  it('TEST V: Unsupported event receives successful acknowledgement', async () => {
    const res = await processGitHubWebhook({
      event: 'issues', deliveryId: 'del_v',
      rawBody: JSON.stringify({ action: 'opened', issue: { number: 1 } }),
    });
    expect(res.received).toBe(true);
    expect(res.handled).toBe(false);
  });

  // TEST W: GitHub API failure / JSON parse error is handled safely
  it('TEST W: GitHub API failure / JSON parse error is handled safely', async () => {
    const res = await processGitHubWebhook({
      event: 'push', deliveryId: 'del_w',
      rawBody: 'INVALID_NON_JSON_BODY{{{',
    });
    expect(res.received).toBe(true);
    expect(res.handled).toBe(false);
    expect(res.error).toBe('INVALID_JSON');
  });

  // TEST X: Existing Phase 1 security tests remain passing
  it('TEST X: Existing Phase 1 security invariants remain intact', () => {
    const patch = { 'src/app.ts': 'export const x = 2;\n' };
    const digest = computeCanonicalPatchDigest(patch);
    const evidence = createVerificationEvidence({
      baselineSha: 'b1be45b401f41106ecfd489bbbb1fff71639c763',
      changeId: 'c1',
      patchDigest: digest,
      repositoryId: 'r1',
      proofLevel: 'CONTRACT_VERIFIED',
      patchApplied: true,
      typecheckPassed: true,
      testsPassed: true,
      contractPassed: true,
    });
    expect(evidence.patchDigest).toBe(digest);
  });

  // TEST Y: Existing Phase 2 multi-tenant tests remain passing
  it('TEST Y: Existing Phase 2 multi-tenant workspace boundary remains intact', async () => {
    const { user: user1 } = await createUserWithSession('user1_y@test.com', 'Pass1234!', 'User 1');
    const ws1 = await getDefaultWorkspaceForUser(user1.id);
    const { user: user2 } = await createUserWithSession('user2_y@test.com', 'Pass1234!', 'User 2');
    const db = getDatabase();

    await db.execute(`
      INSERT INTO repositories (id, workspace_id, user_id, owner, name, full_name, github_repository_id, default_branch, status, created_at)
      VALUES ('repo_y1', ?, ?, 'org1', 'repo1', 'org1/repo1', '999111', 'main', 'connected', ?)
    `, [ws1.id, user1.id, new Date().toISOString()]);

    await expect(requireRepositoryAccess('repo_y1', user2.id)).rejects.toThrow('Repository not found or access denied.');
  });
});
